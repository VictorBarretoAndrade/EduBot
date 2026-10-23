# MELHORIA (Integração de IA real) — Camada de provider da LLM.
#
# Centraliza a escolha do "cérebro" do EduBot. Por padrão o provider é "mock"
# (comportamento atual, determinístico, sem custo). Suporta:
#   - mock: determinístico, sem rede nem custo
#   - azure / openai: Azure AI Foundry / Azure OpenAI (ex.: gpt-5-mini)
#   - bedrock: AWS Bedrock (Claude)
#   - anthropic: API direta da Anthropic (Claude)
import json
import logging
import os
import time
import urllib.error
import urllib.request

logger = logging.getLogger("edubot.llm")

# mock | bedrock | anthropic | azure | openai
PROVIDER = os.getenv("EDUBOT_LLM_PROVIDER", "mock").lower()
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Azure AI Foundry / OpenAI
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")

# --- Circuit breaker (B.4) -------------------------------------------------
# Sob falha da LLM (timeout/erro de provider), evitar pagar timeout em cascata
# no sweep noturno: após N falhas CONSECUTIVAS, `is_real()` passa a devolver
# False por um período de "esfriamento" — os caminhos degradam para template/
# mock automaticamente (best-effort já existente). Um sucesso zera o contador.
BREAKER_THRESHOLD = int(os.getenv("EDUBOT_LLM_BREAKER_THRESHOLD", "3"))
BREAKER_COOLDOWN_SECONDS = int(os.getenv("EDUBOT_LLM_BREAKER_COOLDOWN", "600"))  # 10 min
_consecutive_failures = 0
_circuit_open_until = 0.0


def _record_success():
    global _consecutive_failures, _circuit_open_until
    _consecutive_failures = 0
    _circuit_open_until = 0.0


def _record_failure():
    global _consecutive_failures, _circuit_open_until
    _consecutive_failures += 1
    if _consecutive_failures >= BREAKER_THRESHOLD:
        _circuit_open_until = time.time() + BREAKER_COOLDOWN_SECONDS
        logger.warning("Circuit breaker ABERTO: %s falhas consecutivas da LLM; "
                       "degradando para template/mock por %ss.",
                       _consecutive_failures, BREAKER_COOLDOWN_SECONDS)


def circuit_open():
    """True enquanto o breaker está aberto (janela de esfriamento não expirou)."""
    return time.time() < _circuit_open_until


def reset_breaker():
    """Zera o estado do breaker (usado em testes)."""
    _record_success()


DEFAULT_MODEL = os.getenv("EDUBOT_LLM_MODEL", "gpt-5-mini" if PROVIDER in ("azure", "openai") else "claude-sonnet-4-6")
MAX_TOKENS = int(os.getenv("EDUBOT_LLM_MAX_TOKENS", "2048"))

_client = None


class Block(dict):
    """Representa um bloco de resposta (text ou tool_use), com acesso a atributos e dict."""
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.__dict__ = self

    @property
    def text(self):
        return self.get("text", "")

    @property
    def type(self):
        return self.get("type", "")


class LLMResponse:
    """Envelope retornado por messages_create, compatível com a interface consumida
    pelos agentes (tutor, coach, loop, redactor)."""
    def __init__(self, content, model, id, stop_reason, input_tokens=0, output_tokens=0):
        self.content = content
        self.model = model
        self.id = id
        self.stop_reason = stop_reason
        self.usage = Block(input_tokens=input_tokens, output_tokens=output_tokens)

    def model_dump(self):
        return {
            "content": [dict(b) for b in self.content],
            "model": self.model,
            "id": self.id,
            "stop_reason": self.stop_reason,
            "usage": {
                "input_tokens": self.usage.input_tokens,
                "output_tokens": self.usage.output_tokens
            }
        }


def normalize_azure_url(endpoint):
    """Garante que a URL do Azure aponte para o endpoint chat/completions."""
    ep = (endpoint or "").strip()
    if ep.endswith("/openai/v1/responses"):
        return ep[:-len("/responses")] + "/chat/completions"
    elif ep.endswith("/openai/v1"):
        return ep + "/chat/completions"
    elif ep.endswith("/chat/completions"):
        return ep
    elif "/openai/v1" not in ep:
        return ep.rstrip("/") + "/openai/v1/chat/completions"
    return ep


def _convert_messages_for_openai(system, messages):
    """Traduz as mensagens do formato interno/Anthropic para o padrão OpenAI."""
    out = []
    if system:
        if isinstance(system, list):
            sys_text = "\n".join(b.get("text", "") for b in system if isinstance(b, dict))
        else:
            sys_text = str(system)
        if sys_text.strip():
            out.append({"role": "system", "content": sys_text.strip()})

    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role == "user":
            if isinstance(content, list):
                tool_results = [b for b in content if isinstance(b, dict) and b.get("type") == "tool_result"]
                if tool_results:
                    for tr in tool_results:
                        out.append({
                            "role": "tool",
                            "tool_call_id": tr.get("tool_use_id"),
                            "content": str(tr.get("content", ""))
                        })
                    continue
                else:
                    text = "".join(b.get("text", "") for b in content if isinstance(b, dict))
                    out.append({"role": "user", "content": text})
            else:
                out.append({"role": "user", "content": str(content or "")})
        elif role == "assistant":
            if isinstance(content, list):
                tool_calls = []
                text_parts = []
                for b in content:
                    b_type = getattr(b, "type", None) or (b.get("type") if isinstance(b, dict) else None)
                    if b_type == "tool_use":
                        tc_id = getattr(b, "id", None) or b.get("id")
                        tc_name = getattr(b, "name", None) or b.get("name")
                        tc_input = getattr(b, "input", None) or b.get("input", {})
                        tool_calls.append({
                            "id": tc_id,
                            "type": "function",
                            "function": {
                                "name": tc_name,
                                "arguments": json.dumps(tc_input) if not isinstance(tc_input, str) else tc_input
                            }
                        })
                    elif b_type == "text":
                        text_parts.append(getattr(b, "text", "") or b.get("text", ""))
                msg_obj = {"role": "assistant", "content": "".join(text_parts) or None}
                if tool_calls:
                    msg_obj["tool_calls"] = tool_calls
                out.append(msg_obj)
            else:
                out.append({"role": "assistant", "content": str(content or "")})
        else:
            out.append({"role": role, "content": str(content or "")})
    return out


def _azure_messages_create(system, messages, tools=None, max_tokens=None, model=None):
    """Executa a chamada HTTP para o Azure AI Foundry / OpenAI chat/completions."""
    url = normalize_azure_url(AZURE_OPENAI_ENDPOINT)
    api_key = AZURE_OPENAI_API_KEY
    headers = {
        "Content-Type": "application/json",
        "api-key": api_key,
        "Authorization": f"Bearer {api_key}"
    }

    out_messages = _convert_messages_for_openai(system, messages)
    target_model = model or AZURE_OPENAI_DEPLOYMENT or DEFAULT_MODEL
    payload = {
        "model": target_model,
        "messages": out_messages,
        "max_completion_tokens": max(max_tokens or MAX_TOKENS, 2048)
    }
    if any(k in (target_model or "").lower() for k in ("gpt-5", "o1", "o3", "o4")):
        payload["reasoning_effort"] = os.getenv("AZURE_REASONING_EFFORT", "low")

    if tools:
        payload["tools"] = [{
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", {})
            }
        } for t in tools]

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=45) as raw_resp:
        resp_data = json.loads(raw_resp.read().decode("utf-8"))

    choice = resp_data["choices"][0]
    finish_reason = choice.get("finish_reason")
    msg = choice.get("message", {})
    usage = resp_data.get("usage", {})
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)

    content_blocks = []
    if msg.get("content"):
        content_blocks.append(Block(type="text", text=msg["content"]))

    if msg.get("tool_calls"):
        for tc in msg["tool_calls"]:
            fn = tc.get("function", {})
            try:
                fn_args = json.loads(fn.get("arguments", "{}"))
            except Exception:
                fn_args = fn.get("arguments", "{}")
            content_blocks.append(Block(
                type="tool_use",
                id=tc.get("id"),
                name=fn.get("name"),
                input=fn_args
            ))

    stop_reason = "tool_use" if finish_reason == "tool_calls" else "end_turn"
    return LLMResponse(
        content=content_blocks,
        model=resp_data.get("model", model or AZURE_OPENAI_DEPLOYMENT),
        id=resp_data.get("id", ""),
        stop_reason=stop_reason,
        input_tokens=input_tokens,
        output_tokens=output_tokens
    )


def is_real():
    """True quando um provider de LLM real está configurado (não-mock) E o
    circuit breaker (B.4) não está aberto. Com o breaker aberto, os caminhos de
    IA degradam para template/mock sem tentar a rede."""
    return PROVIDER in ("bedrock", "anthropic", "azure", "openai") and not circuit_open()


def model_id(model=None):
    """Id do modelo já no formato exigido pelo provider.

    Se for Azure, intercepta modelos default claude-* e substitui pelo deployment
    Azure configurado (evita 404 por deployment inexistente)."""
    if PROVIDER in ("azure", "openai"):
        if model and not model.startswith("claude-") and not model.startswith(("anthropic.", "us.anthropic.", "eu.anthropic.")):
            return model
        return AZURE_OPENAI_DEPLOYMENT or DEFAULT_MODEL

    mid = model or DEFAULT_MODEL
    if PROVIDER == "bedrock" and not mid.startswith(("anthropic.", "us.anthropic.", "eu.anthropic.")):
        mid = "anthropic." + mid
    return mid


def get_client():
    """Constrói (uma vez) o cliente do SDK `anthropic` para o provider atual.

    A importação do SDK é preguiçosa: no modo mock ou azure o pacote `anthropic` nem
    precisa ser usado.
    """
    global _client
    if _client is not None:
        return _client

    if PROVIDER == "bedrock":
        from anthropic import AnthropicBedrock
        _client = AnthropicBedrock(aws_region=AWS_REGION)
    elif PROVIDER == "anthropic":
        from anthropic import Anthropic
        _client = Anthropic()
    elif PROVIDER in ("azure", "openai"):
        return None
    else:
        raise RuntimeError(
            "EDUBOT_LLM_PROVIDER='mock': nenhum cliente real configurado.")
    return _client


def messages_create(system, messages, tools=None, max_tokens=None, model=None):
    """Chamada unificada à Messages API (compatível com Azure, Bedrock e Anthropic).

    `model` sobrescreve o modelo padrão nesta chamada (ex.: coach com modelo
    barato). Devolve o envelope de resposta (com .content[], .stop_reason,
    .model, .usage).
    """
    if PROVIDER in ("azure", "openai"):
        try:
            resp = _azure_messages_create(
                system=system,
                messages=messages,
                tools=tools,
                max_tokens=max_tokens,
                model=model_id(model),
            )
            _record_success()
            return resp
        except Exception:
            _record_failure()
            raise

    client = get_client()
    kwargs = {
        "model": model_id(model),
        "max_tokens": max_tokens or MAX_TOKENS,
        "system": system,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools
    try:
        resp = client.messages.create(**kwargs)
    except Exception:
        # B.4: alimenta o circuit breaker e repropaga — os chamadores já tratam
        # a exceção degradando para template/mock (padrão best-effort).
        _record_failure()
        raise
    _record_success()
    return resp
