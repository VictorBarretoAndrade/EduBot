# MELHORIA (Integração de IA real) — Camada de provider da LLM.
#
# Centraliza a escolha do "cérebro" do EduBot. Por padrão o provider é "mock"
# (comportamento atual, determinístico, sem custo). Quando as credenciais da
# AWS estiverem disponíveis, basta definir no ambiente:
#
#   EDUBOT_LLM_PROVIDER=bedrock
#   AWS_REGION=us-east-1
#   AWS_ACCESS_KEY_ID=...        (ou perfil/role da AWS)
#   AWS_SECRET_ACCESS_KEY=...
#
# ...e os três agentes (tutor do OVA, recomendação e agente de tool-use) passam
# a usar o Claude na AWS Bedrock — SEM nenhuma mudança de código.
#
# Também é possível usar a API direta da Anthropic (sem AWS):
#   EDUBOT_LLM_PROVIDER=anthropic
#   ANTHROPIC_API_KEY=...
#
# Os dois caminhos usam o MESMO SDK `anthropic` e a MESMA interface
# `client.messages.create(...)` — só muda a construção do cliente.
import os

# mock | bedrock | anthropic
PROVIDER = os.getenv("EDUBOT_LLM_PROVIDER", "mock").lower()
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Modelo Claude. Na Bedrock o id leva o prefixo "anthropic." (adicionado
# automaticamente abaixo). Troque por "claude-opus-4-8" para o modelo mais
# capaz, ou mantenha o Sonnet (mais econômico) — escolha do projeto.
DEFAULT_MODEL = os.getenv("EDUBOT_LLM_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = int(os.getenv("EDUBOT_LLM_MAX_TOKENS", "1024"))

_client = None


def is_real():
    """True quando um provider de LLM real está configurado (não-mock)."""
    return PROVIDER in ("bedrock", "anthropic")


def model_id(model=None):
    """Id do modelo já no formato exigido pelo provider.

    `model` permite sobrescrever o modelo padrão numa chamada específica (ex.: o
    coach usa um modelo mais barato). Na Bedrock o id ganha o prefixo
    'anthropic.' se ainda não tiver (ids de inference profile como 'us.anthropic.'
    já vêm completos e são preservados)."""
    mid = model or DEFAULT_MODEL
    if PROVIDER == "bedrock" and not mid.startswith(("anthropic.", "us.anthropic.", "eu.anthropic.")):
        mid = "anthropic." + mid
    return mid


def get_client():
    """Constrói (uma vez) o cliente do SDK `anthropic` para o provider atual.

    A importação do SDK é preguiçosa: no modo mock o pacote `anthropic` nem
    precisa ser usado.
    """
    global _client
    if _client is not None:
        return _client

    if PROVIDER == "bedrock":
        # Cliente Messages-API da Bedrock (recomendado). Lê as credenciais AWS
        # do ambiente/perfil/role; só a região é obrigatória.
        from anthropic import AnthropicBedrockMantle
        _client = AnthropicBedrockMantle(aws_region=AWS_REGION)
    elif PROVIDER == "anthropic":
        # API direta da Anthropic (lê ANTHROPIC_API_KEY do ambiente).
        from anthropic import Anthropic
        _client = Anthropic()
    else:
        raise RuntimeError(
            "EDUBOT_LLM_PROVIDER='mock': nenhum cliente real configurado.")
    return _client


def messages_create(system, messages, tools=None, max_tokens=None, model=None):
    """Chamada única à Messages API (vale para Bedrock e Anthropic).

    `model` sobrescreve o modelo padrão nesta chamada (ex.: coach com modelo
    barato). Devolve o objeto de resposta do SDK (com .content[], .stop_reason,
    .model). Quem chama decide como ler (texto puro ou loop de tool-use).
    """
    client = get_client()
    kwargs = {
        "model": model_id(model),
        "max_tokens": max_tokens or MAX_TOKENS,
        "system": system,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools
    return client.messages.create(**kwargs)
