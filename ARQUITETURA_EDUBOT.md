# EduBot — Arquitetura e Funcionamento

**Documento único e atual do sistema.** Consolida o que estava espalhado em ~30
arquivos e corrige o que estava desatualizado.

> **Estado verificado em 13/09/2026** contra o código, não contra documentação.
> Suíte executada: `python -m pytest` → **258 testes, 258 passaram, 2,74 s**.
> Contagens de arquitetura conferidas por inspeção direta do repositório.
>
> ⚠️ **Este documento substitui, como referência atual:** `README.md`,
> `PROJETO.md`, `ANALISE.md`, `ALTERACOES_EDUBOT.md`, `CHANGES.md`,
> `DADOS_E_AGENTE.md`, `OVA_PERSONALIZADA.md`, `IA_AWS_SETUP.md`,
> `REQUISITOS_E_BACKLOG.md` e `AUDITORIA_TECNICA.md`. Todos descrevem uma
> estrutura de código que **não existe mais** (§17).

---

## Índice

1. [O que é o EduBot](#1-o-que-é-o-edubot)
2. [O ciclo em quatro tempos](#2-o-ciclo-em-quatro-tempos)
3. [Arquitetura e stack](#3-arquitetura-e-stack)
4. [O que o sistema mede](#4-o-que-o-sistema-mede)
5. [O modelo do aluno (BKT)](#5-o-modelo-do-aluno-bkt)
6. [O agente](#6-o-agente)
7. [A OVA personalizada de reforço](#7-a-ova-personalizada-de-reforço)
8. [Quiz](#8-quiz)
9. [Camadas de apoio](#9-camadas-de-apoio)
10. [Painéis](#10-painéis)
11. [Banco de dados](#11-banco-de-dados)
12. [Governança e LGPD](#12-governança-e-lgpd)
13. [Acervo de conteúdo](#13-acervo-de-conteúdo)
14. [Estado atual verificado](#14-estado-atual-verificado)
15. [Integração com o Canvas](#15-integração-com-o-canvas)
16. [Limitações conhecidas](#16-limitações-conhecidas)
17. [Índice da documentação](#17-índice-da-documentação)

---

# 1. O que é o EduBot

Uma plataforma de aprendizagem que **mede o que o aluno realmente faz** num
Objeto Virtual de Aprendizagem (OVA), **estima o domínio dele por competência**,
e **age sozinha** — recomendando ao aluno, montando trilhas de reforço e
avisando o professor antes de o aluno ficar para trás.

## 1.1 Origem: o que já existia e o que foi construído

O EduBot é uma **extensão** de um projeto anterior — o `OVA-Rastreamento`. A
fronteira é datada e rastreável no histórico git (preservado na pasta legada
`OVA-IA/`, 161 commits):

| Fase | Commits | Autores | Período |
|---|---:|---|---|
| **Upstream — OVA-Rastreamento** | 1–129 | `duducaa` (124), `PedroCosta2198` (3), outros | set/2024 → 11/jun/2026 |
| **EduBot Track** | 130–161 | `VictorBarretoAndrade` (30), `cezimbra` (2) | 11/jun/2026 → 09/ago/2026 |

**Já existia (upstream):** o modelo de dados nuclear (`courses`,
`course_subjects`, `offerings`, `competencies`, `ovas`, `questions`, `students`,
`answers`, `interactions`), o conteúdo HTML dos OVAs de Quântica e Cálculo,
rastreamento básico (visitas, % de vídeo do YouTube), backend Flask + Peewee +
MySQL, frontend jQuery/Bootstrap, `docker compose` e um painel de gráficos.

**Foi construído no EduBot Track:**

| Camada | Entregas |
|---|---|
| **Segurança** | Token assinado no login; aluno resolvido do **token**, nunca do payload (fechou IDOR em 3 rotas); **correção do quiz movida para o servidor** (o gabarito ia no DOM); senhas com PBKDF2; CORS por origem; rate-limit de login |
| **Rastreamento** | `read_time` acumulado por delta (media a maior sessão); inatividade **multi-sinal**; tentativas idempotentes; consumo de mídia; **leitura por seção**; eventos **xAPI-lite** |
| **Modelo do aluno** | BKT com esquecimento, histórico e tendência de domínio, revisão espaçada, dificuldade adaptativa, gate de liberação do quiz |
| **Agente** | Motor de regras → **loop de tool-use** com 11 ferramentas e tiers de autonomia; fila de aprovação do tutor; proatividade por evento e agendada; redação por caso; circuit breaker; teto de orçamento; trilha de decisões auditável |
| **Reforço** | OVA personalizada gerada por agente, com validação server-side de todo ID |
| **Governança** | Consentimento (LGPD) com finalidades revogáveis, minimização, canal do titular |
| **Engajamento** | XP por esforço, sequências, conquistas, metas semanais, ranking opt-in, companheiro de estudo |
| **Frontend** | SPA React/TypeScript inteira (58 arquivos), leitor de OVA **nativo**, tutor de IA por OVA, painéis de professor e gestor, i18n PT/EN, acessibilidade |
| **Qualidade** | **258 testes** (não havia nenhum); backend reorganizado no pacote `edubot/`; front jQuery aposentado |

---

# 2. O ciclo em quatro tempos

A ideia central do sistema, e o que o diferencia de um LMS comum:

```
   ┌──────────────────────────────────────────────────────────┐
   │                                                          │
   ▼                                                          │
①  MEDIR                                                      │
   O aluno lê, assiste, ouve e responde.                      │
   Tudo é medido com honestidade: aba oculta não conta,       │
   arrastar a barra do vídeo não conta como assistir.         │
   │                                                          │
   ▼                                                          │
②  MODELAR                                                    │
   Cada resposta atualiza o DOMÍNIO da competência —          │
   um número de 0 a 100% que sobe ao acertar, cai ao errar    │
   e DECAI SOZINHO com o tempo sem prática.                   │
   │                                                          │
   ▼                                                          │
③  DECIDIR                                                    │
   Regras determinísticas decidem SE e QUANDO agir            │
   (barato, auditável). O modelo de linguagem, quando         │
   ligado, decide COMO dizer e O QUE selecionar.              │
   │                                                          │
   ▼                                                          │
④  AGIR                                                       │
   Trilha de reforço · convite de retomada · desafio ·        │
   revisão agendada · alerta ao professor                     │
   │                                                          │
   └──── o consumo do que foi gerado realimenta a medição ────┘
```

**O fechamento do ciclo é literal na arquitetura:** a trilha de reforço usa os
mesmos players e o mesmo endpoint de correção do módulo regular. Por isso o
consumo do reforço atualiza as mesmas tabelas e realimenta o modelo de domínio.
Não é um sistema paralelo — é o mesmo sistema, com conteúdo selecionado.

---

# 3. Arquitetura e stack

## 3.1 Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                      │
│  SPA React (TypeScript · Vite · Tailwind)                        │
│  leitor de OVA nativo · players · quiz · painéis · companheiro   │
└───────────────┬─────────────────────────────────────────────────┘
                │ Authorization: Bearer <token>
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Flask  (17 blueprints · 51 endpoints)                      │
│                                                                 │
│  api/       auth · rotas                                        │
│  services/  18 módulos: mastery · quiz · reinforcement ·         │
│             preferences · proactivity · risk · reviews ·         │
│             gamification · events · consents · decisions · ...   │
│  agent/     11 módulos: loop de tool-use · tools · llm ·         │
│             personalized · coach · tutor · redactor · prompt     │
│  data/      28 arquivos de model (Peewee) → 29 tabelas          │
└───────────────┬─────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  MySQL 8.4   ·  29 tabelas  ·  19 migrations idempotentes        │
└─────────────────────────────────────────────────────────────────┘

   Apache serve o SPA e o HTML estático dos OVAs
   APScheduler roda a varredura diária da turma, no próprio processo Flask
```

## 3.2 Stack

| Camada | Tecnologia |
|---|---|
| **Backend** | Python 3 · Flask · Peewee (ORM) · PyMySQL · APScheduler · SDK `anthropic[bedrock]` |
| **Banco** | MySQL 8.4 (SQLite apenas por opt-in explícito, para testes) |
| **Frontend** | React 18 · TypeScript (strict) · Vite 5 · Tailwind 3 · Recharts · three.js (lazy) |
| **Servidor web** | Apache (httpd) |
| **Orquestração** | Docker Compose — 4 serviços: MySQL, Flask, build do React, Apache |
| **Testes** | pytest, SQLite em memória — 40 arquivos, 258 testes |

## 3.3 Como rodar

```bash
docker compose up -d          # sobe tudo; não exige Node na máquina
# interface:  http://localhost:8010/app/
# API:        http://localhost:5010
# login do seed: RA = senha (ex.: 1/1, 5/5, 7/7)
```

⚠️ **Gotcha conhecido:** num volume MySQL **já existente**, as migrations não
rodam sozinhas (o init só executa em volume novo). Aplicar à mão:

```bash
docker exec -i ova_db mysql -ueduardo -pPassword-1 ova_db < Database/sql/migration_0XX_*.sql
```

## 3.4 Autenticação

Token assinado com HMAC-SHA256 (stdlib, sem dependência nova), validade de
7 dias, enviado em `Authorization: Bearer`. O aluno é resolvido **do token** e
exposto em `g.student` — nunca vem do corpo da requisição.

- Senhas: **PBKDF2-HMAC-SHA256**, 260.000 iterações, salt por usuário. Senhas
  legadas em texto plano do seed são aceitas **uma vez** e reescritas como hash
  no próprio login (*upgrade-on-login*).
- Papéis: `aluno` · `tutor` · `admin`, com decoradores `@require_auth` e
  `@require_roles(...)`.
- Rate-limit de login: 5 tentativas por (RA, IP) a cada 60 s → HTTP 429.

> **Propriedade arquitetural relevante:** a sessão é por **token Bearer**, não
> por cookie. Isso torna o sistema compatível com execução dentro de iframe —
> o que viabiliza a integração LTI com o Canvas (§15) sem reescrita.

---

# 4. O que o sistema mede

Este é o diferencial central. A medição é **deliberadamente honesta**: mede
estudo, não janela aberta.

| Sinal | Como é medido | Tabela |
|---|---|---|
| **Tempo de leitura** | Acumulado **por delta** no servidor. Antes media a maior sessão — ler 10 min hoje e 10 min amanhã registrava 10 min | `ova_progress.read_time` |
| **Leitura por seção** | Por identificador de seção do HTML: tempo **ativo** (aba oculta e ociosidade **não contam**), marca d'água de scroll, nº de visitas (>1 = releitura) | `ova_section_progress` |
| **Vídeo** | % efetivamente assistido, segundos, play/pause/seek, mudança de velocidade. Distingue assistir de arrastar a barra | `resource_progress` |
| **Podcast** | Segundos de escuta, % consumido | `resource_progress` |
| **Tentativas de quiz** | Uma linha por tentativa, com acerto, **tempo de resposta**, competência e dificuldade | `attempts` |
| **Primeira resposta correta** | Uma linha por (aluno, questão) | `answers` |
| **Eventos** | 20 verbos × 6 tipos de objeto, com contexto JSON | `learning_events` |
| **Inatividade** | **5 fontes** consolidadas em uma query (`UNION ALL`): interações, leitura de OVA, consumo de mídia, tentativas e eventos | derivado |

## 4.1 Limiares de consumo

| Regra | Valor |
|---|---|
| Vídeo/podcast considerado **concluído** | ≥ 90% |
| Texto considerado **consumido** | ≥ 80% de scroll |
| Competência **desenvolvida** (fallback sem BKT) | ≥ 80% de acerto |

## 4.2 Eventos (xAPI-lite)

Schema enumerado e agregável, que substitui gradualmente as strings livres da
tabela `interactions` herdada.

**20 verbos:** `logged_in`, `opened`, `read`, `played`, `paused`, `seeked`,
`rate_changed`, `completed`, `answered`, `asked_tutor`, `received_intervention`,
`dismissed`, `idle_start`, `idle_end`, `section_enter`, `section_exit`,
`companion_spoke`, `companion_listened`, `companion_dismissed`,
`companion_explain`.

**6 tipos de objeto:** `ova`, `ova_section`, `resource`, `question`,
`intervention`, `session`.

Verbo ou tipo inválido é rejeitado — é essa validação que torna a métrica
agregável.

---

# 5. O modelo do aluno (BKT)

O sistema não usa percentual de acerto puro. Usa **Bayesian Knowledge Tracing**
com decaimento temporal: um número contínuo de 0 a 1 por (aluno, competência).

## 5.1 Parâmetros

| Parâmetro | Valor | Significado |
|---|---|---|
| `P_INIT` | 0,20 | Domínio a priori de um aluno novo na competência |
| `P_LEARN` | 0,15 | Chance de aprender entre duas tentativas |
| `P_SLIP` | 0,10 | Errar sabendo (deslize) |
| `P_GUESS` | 0,25 | Acertar sem saber (chute em múltipla escolha de 4) |
| `DECAY_PER_WEEK` | 0,02 | **Esquecimento** — decaimento semanal rumo ao `P_INIT` |
| `DEVELOPING_THRESHOLD` | 0,40 | Abaixo disso → "não iniciada" |
| `DEVELOPED_THRESHOLD` | 0,80 | Acima disso → "desenvolvida" |

## 5.2 Atualização

A cada tentativa, três passos, síncronos (1 upsert) na rota de correção do quiz:

1. **Decaimento** pelo tempo sem prática
2. **Correção bayesiana** pela evidência (acertou / errou)
3. **Transição de aprendizado**

**Degradação segura:** onde ainda não há linha de mastery, o perfil cai na razão
`acertos/total` — nunca fica sem status.

## 5.3 Histórico e tendência

Um snapshot diário por (aluno, competência) é gravado pela varredura noturna
(idempotente: PK composta por dia). A tendência compara o domínio atual com o
snapshot mais antigo da janela, devolvendo `delta` e direção (`up`/`down`/`flat`).

> ⚠️ **Consequência importante do decaimento:** o domínio **cai sozinho** sem
> prática. Isso é correto pedagogicamente, mas significa que esse número **não
> deve virar nota em registro acadêmico** — uma nota que cai sem o aluno fazer
> nada é indefensável (ver §15 e §16).

---

# 6. O agente

O EduBot tem **dois cérebros**, e a separação é deliberada.

| | **Motor de regras** | **Loop de tool-use** |
|---|---|---|
| Decide | **SE** e **QUANDO** agir | **O QUE** selecionar e **COMO** dizer |
| Custo | Zero | Tokens (quando LLM real está ligada) |
| Auditável | Totalmente | Trilha em `agent_decisions` |
| Onde vive | `agent/agent.py`, `services/proactivity.py` | `agent/loop.py`, `agent/tools.py` |

**A regra decide quando; o modelo decide como.** Isso mantém o custo baixo e a
decisão pedagógica auditável.

## 6.1 As 6 regras de decisão

Aplicadas **nesta ordem** — a primeira satisfeita define a recomendação:

| # | Regra | Gatilho |
|---|---|---|
| 1 | Plano de retomada | Inativo há mais de **7 dias** |
| 2 | Trilha mínima | Consumo abaixo de **40%** dos recursos |
| 3 | Revisão alternativa | Taxa de erro no quiz acima de **50%** |
| 4 | Checklist de execução | Acessou mas não concluiu atividades |
| 5 | Aprofundamento / desafio | Alguma competência **desenvolvida** |
| 6 | Preferência de formato | Há um formato de maior engajamento |

## 6.2 As 11 ferramentas e os tiers de autonomia

Cada ferramenta carrega um **tier** — política de execução, não sugestão.

| Ferramenta | Tier | O que faz |
|---|---|---|
| `obter_perfil_resumido` | `read` | Digest minimizado do estado do aluno |
| `historico_intervencoes` | `read` | Últimas decisões **com o resultado** — é como o agente evita repetir o que foi dispensado |
| `listar_competencias_fracas` | `read` | Ranking de competências, da mais fraca à mais forte |
| `listar_recursos_remediacao` | `read` | Recursos da competência, reordenados pelo formato preferido |
| `listar_questoes_reforco` | `read` | Questões da competência, **sem gabarito** |
| `criar_intervencao` | `auto` | Mensagem proativa. Idempotente por (aluno, tipo, dia) |
| `criar_ova_personalizada` | `auto` | Monta e persiste a trilha de reforço |
| `agendar_revisao` | `auto` | Revisão espaçada. Valida que a competência é do curso |
| `ajustar_dificuldade` | `auto_capped` | ±1 nível, **teto de 1 mudança/dia por competência** |
| `alertar_tutor` | `auto_or_queue` | Severidade alta → **fila de aprovação**, aluno não é notificado |
| `propor_mensagem_do_tutor` | `queue` | **Nunca sai sem aprovação humana** |

**Tiers:** `read` (livre) · `auto` (escrita reversível e idempotente) ·
`auto_capped` (com teto) · `auto_or_queue` (fila acima de um limiar) · `queue`
(sempre exige aprovação).

## 6.3 As quatro garantias do tool-use

Estas são propriedades do código, não promessas:

1. **O aluno nunca vem do payload.** O contexto carrega o aluno resolvido do
   token; o modelo não consegue endereçar outro aluno.
2. **Todo ID escolhido pelo modelo é revalidado no servidor.** A trilha só
   persiste recursos e questões que **existem E pertencem à competência-alvo**.
   Coberto por teste: passando `[válida, de-outra-competência, inexistente]`,
   só a válida persiste.
3. **A idempotência mora dentro da ferramenta**, não no prompt. Repetir a
   chamada não duplica intervenções, alertas nem revisões.
4. **Erro de ferramenta nunca mata o loop.** Exceção vira payload de erro
   devolvido ao modelo como `tool_result`.

## 6.4 O loop

Teto de **8 iterações**. Na prática, **5** — verificado empiricamente:
4 chamadas de ferramenta + 1 turno de fechamento.

O "cérebro" é **injetável**: com LLM real usa o Claude; sem ela, um cliente
determinístico que devolve **o envelope literal da Anthropic Messages API**
(blocos `tool_use`, `stop_reason`, `usage`). O loop, as ferramentas, a validação
e a persistência são idênticos nos dois modos.

**Degradação graciosa:** se a LLM real falha no meio do loop, ele cai no cliente
determinístico em vez de estourar erro 500.

## 6.5 Observabilidade

Toda execução — inclusive em modo determinístico — grava uma linha em
`agent_decisions`: gatilho, digest minimizado (**sem RA nem nome completo**),
modelo, se foi mock, ferramentas chamadas, ações, latência e tokens. Custo
estimado por tabela de preços por milhão de tokens.

## 6.6 Provedor de LLM — estado atual

| Item | Valor |
|---|---|
| Provider configurado | `bedrock` (Amazon Bedrock), região `us-east-1` |
| Modelo do agente | `us.anthropic.claude-sonnet-4-6` |
| Modelo barato (coach, redator) | `us.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Teto diário | USD 1,00 |
| Circuit breaker | 3 falhas consecutivas → degrada por 600 s |

⚠️ **Detalhe técnico não trivial:** modelos recentes da Bedrock **não aceitam
invocação on-demand** por `anthropic.<modelo>` — exigem *inference profile*
(prefixo `us.`). O código trata isso.

⚠️ **Estado honesto da validação:**

| Caminho | Validado com LLM real? |
|---|---|
| `/edubot/coach-message` | ✅ |
| `/edubot/recommendation` | ✅ (`mock:false`, `agent_decisions.mock=0`) |
| Redação de intervenção por caso | ✅ |
| **Loop de tool-use da OVA de reforço** | ⚠️ **Nunca com sucesso** — só o caminho de degradação foi exercitado |

A credencial em uso é **temporária (~12 h)** e está expirada. Com ela expirada,
todos os caminhos degradam para determinístico **sem erro visível ao usuário**.

> **Formulação segura para apresentação:** *"o loop de agente com ferramentas é
> real e é o mesmo código nos dois modos; o que está mockado é o modelo.
> Validamos o modelo real em dois dos quatro caminhos."*

---

# 7. A OVA personalizada de reforço

## 7.1 Como nasce

Dois gatilhos, ambos automáticos:

1. **Erro no quiz** — se o domínio da competência cai abaixo de **0,40**, cria
   uma intervenção convidando o aluno, já apontada para aquela competência.
2. **Conclusão de OVA** — avalia só as competências **daquele** OVA. É o que
   evita o desalinhamento que a auditoria apontou: terminar Cálculo com
   dificuldade gerava reforço de Nuvem (a competência mais fraca global).

**Cooldown de 7 dias** por competência: o aluno precisa de tempo para fazer o
reforço antes de ser chamado de novo.

> **Decisão de projeto:** a trilha **não** é gerada automaticamente no gatilho —
> só no clique do aluno. Gerar custa uma execução de agente; com LLM real seria
> custo por gatilho, sem garantia de uso. O que o gatilho faz é **chamar** o
> aluno com o alvo certo já decidido.

## 7.2 O pipeline

```
① listar_competencias_fracas    → diagnostica a competência
② listar_recursos_remediacao    → busca material, JÁ reordenado
                                   pelo formato que o aluno mais CONCLUI
③ listar_questoes_reforco       → busca questões da competência
④ criar_ova_personalizada       → valida e PERSISTE a trilha
⑤ texto de confirmação          → fecha o loop
```

## 7.3 Como a competência é escolhida

Ordenação por **menor domínio primeiro**; empate resolvido por **maior taxa de
erro**; empate remanescente pela ordem do banco (estável).

⚠️ **Viés verificado empiricamente:** como o fallback de uma competência nunca
tentada é `0` e o `P_INIT` do BKT é `0,20`, **uma competência jamais estudada é
diagnosticada como "mais fraca" à frente de uma em que o aluno errou tudo**
(0 < 0,17). O diagnóstico sem alvo explícito prioriza *lacuna de cobertura*
antes de *dificuldade demonstrada*.

Isso é mitigado no caminho principal: os gatilhos passam a competência-alvo
explícita. O botão livre da aba "Reforço" continua sujeito ao viés.

## 7.4 Ordenação da trilha

Três camadas, persistidas em `personalized_ova_item.position`:

1. **Recursos antes de questões** — sequência "estudar → verificar", garantida
   por construção, não pelo modelo.
2. **Formato preferido primeiro** — ordenação **estável**: só o recurso do
   formato preferido sobe; a ordem relativa dentro de cada grupo é preservada.
3. **A ordem pedida pelo modelo é respeitada** — a validação filtra, não
   reordena.

## 7.5 Preferência de formato

Derivada por **taxa de conclusão**, não por consumo (começar um vídeo ≠ aprender
com ele):

| Sinal | Peso |
|---|---|
| Conclusão por formato (`concluidos/total`) | Principal |
| Resposta a intervenções (aceita/melhorou, janela de 60 dias) | Desempate |
| Dificuldade confortável | Usado em outros caminhos |

**Guarda de confiança:** `confianca = min(1, concluídos/4)`. Abaixo de **0,40**
(menos de 2 conclusões), o sistema declara "sem preferência" e **preserva a
ordem do banco** — degradação segura, coberta por teste.

A preferência **influencia a ORDEM, não a SELEÇÃO** — filtrar por formato
empobreceria trilhas de competências com poucos recursos e criaria bolha.

## 7.6 Tamanho e limitações

Com o acervo atual, a trilha típica tem **4 a 10 itens** (mediana 6):
todos os recursos + todas as questões da competência-alvo. Não há top-*k*.

⚠️ **Não há deduplicação de conteúdo já consumido.** Um vídeo já assistido pode
reaparecer, e **as questões do reforço são as mesmas do quiz que o aluno acabou
de errar** — efeito agravado nas competências com apenas 2 questões (§13).

Sem conteúdo válido, a rota devolve **HTTP 422** — nunca uma trilha vazia. Não
há fallback para outra competência, e **não há geração de conteúdo pela LLM**:
o agente é curador do acervo, nunca autor.

---

# 8. Quiz

## 8.1 Correção no servidor

Há **um único ponto de correção**, compartilhado pelo quiz do módulo e pelo quiz
da trilha de reforço:

```python
selected = str(payload.get("selected", "")).strip().lower()
is_correct = selected == str(question.answer).strip().lower()
```

O gabarito **nunca sai do servidor**. Antes (bug herdado), a correção acontecia
no navegador contra um atributo `data-correct` no DOM — o gabarito estava
visível no HTML e o resultado era forjável.

**Idempotência:** reenviar uma resposta já correta não cria nova tentativa. O
front reenviava todas as questões a cada clique em "Verificar", o que dobrava a
taxa de erro.

## 8.2 O que uma resposta dispara

Além da correção, na mesma rota — todos *best-effort*, nenhum quebra a correção:

`atualiza o BKT` · `aplica revisão espaçada` · `emite evento com tempo de
resposta` · `avalia proatividade` · `dispara gatilho de reforço` · `concede XP e
verifica conquistas`

## 8.3 Gate de liberação

O quiz do módulo só abre após o aluno ler `ova.quiz_gate_perc`% do conteúdo.
Validado **no backend** em duas camadas (listagem e correção) — não é só
esconder o botão. Devolve 403 com `{gate, perc}` para o front explicar o motivo.

## 8.4 Pool adaptativo

As questões são filtradas e ordenadas para a **zona proximal**:

| Domínio da competência | Teto de dificuldade |
|---|---|
| ≥ 0,80 (domina) | 3 — inclui difíceis |
| < 0,80 | 2 — fácil + média |

Ordenação por dificuldade ascendente. **Degradação segura:** se tudo for
filtrado, devolve o pool original — nunca um quiz vazio. Um override por aluno
(`student_difficulty`) tem precedência quando existe.

**Modo desafio:** só questões difíceis de competências **dominadas** (≥ 0,80).
Sem material → 403 `challenge_locked`.

⚠️ O quiz da trilha de reforço **não** passa pelo pool adaptativo nem pelo gate —
serve as questões na ordem persistida.

---

# 9. Camadas de apoio

## 9.1 Revisão espaçada (SM-2 simplificado)

Agenda automática quando o domínio atinge 0,80. Acerto na data → intervalo ×
*ease* (teto 60 dias); erro → volta a 1 dia, *ease* −0,2 (piso 1,3). A varredura
diária marca vencidas e cria a intervenção "hora de revisar X".

## 9.2 Gamificação

**XP mede esforço, não nota** — concluir módulo, revisar em dia, voltar no dia
seguinte, perguntar ao tutor. Dominar competência vira **conquista pessoal**,
invisível no ranking. Um aluno com dificuldade pode vencer a semana.

Anti-farm por construção: XP só no servidor, dedup por (aluno, regra, objeto,
dia) e tetos. Sequência com escudo (1 por semana ISO). Ranking **opt-in**, com
apelido protegido contra colisão no curso. A camada inteira é desligável por
variável de ambiente.

## 9.3 Metas semanais

Sugestão idempotente por (aluno, semana, tipo); progresso derivado dos eventos
de XP (fonte única). Meta sugerida que o aluno cumpre sem aceitar também premia —
o esforço aconteceu.

## 9.4 Companheiro de estudo

Personagens 3D **procedurais** construídos em código (three.js), 100% offline.

⚠️ **Ready Player Me foi avaliada e descartada** — o domínio está bloqueado na
rede do projeto. Não há uma linha de RPM no produto.

O avatar deixou de ser recompensa e virou **companheiro**: livre para todos,
persistido no servidor, presente em toda a jornada. É clicável e abre um menu de
ações. Fallback 2D automático se o WebGL falhar. O three.js é carregado **lazy**
— quem usa o mascote padrão nunca o baixa.

A eficácia do próprio companheiro é medida (`companion_*` são verbos de evento e
o painel do professor tem um bloco de engajamento) — *critério honesto para
manter ou ajustar*.

## 9.5 Voz, i18n e acessibilidade

- **Voz:** AWS Polly quando credenciado, com fallback para Web Speech API do
  navegador. Cache em disco. Lip-sync por oscilação — **não fonético**, porque a
  Web Speech API não expõe o áudio.
- **i18n:** conteúdo traduzido **no banco** (nomes de OVA, competências, títulos
  e as 32 questões), servido por `?lang=`, com fallback PT.
- **Acessibilidade:** foco visível global, `aria-live` em toasts e balões,
  navegação por teclado.

## 9.6 Tutor de IA ancorado

O leitor extrai o texto do OVA e o injeta no contexto do tutor, que responde
**estritamente sobre o conteúdo que o aluno consumiu** — ancoragem barata, sem
banco vetorial.

---

# 10. Painéis

## 10.1 Aluno

"Meu Desempenho": domínio por competência e por assunto, acertos/erros, XP,
nível, sequência, conquistas, metas, revisões agendadas e o coach com avatar.
Caixa de intervenções não lidas com ação de gerar reforço e dispensar.

## 10.2 Professor

Escore de risco que combina **cinco sinais**, cada um com teto independente:

| Sinal | Peso |
|---|---|
| Erra muito no quiz | 30 |
| Sumiu (inatividade) | 30 |
| Está esquecendo (domínio em queda) | 25 |
| Acumula revisões vencidas | 15 |
| Não consome material | 15 |

**Limiar de risco: 40.** Saturações: 10 dias sem acesso, 5 revisões vencidas,
consumo abaixo de 40%. A taxa de erro só conta acima de **0,30** — errar um
pouco é aprender.

> **O painel devolve os COMPONENTES, não só o total.** Um número sozinho não
> ajuda o professor a agir: "sumiu" e "está errando" exigem intervenções
> diferentes.

Também: mapa de calor turma × competência, detalhe por aluno, "onde a turma
trava" neste OVA (seção com mais tempo e releituras) e **fila de aprovação** de
ações do agente.

## 10.3 Gestor

Consumo médio, desempenho por assunto, e **lacunas de cobertura do acervo** —
o sistema denuncia a própria limitação (§13).

---

# 11. Banco de dados

**29 tabelas** em MySQL 8.4, **19 migrations idempotentes**
(`migration_001` … `020`; a 013 foi reservada e não usada).

| Grupo | Tabelas |
|---|---|
| **Identidade e currículo** (herdadas) | `students` · `courses` · `course_subjects` · `offerings` · `competencies` · `ovas` · `questions` · `resources` |
| **Comportamento** | `interactions` · `ova_progress` · `ova_section_progress` · `resource_progress` · `attempts` · `answers` · `learning_events` |
| **Modelo do aluno** | `student_mastery` · `student_mastery_history` · `student_difficulty` · `review_schedule` |
| **Agente e governança** | `interventions` · `alerts` · `agent_decisions` · `personalized_ova` · `personalized_ova_item` · `consents` |
| **Gamificação** | `xp_events` · `student_streak` · `student_achievements` · `weekly_goals` |

## 11.1 Performance

O perfil do aluno (`/student/me`) foi reescrito de loops N+1 para agregações SQL:
**~31 → ≤ 8 queries**, com regressão travada por teste
(`assert counter.count <= 8`) e o contrato de saída garantido por *golden
snapshot* campo a campo.

Importa porque o perfil é chamado com frequência — a cada 10% de vídeo assistido,
por exemplo.

---

# 12. Governança e LGPD

Quatro finalidades, com *enforcement* **no backend**, não na interface:

| Finalidade | Base | Padrão |
|---|---|---|
| `tracking_pedagogico` | Execução de contrato educacional — informado, **não** opcional | Concedido |
| `ia_sobre_dados` | **Opt-in revogável** | Negado |
| `imagem_voz` | Opt-in revogável | Negado |
| `ranking_turma` | Opt-in revogável | Negado |

**O que isso significa na prática:**

- **Sem `ia_sobre_dados`**: o texto das perguntas ao tutor é gravado com
  `text: None` (só metadados) e o agente roda **só regras e templates, sem
  chamar a LLM**.
- **`agent_decisions.input_digest` é minimizado por contrato**: primeiro nome e
  métricas; **nunca RA nem nome completo**.
- **`tracking_pedagogico` não pode ser revogado** — é condição do serviço; a
  revogação é ignorada e registrada como concedida.
- Existe canal do titular: `POST /student/me/delete-request`.

⚠️ **Decisão pendente:** política de **retenção** de `learning_events`, a tabela
que cresce sem teto. Já registrada como pendência no projeto.

---

# 13. Acervo de conteúdo

| Entidade | Quantidade |
|---|---:|
| Cursos | 1 — Engenharia de Computação |
| Assuntos | 3 |
| Competências | **9** |
| OVAs (módulos) | **4** |
| Questões | **32** |
| Recursos | **39** |
| Alunos semeados | **500** |

**Disciplinas:** Computação Quântica (competências 1–3) · Cálculo (4–6) ·
Fundamentos de Computação na Nuvem (7–9). A heterogeneidade é proposital:
permite comparar conteúdo conceitual com procedimental.

**Recursos por tipo:** 16 vídeos · 15 textos · 4 podcasts · 4 quizzes ·
4 atividades. O banco de remediação tem 1 vídeo + 1 texto por competência, com
fontes externas reais (IBM, AWS, Azure, Khan Academy, 3Blue1Brown, Wikipedia).

## 13.1 Como o conteúdo é cadastrado

**Manualmente, via SQL.** Não há tela de upload nem classificador automático. A
coluna `resources.competency_id` é o que torna `resources` um banco consultável
por assunto pelo agente — recursos genéricos (`quiz`, `atividade`) ficam com
`NULL` e nunca entram numa trilha.

A plataforma **guarda URLs, não arquivos**: o par (`resource_url`, `media_type`)
abstrai a hospedagem — `youtube`, `upload`, `link` ou `NULL`.

## 13.2 Lacuna de cobertura, medida pelo próprio sistema

Invariante: **mínimo 3 questões e 2 formatos** por competência.

⚠️ As competências **7, 8 e 9** (módulo de Nuvem) têm apenas **2 questões** cada
— abaixo do mínimo em que o BKT converge bem e em que o reforço consegue não
repetir as questões que o aluno acabou de errar. Todas passam no critério de
formatos.

O serviço de cobertura **reporta, não corrige**: produzir as questões que faltam
é trabalho editorial.

---

# 14. Estado atual verificado

| Métrica | Valor | Como verificar |
|---|---|---|
| **Testes automatizados** | **258, todos passando, 2,74 s** | `cd Back-End && python -m pytest` |
| Evolução da suíte | 0 (upstream) → 42 → 67 → 103 → 123 → 137 → 160 → 174 → 189 → 207 → 222 → 256 → **258** | `LOG_EXECUCAO.md` |
| Arquivos de teste | 40 | |
| Queries do perfil | **~31 → ≤ 8**, travado por teste | `test_profile_contract.py` |
| Blueprints / endpoints | **17 / 51** | contagem no código |
| Tabelas / migrations | **29 / 19** | |
| Módulos de serviço / agente | 18 / 11 | |
| Arquivos do frontend | 58 | |
| Bundle inicial | ~62 kB gzip (three.js lazy) | |
| IA real validada | **2 de 4 caminhos** | `LOG_EXECUCAO.md` 09/jul |

---

# 15. Integração com o Canvas

Estudada em profundidade; **não implementada**. Resumo:

**Hoje** o Canvas do SENAI CIMATEC guarda apenas **um link** para OVAs
hospedados fora — o aluno clica, sai do Canvas e desaparece do radar.

**A proposta** é substituir o link por uma **ferramenta LTI 1.3** (padrão aberto
da 1EdTech): o OVA abre **dentro** do Canvas, com o aluno **já autenticado**,
enquanto o EduBot mede o engajamento e **devolve nota ao diário** via AGS.

**Por que é viável aqui:** a sessão é por token Bearer (compatível com iframe),
a função que emite o token já é independente do login, `cryptography` já é
dependência, a correção é server-side e a camada de consentimento já existe.
**Nenhum dos 51 endpoints precisa mudar.**

**Esforço:** ~2 semanas. **O gargalo é institucional**, não técnico: exige uma
Developer Key criada por administrador da conta raiz do Canvas.

📄 Detalhamento: [INTEGRACAO_CANVAS_EDUBOT.md](INTEGRACAO_CANVAS_EDUBOT.md) ·
resumo de uma página: [ONEPAGER_REUNIAO.md](ONEPAGER_REUNIAO.md)

---

# 16. Limitações conhecidas

Lista honesta, útil tanto para o paper quanto para planejamento.

1. **Acervo pequeno e curado à mão** — 9 competências, 32 questões, 39 recursos.
   Três competências reprovam no próprio invariante de cobertura.
2. **Classificação por competência é manual** — trabalho editorial humano. É o
   gargalo real da expansão.
3. **Sem dados de uso real** — o seed começa do zero. Estatísticas exigem
   execução instrumentada.
4. **Loop de tool-use com LLM real não validado ponta a ponta** (§6.6).
5. **Diagnóstico sem alvo explícito prioriza lacuna sobre dificuldade** (§7.3).
6. **A trilha não deduplica conteúdo já consumido** (§7.6).
7. **Parâmetros do BKT são valores clássicos de literatura, não calibrados** com
   os dados desta plataforma. O mesmo vale para os pesos do escore de risco —
   o código declara isso explicitamente como calibração pedagógica.
8. **Sem cobertura de teste medida e sem benchmark de latência.** `pytest-cov`
   não está instalado. O campo `agent_decisions.latency_ms` existe, mas a série
   não foi coletada.
9. **Desempate de competências é determinístico na prática, não por contrato** —
   falta `ORDER BY` explícito na query de origem.
10. **Lip-sync não é fonético** — a Web Speech API não expõe o áudio.
11. **Single-tenant** — assume uma instituição, um curso.
12. **Retenção de eventos não definida** (§12).

---

# 17. Índice da documentação

## ✅ Atuais — use como referência

| Arquivo | Para quê |
|---|---|
| **Este documento** | Arquitetura e funcionamento — visão completa |
| [REGRAS_DE_NEGOCIO_E_FLUXO_DO_ALUNO.md](REGRAS_DE_NEGOCIO_E_FLUXO_DO_ALUNO.md) | Como funciona, em linguagem não técnica: 5 fluxogramas, catálogo de dados e de regras, painel de parâmetros |
| [FLUXOGRAMA_CAMINHO_DO_ALUNO.md](FLUXOGRAMA_CAMINHO_DO_ALUNO.md) | A jornada em um diagrama (+ .png e .pdf) |
| [RESPOSTAS_PAPER.md](RESPOSTAS_PAPER.md) | Arquitetura verificada contra o código, formato Q&A, para publicação |
| [COMO_O_RASTREIO_FUNCIONA.md](COMO_O_RASTREIO_FUNCIONA.md) | A tecnologia do rastreio explicada do zero: token, sensores do navegador, `fetch` com `keepalive`, soma no SQL |
| [PLANO_RASTREABILIDADE.md](PLANO_RASTREABILIDADE.md) | Especificação do rastreamento: contratos de eventos e payloads |
| [INTEGRACAO_CANVAS_EDUBOT.md](INTEGRACAO_CANVAS_EDUBOT.md) | Integração com o Canvas — dossiê completo |
| [RASTREIO_DENTRO_DO_CANVAS.md](RASTREIO_DENTRO_DO_CANVAS.md) | Canvas — o que acontece com a telemetria dentro do iframe (e a armadilha do `frameResize`) |
| [ONEPAGER_REUNIAO.md](ONEPAGER_REUNIAO.md) | Canvas — resumo de uma página |
| [ROTEIRO_DEMO_RESUMO.md](ROTEIRO_DEMO_RESUMO.md) | Roteiro de demonstração, 8–10 min, 3 personas |
| [COMO_RODAR_COM_CLAUDE.md](COMO_RODAR_COM_CLAUDE.md) | Do zero até a plataforma no ar |
| [COMO_ADICIONAR_CONTEUDO.md](COMO_ADICIONAR_CONTEUDO.md) | Cadastro de conteúdo via SQL (mecanismo inalterado) |
| [PLANO_CORRECOES_PENDENTES.md](PLANO_CORRECOES_PENDENTES.md) | O que ficou em aberto |
| [LOG_EXECUCAO.md](LOG_EXECUCAO.md) | O **porquê** de cada decisão, cronológico. Não se lê inteiro — busca-se nele |

## ⚠️ Desatualizados — histórico, não referência

**10 arquivos citam `Back-End/edubot_agent/`, caminho que não existe** desde a
reorganização no pacote `Back-End/edubot/` (o agente vive em `edubot/agent/`):

`README.md` · `ANALISE.md` · `ALTERACOES_EDUBOT.md` · `AUDITORIA_TECNICA.md` ·
`COMO_TESTAR_PLATAFORMA.md` · `DADOS_E_AGENTE.md` · `IA_AWS_SETUP.md` ·
`OVA_PERSONALIZADA.md` · `REQUISITOS_E_BACKLOG.md` · `TUTOR_AVATAR_VIRTUAL.md`

Dois deles (`COMO_TESTAR_PLATAFORMA.md`, `IA_AWS_SETUP.md`) afirmam que **o
Bedrock não está ligado** — o `.env` está configurado com `provider=bedrock` e a
IA real já foi validada em dois caminhos.

🔴 **O caso mais grave é o `README.md`** — o primeiro arquivo que qualquer pessoa
nova abre. Ele manda clonar o repositório errado, descreve um pacote que não
existe, diz que a chamada real ao Bedrock não está conectada e descreve dois
frontends coexistindo (o clássico foi aposentado).

**Ainda valiosos como registro histórico:**

| Arquivo | Valor |
|---|---|
| `AUDITORIA_TECNICA.md` | O melhor mapa de arquitetura do repositório — mas é o retrato do **"antes"** (03/07), feito para justificar a refatoração |
| `PLANO_EXECUCAO.md` 1–5 | Os planos que foram executados; o resultado está no `LOG_EXECUCAO.md` |
| `GUIA_GRAVACAO_*`, `NOVIDADES_DESDE_GRAVACAO.md` | Material de gravação, referente a estados anteriores |
| `RELATORIO_ALTERACOES.md` | Correção de infraestrutura de mai/2026, anterior ao EduBot Track |
| `CHANGES.md`, `PROJETO.md` | Primeiros documentos do projeto |

---

*Documento gerado em 13/09/2026 a partir de inspeção direta do código e execução
da suíte de testes.*
