# EduBot Track — Dados do aluno, capacidades da plataforma e integração com LLM

> Documentação de referência: **o que a plataforma capta**, **em que formato os
> dados são exportados** e **como funcionará quando a API de uma LLM real for
> conectada ao agente**.
> Complementa: [ANALISE.md](ANALISE.md) (arquitetura) e
> [ALTERACOES_EDUBOT.md](ALTERACOES_EDUBOT.md) (mudanças + como rodar).

---

## 1. Visão geral do pipeline de dados

```
┌─────────────────┐   eventos JS    ┌──────────────┐   SQL    ┌──────────┐
│ Frontends       │ ──────────────▶ │ API Flask    │ ───────▶ │ MySQL    │
│ (clássico e     │  scroll, play,  │ (porta 5010) │          │ 8 tabelas│
│  React /app)    │  pause, quiz... │              │          │ de dados │
└─────────────────┘                 └──────┬───────┘          └────┬─────┘
                                           │                       │
                              GET /student/me  ◀──── student_context.py
                                           │   (perfil JSON consolidado)
                                           ▼
                                    edubot_agent  ──▶  LLM (hoje: mock;
                                           │           futuro: Bedrock/Claude)
                                           ▼
                                  recomendação estruturada
                                  (persistida em `interventions`)
```

O ponto central é o **perfil consolidado** montado por
[Back-End/api/services/student_context.py](Back-End/api/services/student_context.py):
tudo que a plataforma sabe sobre um aluno sai por ali, no mesmo formato, para
três consumidores — o dashboard do aluno, o endpoint de exportação e o agente
de IA.

---

## 2. O que a plataforma capta (evento → dado persistido)

### 2.1 Identidade e sessão

| Dado | Quando é captado | Onde persiste | Tipo |
|------|------------------|---------------|------|
| RA, nome, curso, perfil (aluno/admin) | Cadastro (seed `dml.sql`) | `students` | `varchar`/`bool` |
| Login (quem está logado) | `POST /login` → token HMAC com `student_id` e expiração (7 dias) | — (token assinado, stateless) | string `base64.payload + hmac` |

### 2.2 Leitura de conteúdo (texto do OVA)

| Dado | Quando é captado | Onde persiste | Tipo |
|------|------------------|---------------|------|
| Tempo de leitura (s) | Contador no `ova.js` (1s em 1s), sincronizado a cada 15s e em cada checkpoint | `ova_progress.read_time` | `int` (segundos) |
| % de scroll máximo | Evento de scroll da página do OVA | `ova_progress.perc_scrolled` | `int` 0–100 |
| OVA concluído | Scroll ≥ 90% | `ova_progress.completed` | `bool` |
| Último acesso | Em todo upsert de progresso | `ova_progress.last_access` | `datetime` |
| Checkpoints de leitura (20/40/60/80/100%) | Aluno atinge o ponto com tempo mínimo | `interactions.student_action` (texto) | `text` + `date` + `time` |

### 2.3 Mídia (vídeo e podcast) — por recurso individual

| Dado | Quando é captado | Onde persiste | Tipo |
|------|------------------|---------------|------|
| % de vídeo assistido | Checkpoints de 10% (YouTube IFrame API ou `<video>` HTML5) | `resource_progress.perc_consumed` | `int` 0–100 |
| Tempo real de escuta do podcast | 1s por segundo com áudio tocando (pause não conta), reportado a cada 10s/pause/fim | `resource_progress.seconds_consumed` | `int` (segundos) |
| Mídia concluída | ≥ 90% do vídeo, fim do áudio, ou ≥ 90% da duração ouvida | `resource_progress.completed` | `bool` |
| Atividade prática concluída | Botão "Marcar como concluída" | `resource_progress.completed` | `bool` |

> Os valores só andam **para frente** (a API grava `max(antigo, novo)`), então
> recarregar a página ou abrir uma aba antiga não regride o progresso.

### 2.4 Avaliação (quiz)

| Dado | Quando é captado | Onde persiste | Tipo |
|------|------------------|---------------|------|
| **Toda tentativa** (certa ou errada), com a questão e o momento | `POST /question/answer` — a alternativa escolhida é corrigida **no servidor** | `attempts` (`is_correct`, `attempt_time`) | `bool` + `datetime` |
| Primeira resposta correta por questão | Idem (dedup por aluno×questão) | `answers` | FK aluno×questão |
| Competência associada ao acerto/erro | Via `questions.competency_id` | derivado em consulta | — |

### 2.5 Interações granulares (telemetria de engajamento)

Cada uma vira uma linha em `interactions` (data, hora, descrição textual):
abertura de acordeão, navegação em carrossel, clique em "verificar questão",
checkpoint de leitura, checkpoint de vídeo, escuta de podcast, conclusão de
atividade. É a série temporal bruta usada para calcular **dias sem acesso**.

### 2.6 Intervenções do agente

| Dado | Quando | Onde persiste | Tipo |
|------|--------|---------------|------|
| Tipo, mensagem e data de cada recomendação do EduBot | A cada `GET /edubot/recommendation` | `interventions` (`type`, `description`, `date`, `result`) | `varchar`/`text`/`date` |

### 2.7 O que **não** é captado hoje

- Identificadores sensíveis além de RA/nome (sem e-mail, CPF, foto etc.)
- Conteúdo digitado livremente pelo aluno (não há campos de texto livre persistidos)
- Localização, dispositivo, IP (não são armazenados)

---

## 3. Métricas derivadas (calculadas no perfil, não armazenadas)

Calculadas em tempo real pelo `student_context.py` a partir das tabelas acima.
Os limiares ficam em constantes no topo do arquivo, fáceis de ajustar:

| Métrica | Cálculo | Limiar |
|---------|---------|--------|
| `dias_sem_acesso` | hoje − data da última linha em `interactions` | — |
| `percentual_consumido` | recursos consumidos ÷ recursos totais do curso | — |
| `preferencia_formato` | tipo (video/podcast/texto) com mais recursos consumidos | — |
| `taxa_erro` do quiz | erros ÷ tentativas em `attempts` | — |
| `atividades_pendentes` | OVAs com progresso registrado e `completed = false` | — |
| Status de competência | acertos ÷ questões da competência | 0 = **não iniciada** · >0 = **em desenvolvimento** · ≥80% = **desenvolvida** (`COMPETENCY_DEVELOPED_RATIO`) |
| Recurso "texto" consumido/concluído | scroll do OVA | >0% / ≥80% (`TEXT_CONSUMED_PERC`) |
| Mídia concluída | % assistido/ouvido | ≥90% (`MEDIA_COMPLETED_PERC`) |

---

## 4. Como os dados são exportados

### 4.1 `GET /student/me` — o perfil completo (formato canônico)

Endpoint autenticado (`Authorization: Bearer <token>`); devolve **somente os
dados do aluno dono do token**. É exatamente este JSON que: alimenta o
dashboard React, é baixado pelo botão **"Exportar JSON"** (aba Tutor IA) e é
**a entrada do agente de IA**.

Exemplo real (capturado da plataforma em execução, encurtado):

```json
{
  "estudante": {
    "student_id": 1,
    "nome": "Eduardo",
    "ra": "1",
    "curso": "Engenharia de Computação"
  },
  "dias_sem_acesso": null,
  "recursos": {
    "total": 16,
    "consumidos": 3,
    "percentual_consumido": 19,
    "por_tipo": {
      "texto":     { "total": 3, "consumidos": 1, "concluidos": 0 },
      "video":     { "total": 4, "consumidos": 1, "concluidos": 0 },
      "podcast":   { "total": 3, "consumidos": 0, "concluidos": 0 },
      "quiz":      { "total": 3, "consumidos": 1, "concluidos": 1 },
      "atividade": { "total": 3, "consumidos": 0, "concluidos": 0 }
    }
  },
  "preferencia_formato": "video",
  "quiz": { "tentativas": 2, "erros": 0, "taxa_erro": 0.0 },
  "atividades_pendentes": 1,
  "ovas": [
    {
      "ova_id": 1,
      "ova_name": "Computação Quântica",
      "link": "quantum_computing.html",
      "read_time": 300,
      "perc_scrolled": 45,
      "completed": false,
      "recursos": [
        {
          "resource_id": 2,
          "titulo": "Vídeo: Introdução à Computação Quântica",
          "tipo": "video",
          "url": "https://www.youtube.com/watch?v=7NWN3wivxhA",
          "media_type": "youtube",
          "perc_consumido": 50,
          "segundos_consumidos": 120,
          "consumido": true,
          "concluido": false
        }
      ]
    }
  ],
  "competencias": [
    {
      "competency_id": 1,
      "nome": "Compreender os princípios fundamentais da computação quântica",
      "acertos": 1,
      "total_questoes": 3,
      "status": "em desenvolvimento"
    }
  ],
  "historico_intervencoes": [
    {
      "data": "2026-06-12",
      "tipo": "trilha_minima",
      "descricao": "Eduardo, você consumiu 19% dos recursos disponíveis...",
      "resultado": "pendente"
    }
  ]
}
```

Dicionário dos campos:

| Campo | Tipo | Significado |
|-------|------|-------------|
| `estudante.*` | obj | Identificação: id interno, nome, RA, curso |
| `dias_sem_acesso` | `int \| null` | Dias desde a última interação (`null` = interagiu hoje ou nunca) |
| `recursos.total/consumidos/percentual_consumido` | `int` | Consumo agregado de todos os recursos do curso |
| `recursos.por_tipo.<tipo>` | obj | Consumo segmentado: texto, video, podcast, quiz, atividade |
| `preferencia_formato` | `"video" \| "podcast" \| "texto" \| null` | Formato com maior engajamento |
| `quiz.tentativas/erros/taxa_erro` | `int`/`float\|null` | Desempenho avaliativo agregado |
| `atividades_pendentes` | `int` | OVAs acessados e não concluídos |
| `ovas[]` | array | Progresso por OVA: leitura (s), scroll (%), conclusão e recursos |
| `ovas[].recursos[]` | array | Estado de cada recurso: % consumido, segundos, consumido/concluído, URL e tipo de mídia |
| `competencias[]` | array | Por competência do curso: acertos, total de questões, status (`não iniciada` / `em desenvolvimento` / `desenvolvida`) |
| `historico_intervencoes[]` | array | Últimas 10 recomendações do EduBot (tipo, mensagem, data, resultado) |

### 4.2 Outras saídas

| Saída | Quem usa | Conteúdo |
|-------|----------|----------|
| `GET /student/report/<id>` | Legado/relatório | Agregado alternativo (dias sem acesso, média de quizzes 0–5, erros frequentes por tópico, módulo recente) |
| `POST /plot/*` | Dashboards Plotly (admin e aluno) | Desempenho por competência, por curso, por OVA e contagem de interações |
| Botão **Exportar JSON** (aba Tutor IA do app React) | Aluno/professor | Download do `/student/me` como arquivo `perfil-<RA>.json` |
| Acesso direto ao MySQL (porta 3310) | Análises ad-hoc | Todas as tabelas brutas |

---

## 5. O que a plataforma consegue fazer hoje

1. **Rastrear a jornada completa do aluno**: o que leu (tempo + % de scroll por
   OVA), o que assistiu (% por vídeo), o que ouviu (segundos por podcast), o
   que praticou (atividades concluídas) e como foi avaliado (toda tentativa de
   quiz, certa ou errada, com timestamp).
2. **Medir competências**: status automático por competência a partir dos
   acertos nas questões vinculadas a ela.
3. **Inferir comportamento**: dias de inatividade, formato de conteúdo
   preferido, pendências de conclusão.
4. **Visualizar**: dashboard do aluno (React em `/app/` e `painel.html`
   clássico) e dashboards do coordenador (Plotly).
5. **Recomendar**: o agente EduBot aplica 6 regras pedagógicas sobre o perfil e
   devolve uma intervenção estruturada, que fica registrada no histórico.
6. **Exportar**: tudo acima em JSON autenticado, pronto para outros sistemas.

---

## 6. O agente de IA — como funciona hoje e como ligar a LLM real

### 6.1 Arquitetura (já pronta para a troca)

```
GET /edubot/recommendation (autenticado)
  └─ build_student_profile(aluno)        # perfil da seção 4.1
       └─ edubot_agent.get_recommendation(profile)
            ├─ prompt.py: build_system_prompt() + build_user_prompt(profile)
            ├─ cliente.invoke_model(...)  ◀── HOJE: BedrockClientMock
            │                                 FUTURO: boto3 / Anthropic SDK
            └─ json.loads(resposta.content[0].text) → recomendação
  └─ Interventions.create(...)            # registra no histórico
```

O desenho foi feito para que **ligar a LLM real não mude nada fora de
[Back-End/edubot_agent/agent.py](Back-End/edubot_agent/agent.py)**:

- O **prompt definitivo já está escrito e parametrizado** em
  [Back-End/edubot_agent/prompt.py](Back-End/edubot_agent/prompt.py) — system
  prompt com as 6 regras de decisão (com limiares injetados da constante
  `RULES`) e user prompt com o perfil JSON do aluno embutido.
- O **mock responde no envelope exato da Anthropic Messages API** (mesmo
  formato que o Bedrock devolve), então o código de parsing já é o definitivo.
- O **contrato de saída** é validado pelo frontend e pela persistência:

```json
{
  "tipo": "plano_retomada | trilha_minima | revisao_alternativa | checklist_execucao | aprofundamento | recomendacao_formato",
  "prioridade": "alta | media | baixa",
  "titulo": "...",
  "mensagem_aluno": "... (dirigida ao aluno pelo nome)",
  "acoes": ["passo 1", "passo 2"],
  "formato_preferido": "video | texto | podcast | null",
  "justificativa": "... (qual regra disparou — para o professor)"
}
```

### 6.2 As 6 regras de decisão (em ordem de prioridade)

| # | Condição no perfil | Recomendação |
|---|--------------------|--------------|
| 1 | `dias_sem_acesso > 7` | Plano de retomada |
| 2 | `recursos.percentual_consumido < 40` | Trilha mínima |
| 3 | `quiz.taxa_erro > 0.5` | Revisão com explicação alternativa |
| 4 | `atividades_pendentes > 0` (com consumo registrado) | Checklist de execução |
| 5 | Alguma competência com status `desenvolvida` | Aprofundamento/desafio |
| 6 | Sempre, com base em `preferencia_formato` | Próximos OVAs no formato preferido |

Hoje o **mock executa essas regras em Python** (para gerar respostas realistas
e determinísticas). Quando a LLM entrar, **as regras passam a ser decididas
pelo modelo** — elas já estão descritas no system prompt — e o motor Python
pode ser mantido como *fallback* se a API falhar.

### 6.3 Passo a passo para conectar a LLM real

**Opção A — AWS Bedrock (Claude Sonnet), o caminho planejado:**

1. `pip install boto3` (adicionar a `Back-End/requirements.txt`).
2. Credenciais AWS no ambiente do container `ova_flask` (no `compose.yaml`):
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` — e habilitar o
   modelo no console do Bedrock.
3. Em `agent.py`, substituir o cliente (o esqueleto já está comentado no fim
   do arquivo):

```python
import boto3

class BedrockClient:
    def __init__(self):
        self._client = boto3.client("bedrock-runtime")

    def invoke_model(self, model_id, system_prompt, user_prompt, profile):
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        })
        resp = self._client.invoke_model(modelId=model_id, body=body)
        return json.loads(resp["body"].read())   # mesmo envelope do mock

_client = BedrockClient()   # era: BedrockClientMock()
```

4. Nada mais muda: `get_recommendation()` já monta os prompts, já faz
   `json.loads(response["content"][0]["text"])` e a rota já persiste em
   `interventions`. O `model_id` alvo está na constante `BEDROCK_MODEL_ID`.

**Opção B — API da Anthropic direto (sem AWS):** mesmo ponto de troca; usar o
SDK `anthropic` (`client.messages.create(model=..., system=..., messages=...)`),
cuja resposta já vem no mesmo formato de envelope (`content[0].text`).

### 6.4 O que a LLM vai receber e devolver (fluxo em produção)

1. Aluno (ou um job agendado) aciona `GET /edubot/recommendation`.
2. Backend monta o **perfil completo** (seção 4.1) — só dados pedagógicos;
   o único dado pessoal enviado é o **primeiro nome** (para personalizar a
   mensagem).
3. System prompt (regras) + user prompt (perfil JSON) vão para o modelo.
4. O modelo devolve **somente o JSON** do contrato 6.1 (instrução explícita no
   prompt).
5. O backend parseia, marca `mock: false`, persiste em `interventions` e
   devolve ao frontend, que mostra a mensagem, o plano de ação e a justificativa.

### 6.5 Recomendações para a virada (checklist)

- [ ] **Validar o JSON da LLM** antes de persistir (campos obrigatórios do
      contrato; em caso de parse inválido, repetir a chamada 1x e depois cair
      no motor de regras local como fallback).
- [ ] **Tratar erro/timeout** da API (try/except em volta do `invoke_model`,
      devolvendo a recomendação do mock com `"mock": true` se a LLM falhar).
- [ ] **Privacidade**: o perfil não contém senha nem RA no prompt? Hoje o RA
      vai junto no JSON do perfil — remova-o de `build_user_prompt` se a
      política da instituição exigir (basta filtrar o dicionário antes do
      `json.dumps`).
- [ ] **Custo/limite**: perfil típico ≈ 1–2k tokens de entrada + ~300 de saída
      por recomendação; considere cache (ex.: no máximo 1 recomendação nova por
      aluno/dia) — o histórico em `interventions` já permite checar a última data.
- [ ] **Auditoria**: o campo `message_id`/`model_id` retornado já é persistível
      caso queiram rastrear cada chamada.

---

### 6.6 Segundo modo do agente: tool-use para montar a OVA personalizada

Além da recomendação de uma chamada só (`GET /edubot/recommendation`, descrita
acima), o EduBot ganhou um modo **agente com tool-use**: a partir do mesmo perfil,
ele decide em vários passos quais ferramentas chamar para **diagnosticar a
competência fraca, buscar conteúdo no banco e montar uma OVA de reforço**.

- O **erro por competência** (seção 3) agora vem no perfil por competência
  (`tentativas`/`erros`/`taxa_erro`), e é o sinal que escolhe o assunto a remediar.
- O **banco de conteúdo é classificado por competência** (`resources.competency_id`
  + `questions.competency_id`), o que o agente consulta via tools.
- O **loop de tool-use é real e definitivo**; só o modelo está mockado
  (`_MockAgentClient` devolve o envelope de tool-use da Anthropic). Ligar a LLM
  real = trocar o cliente em `edubot_agent/personalized.py`.

Detalhes completos (tools, schema, endpoints, frontends, como cadastrar conteúdo):
**[OVA_PERSONALIZADA.md](OVA_PERSONALIZADA.md)**.

---

## 7. Limitações conhecidas

- O tempo de leitura conta com a aba aberta (não detecta aba em segundo plano).
- O % de vídeo usa checkpoints de 10% — pulos do aluno dentro do vídeo contam
  como assistido se passarem pelos checkpoints.
- `interactions.student_action` é texto livre (telemetria legada) — boa para
  inatividade, ruim para agregações; os dados estruturados estão em
  `ova_progress`/`resource_progress`/`attempts`.
- Senhas em texto puro (herança do seed original) — ver pendências em
  [ALTERACOES_EDUBOT.md](ALTERACOES_EDUBOT.md).
