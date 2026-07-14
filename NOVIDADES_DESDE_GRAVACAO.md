# O que a plataforma tem HOJE que não tinha na gravação

> Diff entre o estado capturado no `GUIA_GRAVACAO_PROPOSTA.md` (**2026-07-01**) e a
> plataforma atual (**2026-07-10**). Nesse intervalo rodaram as **duas varreduras
> estratégicas (Claude Fable)** — a técnica (`AUDITORIA_TECNICA.md`) e a de produto
> (`PLANO_EXECUCAO.md`) — e a **execução das Etapas 1–6 (Claude Opus)**, fechada com
> uma **auditoria de consistência** que encontrou e corrigiu 7 defeitos.
> Detalhes de cada entrega: `LOG_EXECUCAO.md`.

## 🔗 Abrir o site

| | |
|---|---|
| **Aplicação (aluno/tutor)** | **http://localhost:8010/app/** |
| API (backend Flask) | http://localhost:5010 |
| Subir a stack | `docker compose up -d` na pasta `EduBot/` |

**Credenciais (senha = RA):** Aluno **RA 1** · Tutor **RA 2** · Admin **RA 4** ·
Alunos com atividade seed de demo: RA 1, 3, 5 · Conta zerada p/ estado vazio: RA 7.

---

## 👨‍🎓 Novidades na visão do ALUNO

### Primeiro login (não existia nada disso)
- **Modal de privacidade LGPD (D.5)** — antes de usar, o aluno vê as 3 finalidades
  de tratamento de dados: acompanhamento pedagógico (base do serviço, informado),
  **IA sobre os seus dados** (opt-in) e **imagem/voz** (opt-in). As escolhas valem
  de verdade: sem o opt-in de IA, o backend **não roda LLM sobre os dados do aluno**
  e **não guarda o texto** das perguntas ao tutor (enforcement no servidor, não na UI).
- **Onboarding com o avatar falante (U.5/V.2)** — o EduBot se apresenta em 3 passos
  ("seus módulos estão aqui" → "o quiz libera após a leitura" → "eu aviso você por
  aqui"), com botão **Ouvir** por passo, Esc/Pular, e navegação acessível.
- **Estado vazio acolhedor** — conta nova mostra CTA **"Abrir meu primeiro módulo"**
  em vez de um dashboard zerado.

### Dashboard
- Os cards de recomendação do EduBot agora têm **botão ▶ "Ouvir"** com um
  **mini-avatar que mexe a boca** enquanto fala (V.2).
- As recomendações deixaram de ser texto de template: quando a IA real está ligada,
  um **redator (Claude Haiku)** reescreve a mensagem **para o caso concreto** —
  citando a competência frágil e até **a dúvida que o aluno perguntou ao tutor** (B.4).

### Leitura e quiz
- **Quiz com trava pedagógica (U.1)** — o quiz de um módulo **só libera depois de
  ler ~70% do conteúdo**, validado **no backend** (curl não burla). Bloqueado, o
  aluno vê o motivo: "leia 70% — você está em 35%".
- **Tempo de leitura honesto (A.5)** — aba em segundo plano ou aluno ausente (3 min
  sem interação) **não contam** mais como leitura.
- **Quiz adaptativo (D.4)** — cada questão agora tem **dificuldade (1–3)** e o pool
  servido respeita a "zona proximal": iniciante começa nas fáceis; questões difíceis
  só entram quando o domínio da competência passa de 80%. O agente pode ainda
  ajustar o nível por aluno (±1/dia).

### Meu Desempenho
- **Teia de competências com BKT (D.2)** — o radar deixou de ser "acertos/total" e
  passou a mostrar o **domínio estimado por Bayesian Knowledge Tracing**, com
  esquecimento (o domínio decai sem prática). É o novo "modelo do aluno".
- **Revisões desta semana (D.3)** — agenda de **revisão espaçada (SM-2)**: dominar
  uma competência agenda revisão; acertar na revisão expande o intervalo, errar
  reseta. O EduBot cobra as vencidas com uma intervenção.
- **Meus dados (LGPD, D.5)** — painel com toggles de consentimento (revogáveis),
  **exportar meus dados (JSON)** e **solicitar exclusão** (vira alerta p/ admin).
- **Persona persistida (V.2)** — a escolha Einstein/Curie/EduBot agora é lembrada
  entre visitas (antes resetava sempre).
- **Voz com infraestrutura de lip-sync real (V.1)** — o "Ouvir o EduBot" agora tenta
  **AWS Polly neural com visemas** (backend + cache prontos) e cai no Web Speech
  automaticamente enquanto não houver credencial de voz.

### Acessibilidade (U.7 — não existia)
- Feedback do quiz e toasts anunciados por leitor de tela (`aria-live`/`role=status`);
  modais com foco/`aria-modal`/Esc; carrossel navegável por **setas do teclado**;
  animações do avatar desligam com `prefers-reduced-motion`.

---

## 👨‍🏫 Novidades na visão do TUTOR (RA 2)

Na época da gravação o painel tinha: turma, "Analisar turma" e a central de alertas.
Agora tem, além disso:

- **✅ Ações propostas pelo EduBot (B.5)** — fila de aprovação *human-in-the-loop*:
  ações de tier alto do agente (alerta de severidade alta, **mensagem que "o tutor
  enviaria" ao aluno**) **não saem sem aprovação**. Aprovar executa (vira intervenção
  assinada "do seu tutor"); rejeitar descarta. Idempotente.
- **📊 Desempenho do EduBot (B.6)** — KPI do agente: **taxa de aceitação por tipo de
  intervenção**. O agente agora **observa o efeito do que fez** (aceita · dispensada ·
  melhorou · expirada) e o redator **varia a abordagem** quando o histórico mostra
  rejeição — o loop de aprendizado fecha.
- **🌡️ Domínio da turma (D.6)** — heatmap **alunos × competências** colorido pelo
  domínio BKT, com média e distribuição por competência.
- **"Marcar como tratado" (A.4)** — alertas têm ciclo de vida: ack pelo tutor +
  expiração automática em 14 dias (antes, o 1º alerta de cada tipo bloqueava todos
  os futuros para sempre).

---

## ⚙️ Por baixo do capô (o que sustenta tudo isso)

| Área | Antes (gravação) | Agora |
|---|---|---|
| Perfil do aluno | ~80–120 queries por chamada | **8 queries agregadas** (10–50× mais rápido), contrato garantido por teste golden |
| Segurança (A.3) | rotas abertas (`/question/all`, `/student/course`), CORS `*`, login sem limite | tudo autenticado por papel, CORS restrito, **rate-limit 429** no login |
| Telemetria (D.1) | `interactions` (strings livres) | **`learning_events` xAPI-lite** (11 verbos validados, lote de 50, fila no front com flush 15s/pagehide) |
| Modelo do aluno (D.2) | razão acertos/total, limiar 0.8 | **BKT com decaimento** por competência + backfill do histórico |
| Agente (B.3) | 1 fluxo de tool-use (OVA personalizada, 4 tools) | **loop genérico + catálogo de 11 tools com tiers de autonomia** (`read → auto → auto_capped → auto_or_queue → queue`) |
| Custo de IA (B.2) | sem medição | **toda decisão registrada** (`agent_decisions`: modelo, tokens, custo, latência) + **orçamento diário** que degrada p/ template + **circuit breaker** (3 falhas → 10 min de fallback) |
| IA real (B.1) | ligada só p/ a fala do coach | ligada nos 4 caminhos (recomendação, tutor-chat, coach, agente) via **Bedrock inference profiles**, com fallback mock em cada um |
| Voz (V.1) | Web Speech do navegador | **Polly neural + visemas + cache** no backend (Web Speech vira fallback) |
| Banco | — | **10 migrations novas (003–012)**, 6 tabelas novas, todas idempotentes |
| Testes | 42 | **160** |

**Endpoints novos (13):** `POST /events` · `GET/POST /consents` ·
`POST /student/me/delete-request` · `GET /reviews` · `POST /edubot/speak` ·
`GET /edubot/speech/<key>.mp3` · `POST /tutor/alert/ack` · `GET /tutor/mastery` ·
`GET /tutor/queue` (+ `approve`/`reject`) · `GET /tutor/agent-kpi`.

**Auditoria final (2026-07-10):** revisão item a item das Etapas 1–6 encontrou e
corrigiu 7 defeitos (vínculo decisão↔fila de aprovação, dedup de propostas, fuso
horário dos eventos, config do redator na Bedrock, custo do coach/tutor-chat fora
do orçamento, eventos `asked_tutor` e `completed` nunca emitidos). Detalhes no
bloco "AUDITORIA DE CONSISTÊNCIA" do `LOG_EXECUCAO.md`.

---

## 🎬 Se for regravar: o que muda no roteiro

1. **Cena 1 (login)** — no primeiro acesso aparecem **2 telas novas** antes do
   dashboard: o modal de privacidade (LGPD) e o onboarding falado. Vale MOSTRAR
   (é diferencial), ou pular uma vez antes de gravar (as flags ficam no navegador;
   aba anônima faz reaparecer).
2. **Cena 2 (leitor/quiz)** — o quiz agora **começa travado**: mostre o cadeado com
   "leia 70%…" e a liberação após rolar o conteúdo — é a nova pedagogia na tela.
3. **Cena 3 (Meu Desempenho)** — além do avatar/persona (agora persistida), mostre
   **Revisões desta semana** e o painel **Meus dados** (LGPD ao vivo).
4. **Cena 4 (tutor)** — o painel tem 3 blocos novos para exibir: **fila de
   aprovação** (aprove uma mensagem proposta na frente da câmera), **KPI do agente**
   e o **heatmap da turma**.
5. **IA real** — o bearer token da Bedrock usado nos testes **expirou** (era
   temporário de ~12h). Para gravar com IA real: gere uma nova Bedrock API key,
   atualize `AWS_BEARER_TOKEN_BEDROCK` no `.env` e rode
   `docker compose up -d ova_flask`. Sem isso tudo funciona igual em modo
   determinístico (selo "resposta simulada").

## ⏳ Ainda não entregue (diferido por design)

Reestruturação da navegação (U.8/U.2/U.3/U.6 — rotas `#/modulo/:id`, fusão de
abas), lip-sync do visema na boca do avatar 3D (a timeline já chega ao front),
chamada real do Polly (falta credencial de voz — a key da Bedrock não cobre),
avatares GLB/VRM + licenças (V.3/V.4, condicionados às métricas de uso do V.2) e
eventos de player (play/pause/seek).

---

*Gerado em 2026-07-10 — plataforma com 160 testes verdes, build do front ok e
stack validada em execução.*
