# Plano Técnico — Features faltantes para o roteiro (vídeo de 8 min)

Plano de implementação das features que ainda faltam para **filmar o roteiro
como está escrito** (`Proposta de Roteriro.docx`). Cada item traz: objetivo
(cena), arquitetura, arquivos/endpoints, frontend, bibliotecas, esforço e como
**encaixa no código que já existe**.

Convenções do projeto reaproveitadas:
- **Backend:** Flask + Peewee; rotas como *blueprints* em `Back-End/api/routes/`
  registradas em `api/api.py`; modelos em `Back-End/data/models/`; payload POST
  embrulhado em `[data]` (`request.get_json()[0]`); auth via `@require_auth` +
  `g.student`. DDL/DML em `Database/sql/` (`ddl_extra.sql`/`dml_extra.sql` para
  migrações incrementais) e SQLite de teste em `tools/init_test_db.py`.
- **IA:** camada única `edubot_agent/llm.py` (`mock|bedrock|anthropic`) — qualquer
  serviço novo de IA passa por ela. Credenciais AWS já fluem via `compose.yaml`.
- **Frontend:** React 18 + Vite + Tailwind; views em `src/components/`, troca de
  aba em `App.tsx`, navegação em `Sidebar.tsx`, cliente em `services/api.ts`,
  tokens de tema (`brand #604fd8`, `teal`, `coral`, `ink`, `muted`, `line`,
  `rounded-[8px]`, `shadow-soft`).

**Legenda de esforço:** 🟢 baixo · 🟡 médio · 🔴 alto.
**Depende da AWS?** marca o que precisa de credencial (Polly/Bedrock) vs. o que
pode ser feito offline.

---

## 1. Avatar do EduBot + Voz (TTS) + Lip-sync — 🔴 (Cenas 3 e 5)

A peça que mais falta. Estratégia: **2D leve + AWS Polly com *viseme speech
marks*** (a Polly devolve marcas de visema com timing, o que dá lip-sync real
sem ML pesado). Fallback offline: `speechSynthesis` do navegador (sem visemas).

### Backend
- `edubot_agent/voice.py` — cliente Polly **gated por env** (reusa `AWS_REGION`
  e credenciais da camada `llm.py`):
  - `synthesize(text, voice="Camila")` → `boto3.client("polly").synthesize_speech(...)`
    duas vezes: `OutputFormat="mp3"` (áudio) e `OutputFormat="json",
    SpeechMarkTypes=["viseme"]` (timeline de visemas).
  - Retorna `{ audio_b64, visemes: [{time_ms, value}] }`.
  - Provider por env: `EDUBOT_TTS_PROVIDER=polly|browser|off` (default `browser`
    para a app rodar sem AWS).
- Rota em novo blueprint `routes/voiceRoute.py`:
  - `POST /edubot/tts` `[{text, voice?}]` `@require_auth` → `{audio_b64, visemes, provider}`.
  - Registrar em `api/api.py` (`app.register_blueprint(app_voice)`).
- `requirements.txt`: `boto3` já entra via `anthropic[bedrock]`; nada novo.

### Frontend
- `src/components/avatar/Avatar.tsx` — personagem 2D (SVG ou **Rive**/Lottie)
  com:
  - **estados de expressão** por prop `mood`: `idle | happy | attentive`
    (mapear: parabéns→happy, revisão→attentive).
  - **boca dirigida por visema**: tocar o `audio` e, num `requestAnimationFrame`,
    selecionar a forma de boca pela timeline de visemas da Polly (mapa
    `p,t,S,f,k,i,r,s,u,@,a,e,E,o,O,sil` → ~8 formas).
  - fallback `browser`: `window.speechSynthesis` + boca por amplitude simples.
- `src/services/api.ts`: `getTts(text, voice?)`.
- `src/hooks/useEduBotVoice.ts`: orquestra texto→TTS→play→visemas→`mood`.
- **Integração:** colocar o `<Avatar>` (a) na aba **Tutor IA** (`Report.tsx`)
  falando a recomendação, e (b) como bolha no **OvaReader**. Botão
  "🔊 Ouvir do EduBot". O **texto** já vem pronto do motor de regras
  (`agent.py`) e do tutor — só passa para o avatar.

### Cena 5 (persona/voz de especialista) — roadmap
- Trocar Polly por **ElevenLabs** (voz clonada) num provider adicional em
  `voice.py` (`EDUBOT_TTS_PROVIDER=elevenlabs`), + "skins" de persona (system
  prompt + voz por persona). Para o vídeo, pode ser **conceitual/narrado**.

### Esforço: 🔴 · Depende da AWS: **parcial** (avatar/UI e fallback browser são offline; Polly precisa de credencial AWS — a mesma conta).

---

## 2. Papel de Tutor + Painel do Professor + Alertas — 🟡 (Cena 4)

### Modelo de dados
- **Papel:** adicionar coluna `role` em `students` (`'aluno' | 'tutor' | 'admin'`).
  - `Database/sql/ddl_extra.sql`: `ALTER TABLE students ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'aluno';`
  - `Database/sql/dml_extra.sql`: marcar 1–2 RAs como `tutor`.
  - `data/models/students.py`: `role = CharField(default="aluno")`.
  - `loginRoute.py`: incluir `role` no payload do `/login`.
- **Alertas:** `data/models/alerts.py` (`alert_id`, `student_id` FK, `type`,
  `message`, `severity`, `created_at`, `read`), + DDL em `ddl_extra.sql` e
  criação no `tools/init_test_db.py`.

### Backend — `routes/tutorRoute.py` (blueprint `app_tutor`, `@require_auth` + checagem de role)
- `GET /tutor/turma` → lista alunos do curso do tutor com KPIs agregados
  (consumo %, taxa de erro do quiz, dias sem acesso, nº de competências em
  risco). Reaproveita a lógica de `services/student_context.py`.
- `GET /tutor/aluno/<id>` → drill-down (já existe `/student/report/<id>` —
  reusar/migrar para require_auth).
- `GET /tutor/alerts` → alertas da turma (badge + lista).
- `POST /tutor/evaluate` → roda as regras do EduBot sobre todos os alunos do
  curso, **persiste intervenções (já existe `interventions`) e cria alertas**
  para quem entrou em zona de risco. (No vídeo, o botão "Analisar turma" gera o
  alerta do "Bruno" ao vivo.)
- **Disparo automático (produção):** worker agendado (APScheduler num thread no
  Flask, ou um container `ova_cron`) chamando a mesma rotina `evaluate` por
  curso, 1×/dia. Para o vídeo, on-demand basta.
- **Canal externo (opcional):** e-mail via SMTP (`smtplib`) no momento do
  alerta; push fica para depois.

### Frontend
- `src/components/TutorPanel.tsx` — tabela de alunos + KPIs + cards de alerta;
  drill-down por aluno (gráficos já existentes + radar).
- `Sidebar.tsx`: item **"Turma"** visível só quando `profile.role` ∈ `{tutor, admin}`.
- `App.tsx`: nova view `tutor`. `api.ts`: `getTurma()`, `getTutorAlerts()`, `evaluateTurma()`.

### Esforço: 🟡 · Depende da AWS: **não**.

---

## 3. Recomendação com fontes externas (bases científicas) — 🟡/🟢 (Cena 4)

### Backend
- `edubot_agent/external_sources.py`:
  - `search_external(competency_name, limit=3)` → consulta uma API pública
    **sem chave** (ex.: **Crossref** `api.crossref.org/works?query=` ou
    **Semantic Scholar** `api.semanticscholar.org/graph/v1/paper/search`) e
    devolve `[{title, url, source, year}]`. Cache simples por competência.
  - (Vídeo complementar) **YouTube Data API** opcional, requer chave.
- Rota: `GET /edubot/external-resources?competency_id=` `@require_auth`.
- **Integração com a OVA de reforço:** o agente de tool-use (`personalized.py`)
  ganha uma tool `listar_fontes_externas(competency_id)` → a OVA de reforço
  passa a citar "explore também" com links externos (encaixa direto no loop de
  tool-use existente).

### Frontend
- Na aba **Reforço** / recomendação: bloco **"Materiais externos"** com os links
  (abre em nova aba; registra interação).

### Esforço: 🟢 (Crossref/Semantic Scholar, sem chave) / 🟡 (com YouTube). · Depende da AWS: **não**.

---

## 4. OVA "Fundamentos de Computação na Nuvem" — 🟢 (Cena 2, conteúdo)

O leitor de OVA novo **renderiza qualquer HTML** no padrão existente (busca e faz
parse). Então é só **autorar conteúdo**, sem código novo:
- `Front-End/files/html/ovas/cloud_computing.html` — mesma estrutura
  (`#introduction`, seções com `.carrousel`/`.accordion`, `#conclusion` com
  `.questions`, `#resources`).
- `Database/sql/dml_extra.sql`: nova disciplina + `ovas` (link
  `cloud_computing.html`) + `competencies` + `questions` + `resources`
  (1 vídeo + 1 podcast) — seguindo o padrão de `dml.sql`.
- Imagens em `Front-End/files/imagens/`.
- Pode-se **gerar o rascunho do HTML com o próprio Claude**.

### Esforço: 🟢 · Depende da AWS: **não**.

---

## 5. IA real (Bedrock) — ✅ pronta, aguardando a key

Já implementado (camada `llm.py` + os 3 agentes + `compose.yaml`). Ao receber a
credencial: `.env` com `EDUBOT_LLM_PROVIDER=bedrock` + chaves AWS →
`docker compose up -d`. Ver [IA_AWS_SETUP.md](IA_AWS_SETUP.md). **Necessária para
a Cena 2 ("IA generativa embarcada") ser convincente.**

---

## 6. Citação/referência automática — 🟢 texto / 🔴 vídeo (Cena 2)

- **Texto (fácil):** o tutor já sabe a **seção** de onde tirou a resposta
  (`_parse_context` em `tutor.py`). Estender `tutor_reply` para devolver
  `sources: [{secao, trecho}]`; com a LLM real, instruir o *system prompt* a
  citar a seção. O `TutorChat.tsx` mostra "📌 Fonte: <seção>".
- **Vídeo/podcast (difícil):** exige **transcrição com timestamps** (ex.: AWS
  Transcribe) indexada por OVA. Fica para depois do RAG; *nice-to-have* para o
  vídeo.

### Esforço: 🟢 (texto) · Depende da AWS: **não** (texto).

---

## 7. Módulos/Aulas (granularidade) — 🟢 opcional para o vídeo (Cena 2)

A narração diz "navega por **uma aula** acessando recursos" — o **leitor de OVA
atual já parece exatamente uma aula**. Modularização fina (tabelas
`module`/`lesson`) é **opcional para a gravação**; pode ser só um agrupamento
visual na aba Conteúdos. Deixar para a fase de LMS, fora do caminho crítico do
vídeo.

---

## Ordem de execução sugerida (caminho crítico do vídeo)

| # | Feature | Esforço | AWS? | Status |
|---|---------|---------|------|--------|
| 1 | **OVA "Comp. na Nuvem"** (#4) | 🟢 | não | ✅ **feito** — `cloud_computing.html` + DML; aparece nos Conteúdos |
| 2 | **Citação de fonte no texto** (#6) | 🟢 | não | ✅ **feito** — tutor devolve `sources`; chip "Fonte" no chat |
| 3 | **Fontes externas** (#3) | 🟢/🟡 | não | ✅ **feito** — Crossref em `/edubot/external-resources`; bloco na Reforço |
| 4 | **Painel do tutor + alertas** (#2) | 🟡 | não | ✅ **feito** — papel `tutor`, `/tutor/*`, aba "Turma" + Central de Alertas |
| 5 | **Avatar + TTS** (#1) | 🔴 | parcial | ⏳ pendente — coração das Cenas 3 e 5 (TTS Polly precisa de AWS) |
| — | **IA real (Bedrock)** (#5) | ✅ | sim | Pronta; ligar quando a key chegar |

> **Itens 1–4 entregues e validados no Docker** (30/06/2026). Falta o item 5
> (avatar/UI offline + TTS Polly que depende da AWS).

> Itens 1–4 **não dependem da AWS** e podem começar já. O item 5 (avatar/UI) também
> começa offline; só o TTS Polly e a LLM real precisam da credencial.

## Riscos / decisões em aberto
- **Tecnologia do avatar** (SVG simples vs. Rive/Lottie vs. 3D Three.js/Ready
  Player Me) — trade-off entre fidelidade e esforço. Para o vídeo, recomendo
  **2D + visemas da Polly**.
- **TTS:** Polly (mesma conta AWS, dá visemas) vs. ElevenLabs (mais natural, e
  necessário para a voz clonada da Cena 5).
- **Alertas automáticos:** scheduler in-process (APScheduler) vs. container cron
  separado — para o vídeo, botão on-demand basta.
- **Fonte externa:** Crossref/Semantic Scholar (sem chave) cobrem "artigo
  científico"; YouTube (vídeo complementar) exige chave.

---

*Documento de planejamento — última atualização: 2026-06-29.*
