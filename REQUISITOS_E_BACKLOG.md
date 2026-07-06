# Requisitos × Estado Atual — Análise de Gaps e Backlog

Este documento compara a **lista de necessidades do projeto** (Cenas 2–5) com o
que a plataforma **já entrega hoje** e deriva um **backlog de afazeres** para
fechar cada requisito.

**Legenda de status:** ✅ pronto · 🟡 parcial · ❌ ausente

**Resumo geral:**

| # | Área | Status | Comentário |
|---|------|--------|-----------|
| 1 | LMS / AVA Core | 🟡 | Hierarquia de conteúdo, mídias e quiz existem; faltam papéis (professor), modularização fina e telas de autoria |
| 2 | Telemetria / Rastreamento | 🟡 | Há rastreio de leitura/mídia/quiz; faltam histórico de IA, eventos discretos e pipeline em tempo real |
| 3 | IA Generativa (RAG) | 🟡 | Chat contextual por OVA existe, mas a LLM é **mockada** e o "RAG" é por keyword (sem embeddings nem citação exata) |
| 4 | EduBot / Motor de Regras | 🟡 | As 6 regras e o agente de reforço existem, mas rodam **sob demanda** (sem automação/triggers, sem APIs externas) |
| 5 | Avatar + Voz (TTS) | ❌ | Apenas estudo de viabilidade; nada implementado |
| 6 | Dashboards / Tutor / Alertas | 🟡 | Dashboard do aluno existe; faltam gráfico radar, painel do tutor e central de alertas |
| 7 | Roadmap (personas/voz) | ❌ | Visão futura, não iniciada |

---

## 1. Ambiente Virtual de Aprendizagem (LMS / AVA Core) — 🟡

**O que já tem**
- ✅ Hierarquia: `courses` → `course_subjects` (disciplinas) → `offerings` → `ovas` → `resources`.
- ✅ Repositório de mídias multi-formato: `resources` com `resource_type`
  (texto/vídeo/podcast/atividade/quiz) + `media_type` (youtube/upload/spotify…)
  e players integrados (React `VideoPlayer`/`AudioPlayer`).
- ✅ Quiz engine com correção **no servidor** (`/question/answer`), questões por competência.
- ✅ Matriz de competências (modelo): `competencies` vinculada a `questions.competency_id` e `resources.competency_id`.

**O que falta**
- 🟡 Papéis: hoje só `students.is_admin` (aluno vs. admin). **Sem perfil Professor/Tutor.**
- ❌ Modularização fina: não há **módulos / aulas / tópicos** (disciplina é o nível mais granular).
- ❌ **Biblioteca virtual / repositório de arquivos** genérico (PDF/doc/upload).
- ❌ **Telas de autoria** (CRUD) — OVAs, recursos, questões e competências hoje só entram via SQL (`Database/sql/*.sql`).

**Afazeres**
- [ ] Introduzir papel **Professor/Tutor**: trocar `is_admin` por `role` (aluno/tutor/admin) + vínculo tutor↔turma.
- [ ] Modelo de conteúdo modular: tabelas `module` / `lesson` / `topic` entre disciplina e OVA.
- [ ] CRUD administrativo (UI) para disciplinas, módulos, OVAs, recursos, questões e competências.
- [ ] **Biblioteca de arquivos**: tabela `files` + storage (S3/Apache) + tela de upload/listagem + viewer de PDF.
- [ ] Ferramenta visual de **matriz de competências** (vincular conteúdo/questão ↔ competência sem SQL).

---

## 2. Telemetria e Rastreamento de Dados — 🟡

**O que já tem**
- ✅ `interactions` (marcos de scroll, abertura de acordeão/carrossel, cliques).
- ✅ `ova_progress` (tempo de leitura + % de scroll) e `resource_progress` (% de vídeo, segundos de áudio, conclusão).
- ✅ `attempts` / `answers` (erros e acertos do quiz, por competência).

**O que falta**
- 🟡 Eventos são **strings descritivas**, não um schema de evento estruturado.
- 🟡 Vídeo/áudio: hoje % por checkpoint — faltam **eventos discretos** (play/pause/seek).
- ❌ **Histórico de perguntas/comandos enviados à IA** não é persistido (o `/edubot/tutor-chat` não grava nada).
- ❌ **Tempo de resposta** no quiz não é capturado.
- ❌ **Pipeline de stream processing** (tempo real). Hoje são escritas síncronas no MySQL + análise batch (`plots/data_analysis.py`).
- ❌ Store de **dados não estruturados** (MongoDB/Elasticsearch) para logs.

**Afazeres**
- [ ] Persistir **histórico de chat com a IA** (tabela `ai_chat_messages`: aluno, ova, role, conteúdo, ts).
- [ ] Capturar **eventos discretos** de mídia (play/pause/seek) e **tempo de resposta** por questão.
- [ ] Padronizar um **schema de evento** (`events`: type, payload JSON, ts) emitido por todas as telas.
- [ ] **Pipeline de tempo real**: fila/stream (Kafka ou Redis Streams) + consumidor que agrega métricas de engajamento.
- [ ] Banco de **logs não estruturados** (MongoDB ou Elasticsearch) para a telemetria bruta.

---

## 3. IA Generativa Embarcada (RAG) — 🟡

**O que já tem**
- ✅ **Chatbot contextual por OVA** (UI lateral `TutorChat` + rota `/edubot/tutor-chat`).
- ✅ Grounding: o texto real do OVA é enviado como contexto e o tutor recusa perguntas fora do tema.

**O que falta**
- 🟡 A LLM está **MOCKADA** (`edubot_agent/tutor.py`); o "RAG" é **retrieval por keyword** determinístico, **sem embeddings**.
- ❌ **LLM real** conectada.
- ❌ **Vector store / embeddings** por disciplina (RAG de verdade).
- ❌ **Referenciação automática exata** (trecho do texto / minuto do vídeo).

**Afazeres**
- [ ] Ligar **LLM real** (Anthropic Claude — já há esqueleto comentado em `tutor.py`) via chave no ambiente.
- [ ] Construir pipeline **RAG**: chunking + **embeddings** do material por disciplina → **vector DB** (pgvector / Elasticsearch / Chroma).
- [ ] **Transcrever** vídeos/podcasts e indexar junto (para citar minuto).
- [ ] **Citação automática**: devolver fonte (seção + posição no texto; timestamp do vídeo).
- [ ] **Isolamento por disciplina** no retrieval (namespace/filtro), garantindo "apenas a base daquela disciplina".

---

## 4. EduBot e Motor de Regras Automáticas (IA Agêntica) — 🟡

**O que já tem**
- ✅ **6 regras pedagógicas** (inatividade, consumo < limiar, erro > 50% no quiz, etc.) em `edubot_agent/agent.py` (mock) → recomendação estruturada.
- ✅ **Agente de tool-use** (`personalized.py`) que diagnostica a competência mais fraca e **monta uma OVA de reforço** com conteúdo do banco.
- ✅ Recomendações persistidas em `interventions` (histórico).

**O que falta**
- 🟡 As regras rodam **sob demanda** (`GET /edubot/recommendation`), não de forma **autônoma/agendada**.
- ❌ **Motor de triggers** configurável (condições/ações em dados, não hardcode) + **scheduler** (cron/worker).
- ❌ **Recomendação com APIs externas** (bases científicas / bibliotecas) por lacuna de competência.
- ❌ **Gerador de plano de retomada** dinâmico com **cronograma datado** (hoje é uma lista textual de ações).

**Afazeres**
- [ ] Motor de regras **configurável** (tabela de regras: condição → ação) + **worker agendado** que avalia todos os alunos periodicamente.
- [ ] **Disparo de ações** automáticas: criar intervenção + notificar aluno + **alertar o tutor**.
- [ ] **Integração com APIs externas** (CrossRef / CORE / Google Scholar / bibliotecas) para recomendar conteúdo por competência.
- [ ] **Plano de retomada** com cronograma (datas, metas diárias) gerado pela IA.

---

## 5. Interface Lúdica e Sistema de Avatar — ❌

**O que já tem**
- 🟡 Apenas o estudo de viabilidade em `TUTOR_AVATAR_VIRTUAL.md`. **Nada implementado.**

**Afazeres**
- [ ] **Motor de avatar** (2D Live2D ou 3D Three.js / Ready Player Me) embutido na UI.
- [ ] **TTS** (ElevenLabs / Azure Speech / AWS Polly) para converter feedback do EduBot em fala, com tom configurável.
- [ ] **Lip-sync** (visemes a partir do áudio) + **expressões** por tipo de feedback (parabéns/atenção).
- [ ] Camada de orquestração: feedback do EduBot → texto → TTS → avatar animado.

---

## 6. Dashboards, Visões Pedagógicas e Alertas — 🟡

**O que já tem**
- ✅ **Painel do aluno** (`Dashboard.tsx`) + **Evolução** (`Evolution.tsx`) com gráficos de barras (leitura por OVA, consumo por tipo, competências).
- ✅ Histórico de intervenções (sino na Topbar).

**O que falta**
- 🟡 **Gráfico radar / teia de aranha** de competências (pedido explícito) — hoje só barras.
- ❌ **Painel do Tutor/Professor** (visão de turma) — existe `/student/report/<id>` por aluno, mas **sem agregação por turma nem UI de tutor**.
- ❌ **Central de alertas preventivos** ao tutor (in-app + e-mail/push).

**Afazeres**
- [ ] Adicionar **RadarChart** (Recharts já está no projeto) de competências na Evolução/Dashboard.
- [ ] **Painel do Tutor**: lista de alunos da turma, KPIs, drill-down por aluno (reaproveitar `/student/report` + endpoint de agregação por turma).
- [ ] **Central de alertas**: tabela `alerts` + UI do tutor + canais (e-mail SMTP / web push) quando o aluno entra em zona de risco.

---

## 7. Visão Futura (Roadmap / Cena 5) — ❌

**Afazeres**
- [ ] **Personas/skins de IA**: system prompt + base de conhecimento + voz por persona (ex.: "especialista X").
- [ ] **Clonagem de voz** (ElevenLabs voice clone) atrelada à persona.
- [ ] **Avatares customizados** por persona.

---

## Lacunas de Stack (vs. "Tech Stack Mínima")

| Camada | Pedido | Hoje | Gap |
|--------|--------|------|-----|
| Frontend | React/Vue/Angular + animação + gráficos | **React 18 + Vite + Tailwind + Recharts** ✅ | Falta lib de **animação de avatar**; falta **radar chart** |
| Backend/DB relacional | PostgreSQL | **Flask + MySQL** 🟡 | Funciona; migrar p/ Postgres é **opcional** (necessário se usar pgvector) |
| Logs/Big Data | MongoDB/Elasticsearch | ❌ | Sem store de dados não estruturados |
| IA (LLM) | OpenAI/Gemini/Anthropic | **Mock** (envelope Anthropic) ❌ | Falta LLM real + embeddings/vector DB |
| Voz (TTS) | ElevenLabs/Azure/Polly | ❌ | Não integrado |

---

## Roadmap sugerido (fases por esforço × valor)

**Fase 1 — Quick wins (fecham gaps visíveis com baixo esforço)**
- [x] Gráfico **radar** de competências. *(feito — "Teia de competências" em Evolution)*
- [x] **LLM real plugável** (AWS Bedrock / Anthropic) nos 3 agentes, via env — ver [IA_AWS_SETUP.md](IA_AWS_SETUP.md). *(pronto p/ a key; default mock)*
- [ ] **Persistir histórico** do chat de IA.
- [ ] Papel **Professor/Tutor** (modelo + login).

**Fase 2 — RAG real + visão do tutor**
- [ ] Pipeline **RAG** (embeddings + vector DB) com **citação de fonte**.
- [ ] **Painel do Tutor** + agregação por turma.
- [ ] **Central de alertas** (in-app + e-mail).

**Fase 3 — Automação agêntica**
- [ ] Motor de **regras/triggers** + worker agendado + ações automáticas.
- [ ] **Integração com APIs externas** (bases científicas) e **plano de retomada datado**.
- [ ] **Telemetria em tempo real** (stream) + store de logs (Mongo/Elastic).

**Fase 4 — Conteúdo e autoria**
- [ ] Modularização (módulos/aulas/tópicos), **CRUD de autoria** e **biblioteca de arquivos**.

**Fase 5 — Avatar, voz e personas**
- [ ] **Avatar + TTS + lip-sync**.
- [ ] **Personas + clonagem de voz** (roadmap Cena 5).

---

*Documento de planejamento — última atualização: 2026-06-29.*
