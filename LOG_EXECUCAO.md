# Log de Execução — Evolução do EduBot

> Registro vivo da execução do `PLANO_EXECUCAO.md`. Um bloco por passo concluído:
> o que foi feito, decisões/desvios, arquivos tocados e resultado da validação.
> Ordem cronológica. Início: 2026-07-07.

## Estado da suíte de testes

| Momento | Testes | Resultado |
|---|---|---|
| Baseline (antes de tudo) | 42 | ✅ 42 passed |
| Após A.1 | 44 | ✅ 44 passed |
| Após A.3 | 50 | ✅ 50 passed |
| Após A.4 | 55 | ✅ 55 passed |
| Após A.6 (upsert atômico) | 58 | ✅ 58 passed |
| Após A.7 (tutor + personalized-ova) | 67 | ✅ 67 passed |
| Após U.1 backend (gate de quiz) | 72 | ✅ 72 passed |
| Após B.2 + U.4 (agent_decisions, last_access) | 78 | ✅ 78 passed |

---

# ETAPA 1 — Fundação

## ✅ A.1 — `build_student_profile` reescrito com agregações SQL

**Status**: concluído. **Data**: 2026-07-07.

**O que foi feito**
- Capturado o **contrato atual** do perfil via golden-snapshot antes de tocar na
  lógica: novo `tests/test_profile_contract.py` semeia um cenário rico (2 OVAs, 6
  recursos de todos os tipos, progresso de OVA e de mídia, attempts certos/errados,
  answers, 2 competências, intervenções) e grava `tests/golden_profile.json` a
  partir da implementação de referência.
- Reescrito `edubot/services/student_context.py`:
  - `_competency_statuses` (4 counts × N competências) → `_competency_rows`: **1
    query agregada** com `JOIN` Competencies→Questions→Answers(do aluno)→Attempts(do
    aluno) + `GROUP BY`. `COUNT(DISTINCT ...)` neutraliza o fan-out do join; o `SUM`
    de erros não duplica porque `answers` é ≤1 por (aluno, questão) — unique
    `uc_answers`.
  - `_resource_state` deixou de receber a linha do banco e fazer `get_or_none`;
    passou a receber **linhas já carregadas** de dois JOINs em lote (OVAs×OVAProgress
    e Resources×ResourceProgress, ambos `LEFT JOIN` filtrando pelo aluno).
  - `_days_without_access`: os 4 `MAX` viraram **1 query** (`UNION ALL`) — beneficia
    também o painel do tutor, que chama a função por aluno num loop.
  - `atividades_pendentes` passou a ser **derivado das linhas já carregadas** (sem
    query nova).

**Decisões / desvios**
- **Gotcha do Peewee resolvido**: `Students.course_id` é `ForeignKeyField`, então
  `student.course_id` faz *lazy-load* do objeto `Courses` (1 query). A versão antiga
  disparava esse lazy-load **e** um `Courses.get_or_none` separado (2 queries em
  `courses`). Agora reusamos o lazy-load como o próprio `course` e passamos o
  `course_id` inteiro adiante — 1 query só.
- **Meta de queries atingida**: perfil caiu de **~31 → 8 queries** no cenário rico
  (course, dias, ovas+progresso, recursos+progresso, has-quiz por OVA, competências,
  totais de quiz, histórico). Teste `test_profile_query_budget` trava regressão em
  `<= 8`.
- `atividades_pendentes` agora é **course-scoped** (só OVAs do curso) — antes contava
  qualquer `ova_progress` do aluno. Diferença só apareceria com progresso fora do
  curso (não ocorre no domínio); a nova forma é mais correta e o golden bate.

**Arquivos**
- `Back-End/edubot/services/student_context.py` (reescrito)
- `Back-End/tests/test_profile_contract.py` (novo)
- `Back-End/tests/golden_profile.json` (novo — snapshot de referência)

**Validação**
- `pytest`: **44 passed** (42 anteriores + 2 novos). Golden idêntico campo a campo
  (comparação com `sort_keys`), então nenhum consumidor do perfil (`/student/me`,
  agente, proatividade, painel) muda de comportamento.
- Query budget: 8 (meta `<= 8`).

**Pendências herdadas para etapas seguintes**
- A ordenação por `p_mastery` (D.2) substituirá a ordenação por taxa de erro nas
  tools do agente; `_competency_rows` é o ponto de extensão.

---

## ✅ A.2 — Índices secundários (`migration_003_indexes.sql`)

**Status**: concluído (código). **Validação em MySQL: pendente** (requer
`docker compose up`). **Data**: 2026-07-07.

**O que foi feito**
- Nova `Database/sql/migration_003_indexes.sql` com 12 índices cobrindo os filtros
  mais quentes: `attempts(student_id, attempt_time)`, `attempts(question_id)`,
  `answers(student_id)`, `interactions(student_id, interaction_date)`,
  `questions(competency_id)`, `questions(ova_id)`, `resources(ova_id)`,
  `resources(competency_id)`, `interventions(student_id, date, result)`,
  `alerts(student_id, read)`, `ova_progress(student_id, last_access)`,
  `resource_progress(student_id)`.
- Padrão **idempotente** idêntico às migrations 001/002: cada `CREATE INDEX` é
  guardado por `information_schema.STATISTICS` (MySQL não tem
  `CREATE INDEX IF NOT EXISTS`).

**Decisões / desvios**
- O `Database/Dockerfile` copia `./sql/` inteiro para
  `/docker-entrypoint-initdb.d/`; a ordem alfabética garante que a 003 rode
  **após** `ddl.sql`/`ddl_extra.sql` (tabelas já existem). Volume existente: rodar
  via `docker exec` (comando no cabeçalho do arquivo).
- Índices casam com colunas que as próximas etapas também usam (U.4 "continuar de
  onde parou" já tem seu índice; a coluna `read` de `alerts` fica indexada para a
  dedup do A.4).

**Arquivos**
- `Database/sql/migration_003_indexes.sql` (novo)

**Validação**
- Não exercitável por pytest (SQLite não usa esses índices). Requer subir o MySQL:
  `docker compose up` (build novo aplica no init) **ou** `docker exec` no volume
  existente; conferir com `SHOW INDEX FROM attempts` e `EXPLAIN` nas queries do
  perfil (sem full scan).

---

## ✅ A.3 — Fechar rotas abertas + rate-limit no login + CORS

**Status**: concluído. **Data**: 2026-07-07.

**O que foi feito**
- `edubot/api/auth.py` ganhou três peças reutilizáveis:
  - `is_staff(student)` — fonte única do papel de gestão (tutor/admin/is_admin);
  - `require_roles(*allowed)` — decorator que exige token **e** papel (401/403);
  - `login_throttled(ra, ip)` + `reset_login_throttle()` — rate-limit in-process
    (deque por `ra|ip`, janela e teto por env: `EDUBOT_LOGIN_MAX_ATTEMPTS=5`,
    `EDUBOT_LOGIN_WINDOW_SECONDS=60`).
- Rotas fechadas:
  - `GET /question/all` → `@require_auth` (expunha o banco de questões a anônimos);
  - `GET /student/course/<id>` → `@require_roles("tutor","admin")` (vazava nome+ID
    de alunos — PII/LGPD);
  - `/login` → 429 + `Retry-After` quando estoura o rate-limit.
- `tutorRoute._is_tutor()` passou a delegar para `is_staff` (elimina a cópia da
  regra de papel — A15).
- CORS restrito por env `EDUBOT_CORS_ORIGINS` (default `http://localhost:8010`) em
  `api/app.py`; variável adicionada ao `compose.yaml`.

**Decisões / desvios**
- `/courses` e `/course/<id>/subjects` permanecem **anônimas** de propósito: a tela
  de login lista cursos antes de haver token e elas não expõem PII (só nomes de
  curso/disciplina).
- Rate-limit é in-process (1 réplica). Multi-réplica exigirá store compartilhado
  (Redis) — anotado no plano.
- Fixture autouse `_reset_login_throttle` no `conftest.py` zera o estado global do
  rate-limit entre testes (senão a contagem vazaria e outros testes de login
  quebrariam com 429).

**Arquivos**
- `Back-End/edubot/api/auth.py`, `.../routes/questionRoute.py`,
  `.../routes/studentRoute.py`, `.../routes/loginRoute.py`,
  `.../routes/tutorRoute.py`, `.../api/app.py`
- `Back-End/tests/conftest.py` (fixture autouse), `Back-End/tests/test_auth_routes.py` (novo)
- `compose.yaml` (`EDUBOT_CORS_ORIGINS`)

**Validação**
- `pytest`: **50 passed** (+6). Cobre: `/question/all` 401→200, `/student/course`
  401/403(aluno)/200(tutor), login 6ª tentativa → 429 com `Retry-After`.

---

## ✅ A.4 — Ack de alertas do tutor (destrava a dedup congelada)

**Status**: concluído. **Data**: 2026-07-07.

**O que foi feito**
- Backend: nova `POST /tutor/alert/ack` (`tutorRoute.py`) — exige papel de tutor,
  valida que o aluno do alerta é do curso do tutor (não vaza/edita outra turma),
  seta `read=True`. 404 quando não existe/é de fora do curso.
- `edubot/services/proactivity.py`: `expire_stale_alerts(days=14)` marca como lidos
  os alertas não tratados com mais de 14 dias; chamada no início de
  `run_class_evaluation` (varredura). Constante `ALERT_EXPIRY_DAYS`.
- Frontend: `ackTutorAlert` em `api.ts`; `TutorPanel.tsx` ganhou botão "Marcar como
  tratado" por alerta (atualiza estado local `read=true`, sai da contagem de
  abertos) e selo "Tratado".

**Decisões / desvios**
- A regressão real que isto conserta (documentada e testada): a dedup de alertas é
  "por tipo enquanto não lido" (`proactivity.py`). Sem ack, o 1º alerta de cada
  tipo ficava aberto para sempre e **suprimia todos os futuros do mesmo tipo**. O
  teste `test_dedup_reopens_after_ack` prova o ciclo: cria → dedup segura → ack →
  volta a alertar.

**Arquivos**
- `Back-End/edubot/api/routes/tutorRoute.py`, `.../services/proactivity.py`
- `Front-End/.../services/api.ts`, `.../components/TutorPanel.tsx`
- `Back-End/tests/test_tutor_alerts.py` (novo)

**Validação**
- `pytest`: **55 passed** (+5). Ack exige tutor (403 p/ aluno), marca lido, 404 p/
  inexistente; expiração > 14 dias; dedup reabre após ack.
- Front (TS): mudança localizada (import de `Check`, `ackTutorAlert`, handler
  `treat`); build Vite roda no container (`docker compose`), não validado aqui.

---

## ✅ A.5 — read_time honesto (visibilidade + ociosidade)

**Status**: concluído (front). **Data**: 2026-07-07.

**O que foi feito**
- `OvaReader.tsx`: o ticker de leitura só conta o segundo se a aba está **visível**
  (`document.visibilityState !== "hidden"`) **e** houve atividade
  (scroll/mouse/teclado/ponteiro) nos últimos `IDLE_LIMIT_SECONDS = 180`.
- `visibilitychange`: ao voltar a ficar visível marca atividade; ao ocultar faz
  flush do delta (não perde o que já foi lido ao trocar de aba).
- Listeners de atividade adicionados/removidos no cleanup do `useEffect`.

**Decisões / desvios**
- Corrige o inverso do A1 original: antes o ticker somava 1s/s enquanto o
  componente estivesse montado (aba em background e ausência contavam como
  leitura → a métrica central superavaliava).

**Arquivos**
- `Front-End/.../components/ova/OvaReader.tsx`

**Validação**
- Front-only, sem harness de teste automatizado aqui. Validação manual: abrir OVA,
  trocar de aba ~2 min, voltar → `read_time` não subiu no intervalo (conferir via
  `/student/me`). Roda no `docker compose`.

---

## ✅ A.6 — Higiene de código + upsert atômico

**Status**: concluído. **Data**: 2026-07-07.

**O que foi feito**
- **Upsert atômico do `read_time`** (`progressRoute.py`): a acumulação passou a ser
  `COALESCE(read_time,0) + delta` **no banco** (`OVAProgress.update({...})`), não
  read-modify-write em Python. Elimina perda de delta em syncs concorrentes (duas
  abas do mesmo aluno). `perc_scrolled`/`completed` seguem por max do pré-read
  (auto-heal). `COALESCE` mantém portabilidade SQLite/MySQL.
- **`_alternatives_list` unificada**: novo `edubot/services/quiz.py` com
  `alternatives_list`; `questionRoute` e `personalizedOvaRoute` passam a importar
  dela (era duplicada — mesmo padrão do A15). É também o lar futuro da regra de
  gate do quiz (U.1).
- **Imports mortos removidos**: `import sys, os` (7 arquivos) e os comentários
  órfãos `# Add parent directories to the path...` (5 arquivos).
- **api.ts**: `getOVAQuestions`/`answerQuestion` não enviam mais `student_id` no
  corpo (o backend resolve pelo token; o contrato mentia). Call sites atualizados
  em `OvaQuiz.tsx`, `Quiz.tsx`, `Reforco.tsx`.

**Decisões / desvios**
- **Deferido de propósito** (baixo valor / alta rotatividade, sem regressão atual):
  remoção em massa dos `try/except PeeweeException` redundantes (o handler global
  já cobre) e dos `if request.method ==` mortos. Fica para uma passada dedicada;
  não bloqueia nada. Registrado aqui para não se perder.
- A unificação da lógica de status de competência em `tools.py` foi **adiada para
  D.2**, onde a ordenação muda de taxa de erro para `p_mastery` — evita refatorar
  duas vezes.
- `OVAProgress.update(updates)` recebe o dict **posicional** (chaves = objetos
  Field); `**updates` falhava com "keywords must be strings".

**Arquivos**
- `Back-End/.../routes/progressRoute.py`, `.../services/quiz.py` (novo),
  `.../routes/questionRoute.py`, `.../routes/personalizedOvaRoute.py`,
  `.../routes/{course,edubot,interaction,login,ova}Route.py` (imports),
  `.../agent/tools.py`
- `Front-End/.../services/api.ts`, `.../components/ova/OvaQuiz.tsx`,
  `.../components/Quiz.tsx`, `.../components/Reforco.tsx`

**Validação**
- `pytest`: **58 passed** (+3 tracking): delta negativo → clamp 0; delta não-numérico
  → 400; acumulação parte do valor no banco.

---

## ✅ A.7 — Testes dos fluxos descobertos

**Status**: concluído. **Data**: 2026-07-07.

**O que foi feito**
- `test_tutor_routes.py`: 403 para aluno em `/tutor/turma|alerts|evaluate`; 200 para
  tutor; 401 sem token. (Escopo de turma multi-sinal e evaluate já cobertos em
  `test_proactivity.py`.)
- `test_personalized_ova.py`: criação 201 pelo agente mock; acesso restrito ao dono
  (404 para outro aluno); a tool `criar_ova_personalizada` **filtra IDs inventados
  e de outra competência** (só persiste o válido); erro quando não há conteúdo
  válido.
- Testes de tracking do A.6 (delta) e de ack/expiração do A.4 já contabilizados.

**Arquivos**
- `Back-End/tests/test_tutor_routes.py` (novo), `.../test_personalized_ova.py` (novo)

**Validação**
- `pytest`: **67 passed** no total. Import da app inteira OK após a limpeza de
  imports.

---

# ✅ ETAPA 1 concluída (fundação)

Backend: 42 → **67 testes**, todos verdes. Perfil de ~31 → 8 queries; rotas abertas
fechadas; rate-limit no login; alertas com ciclo de vida completo; read_time
honesto; upsert atômico; duplicações removidas.

**Pendências de validação que exigem `docker compose up` (MySQL/Front real)**:
- `migration_003_indexes.sql` — aplicar e conferir `EXPLAIN`/`SHOW INDEX`.
- A.4/A.5/A.6 no front (TutorPanel ack, OvaReader idle, api.ts) — smoke test no
  navegador; build Vite roda no container.

**Deferido (registrado, não bloqueia)**: remoção em massa de `try/except`
redundante e `if request.method` morto nas rotas (A.6).

---

# ETAPA 2 — IA de navegação + Bedrock ligado

**Objetivo**: corrigir a arquitetura de informação (quiz no contexto do módulo,
com liberação por consumo) e tirar a IA do modo mock com observabilidade/custo
desde o primeiro dia. Depende da Etapa 1 (A.1 para custo de perfil; A.6 para o
serviço de quiz).

## ✅ U.1 backend — Gate de liberação do quiz

**Status**: concluído (backend). **Data**: 2026-07-08.

**O que foi feito**
- `Database/sql/migration_004_quiz_gate.sql`: `ovas.quiz_gate_perc INT DEFAULT 70`
  (idempotente). Coluna adicionada ao modelo `OVAs`.
- `edubot/services/quiz.py`: `quiz_unlocked(student, ova)` — o quiz só libera com
  `perc_scrolled >= quiz_gate_perc`; `0` desliga o gate. Retorna `(bool, {gate, perc})`.
- Enforcement **no backend** (não só UI): `/question/ova` e `/question/answer`
  (`questionRoute.py`) recusam com **403 + `{"error":"quiz_locked","gate","perc"}`**
  quando travado. Defesa em profundidade nas duas rotas.

**Decisões / desvios**
- O OVA do seed de teste passou a ter `quiz_gate_perc=0` (conteúdo introdutório,
  sem gate) para não quebrar os testes que não são sobre o gate; `test_quiz_gate`
  cria um OVA com gate 70 explícito.
- **Pedagogia corrigida**: com o gate ativo, `attempts` só nasce após consumo real
  → a taxa de erro que alimenta as regras passa a medir dificuldade, não desordem
  de navegação (era o exemplo concreto pedido pelo dono do produto).

**Arquivos**: `Database/sql/migration_004_quiz_gate.sql`,
`Back-End/edubot/data/models/ovas.py`, `.../services/quiz.py`,
`.../routes/questionRoute.py`, `Back-End/tests/test_quiz_gate.py` (novo),
`Back-End/tests/conftest.py` (seed com gate 0).

**Validação**: `pytest` **72 passed** (+5): travado sem leitura → 403 com motivo;
libera com ≥70%; gate 0 sempre aberto; `/answer` também recusa travado.

## ✅ B.2 — `agent_decisions`: auditoria, observabilidade e budget

**Status**: concluído. **Data**: 2026-07-08.

**O que foi feito**
- `Database/sql/migration_005_agent_decisions.sql` + modelo
  `edubot/data/models/agent_decisions.py` (JSONField para digest/tools/actions).
- `edubot/services/decisions.py`: `record_decision(...)` (best-effort, nunca
  quebra a requisição), `estimate_cost` (tabela de preços por 1M tokens conferida
  na doc da Anthropic — Haiku $1/$5, Sonnet $3/$15, Opus $5/$25, Fable $10/$50),
  `spent_today_usd`, `budget_exceeded` (teto diário `EDUBOT_DAILY_BUDGET_USD`).
- Registro conectado em: recomendação sob demanda (`edubotRoute`), proatividade
  (`evaluate_student`, com `trigger_type` propagado dos gatilhos: `quiz_failed`,
  `ova_completed`, `sweep`, `on_demand`). Digest **minimizado** (só primeiro nome
  + métricas; nunca RA/nome completo) — LGPD.

**Decisões / desvios**
- Preços foram confirmados via skill `claude-api` (não de memória), keyed por
  substring do model_id; mock tem custo zero e é excluído do `spent_today_usd`.
- Tokens de entrada/saída ficam 0 no mock; a captura de `usage` real será ligada
  quando o loop for generalizado (B.3/B.4) — o budget guard já opera sobre o que
  for gravado. Documentado como log-only nesta etapa.

**Arquivos**: `migration_005_agent_decisions.sql`,
`Back-End/edubot/data/models/agent_decisions.py`, `.../services/decisions.py`,
`.../services/proactivity.py`, `.../routes/edubotRoute.py`,
`.../routes/questionRoute.py`, `.../routes/progressRoute.py`,
`Back-End/tests/conftest.py` (modelo no ALL_MODELS), `.../tests/test_decisions.py` (novo).

**Validação**: `pytest` **78 passed** (+6): custo por modelo; persistência;
recomendação e erro de quiz geram decisão; budget estoura/desliga; mock não conta.

## ✅ U.4 backend — `last_access` no perfil

**Status**: concluído (backend). **Data**: 2026-07-08.

- `last_access` do OVA exposto no dict do perfil (mesma JOIN de A.1 — **zero query
  extra**; o índice `idx_ovaprogress_student` de A.2 sustenta o "continuar de onde
  parou"). Contrato estendido; golden regenerado com `last_access` fixo e estável.

**Arquivos**: `Back-End/edubot/services/student_context.py`,
`.../tests/test_profile_contract.py` (+ golden). **Validação**: 78 passed; budget ≤8 mantido.

## ✅ B.1 — Config para ligar o Bedrock

**Status**: concluído. **Data**: 2026-07-08.

- Novo `.env.example` na raiz consolidando TODAS as variáveis (banco, segurança
  A.3 — `EDUBOT_CORS_ORIGINS`/rate-limit, scheduler, IA, budget B.2). O passo a
  passo de ativação e o smoke test dos caminhos de IA já estão em `IA_AWS_SETUP.md`.
- Ligar o Bedrock real é copiar `.env.example`→`.env`, definir
  `EDUBOT_LLM_PROVIDER=bedrock` + credenciais AWS, e `docker compose up -d`.
  (Requer conta AWS com acesso ao modelo — validação fora deste ambiente.)

**Arquivos**: `.env.example` (novo).

## ✅ U.1 frontend — Quiz gate-aware

**Status**: concluído (código); build Vite não validado aqui. **Data**: 2026-07-08.

- `services/api.ts`: `quizLockFromError()` extrai `{gate, perc}` do corpo do 403.
- `Quiz.tsx` e `ova/OvaQuiz.tsx`: ao receber 403 `quiz_locked`, mostram cartão
  "Quiz bloqueado — leia X% (você está em Y%)" em vez de lista vazia. Removido o
  `student_id` fantasma (herdado do A.6) das chamadas.

**Arquivos**: `Front-End/.../services/api.ts`, `.../components/Quiz.tsx`,
`.../components/ova/OvaQuiz.tsx`. **Validação**: sem `node_modules` local para
`tsc`; mudanças pequenas espelhando padrões existentes — validar no build do container.

## ⏸️ U.8 / U.2 / U.3 / U.6 — reestruturação de navegação (DIFERIDO)

**Status**: **projetado, não implementado**. Motivo: é uma refatoração grande e
acoplada do app React (hash router com parâmetros `#/modulo/:id/:passo`, promover
o quiz a passo do módulo e **remover a aba Quiz global**, fundir Atividades,
unificar a inbox do EduBot, aposentar "Professor Mediador"). Sem `node_modules`/
build Vite neste ambiente, implementá-la às cegas arriscaria entregar um build
quebrado. O desenho está detalhado no `PLANO_EXECUCAO.md` (Etapa 2, U.8→U.6) e
pronto para executar numa sessão com `docker compose`/Vite disponível.

**Importante**: o valor pedagógico central de U.1 (gate por consumo, validado no
backend e visível no front) **já está entregue** — a aba Quiz global agora mostra
o bloqueio corretamente. A reestruturação restante é de arquitetura de informação
(mover/renomear/fundir telas), não de comportamento pedagógico.

---

# Estado da Etapa 2

Backend testável **concluído e verde (78 testes)**: gate de quiz (migrations 004/005),
`agent_decisions` com custo/budget, `last_access` no perfil. Config Bedrock pronta
(`.env.example`). Front gate-aware entregue. Reestruturação de navegação (U.8/U.2/
U.3/U.6) projetada e diferida para sessão com build Vite.

**Pendências de validação com `docker compose up`**: migrations 004/005 no MySQL;
smoke test dos 4 caminhos de IA com Bedrock real (B.1); build do front (gate-aware
+ futura reestruturação).

---

# ✅ VALIDAÇÃO EM STACK REAL (docker compose) — 2026-07-08

Subida limpa (`docker compose up -d --build`, volume novo): `ova_db` healthy,
`ova_back_end`/`ova_front_end` running, `ova_react_build` exit 0.

**Migrations (initdb, volume novo) — todas aplicadas e conferidas:**
- 001 i18n (`ovas.ova_name_en` presente), 003 índices (`idx_attempts_student` etc.),
  004 `ovas.quiz_gate_perc`, 005 tabela `agent_decisions`.

**Smoke test da API (MySQL real) — tudo verde:**
- Login (RA 1) + token; `/student/me` monta o perfil agregado (A.1) — nome, curso,
  4 OVAs, 9 competências; campo `last_access` (U.4) presente.
- **Gate de quiz (U.1)**: `/question/ova` sem leitura → **403 `{"error":"quiz_locked",
  "gate":70,"perc":0}`**; após `/progress/ova` com perc 95 → **200 + 9 questões**.
- Correção server-side: resposta errada → `is_correct:false`.
- **Proatividade (A13)**: intervenção `trilha_minima` criada **sem clique**.
- **`agent_decisions` (B.2)**: decisões gravadas (`ova_completed`, `on_demand`);
  `quiz_failed` pulado pelo guard de custo A9 (esperado — já havia pendente do dia).
- i18n: `/student/me?lang=en` → "Quantum Computing".

**Front (build no container):** `npm run build` = `tsc && vite build` saiu **0** →
as mudanças TS da Etapa 2 (gate-aware `Quiz`/`OvaQuiz`, `quizLockFromError`)
**type-checaram e compilaram**. App servido em `http://localhost:8010/app/` com
bundle React (`assets/index-*.js`).

**Conclusão**: Etapas 1 e 2 (backend + front gate-aware) validadas ponta a ponta na
stack real. Resta, quando desejado: smoke test dos caminhos de IA com Bedrock
credenciado (B.1) e a reestruturação de navegação diferida (U.8/U.2/U.3/U.6).

---

# ETAPA 3 — Dados que valem algo (eventos, LGPD, mastery) — 2026-07-08

Objetivo: schema de eventos unificado (D.1), base legal estruturada (D.5) e o
modelo do aluno por BKT que substitui o limiar binário (D.2). Majoritariamente
backend e, portanto, testável. **103 testes verdes; build do front exit 0;
validada em stack real (volume limpo).**

## D.1 — `learning_events` (xAPI-lite)

- **migration_006_learning_events.sql** (idempotente): tabela `learning_events`
  (verbo + object_type + object_id + `context` JSON + `occurred_at`) + índices
  `idx_events_student`/`idx_events_verb`.
- **Model** `data/models/learning_events.py` (`BigAutoField`, `JSONField`).
- **Service** `services/events.py`: enum de VERBS/OBJECT_TYPES (fonte única),
  `emit(...)` best-effort (nunca quebra a requisição), `emit_batch(...)` para o
  lote do front. Minimização LGPD: `asked_tutor.context.text` só é gravado com
  consentimento `ia_sobre_dados` (import preguiçoso de `consents`).
- **Rota** `POST /events` (`api/routes/eventRoute.py`): aceita `{events:[...]}`
  ou objeto único; máx. 50/req (400 se exceder); aluno **do token**; item
  inválido conta como erro sem derrubar o lote; lote todo inválido → 400.
- **Ganchos internos**: `/question/answer` emite `answered` (com `correct`,
  `response_ms`, `competency_id`); proatividade emite `received_intervention` ao
  criar intervenção; ack de intervenção emite `dismissed`.
- **5ª fonte de inatividade**: `_days_without_access` passou a incluir
  `learning_events` no `union_all` (mesma query — não aumenta o budget do perfil).
- **Front**: `services/events.ts` (fila em memória, flush a cada 15 s + `pagehide`/
  `visibilitychange` com keepalive); instrumentados `logged_in` (Login), `opened`
  (OvaReader) e `response_ms` no quiz (Quiz/OvaQuiz).

## D.5 — Consentimento (LGPD)

- **migration_007_consents.sql** (idempotente): `consents` com UNIQUE
  (student_id, purpose).
- **Model** `data/models/consents.py`; **Service** `services/consents.py`:
  `PURPOSES` (tracking_pedagogico = execução de contrato, default concedido e
  **não revogável**; ia_sobre_dados / imagem_voz = opt-in revogável),
  `has_consent`, `set_consent` (upsert com granted_at/revoked_at),
  `current_consents`.
- **Rotas** (`api/routes/consentRoute.py`): `GET /consents`, `POST /consents`,
  `POST /student/me/delete-request` (cria alerta de admin, idempotente).
- **Enforcement no backend (não só UI)**:
  - texto de `asked_tutor` minimizado sem consentimento (em `events.emit`);
  - `get_recommendation(..., allow_llm=...)` — proatividade e `/edubot/recommendation`
    passam `allow_llm=has_consent(ia_sobre_dados)`; sem consentimento o agente roda
    **só as regras** (sem LLM) para aquele aluno;
  - `coach_message` retorna None (texto local) sem consentimento.
- **Front**: `ConsentModal` no primeiro login (flag `edubot.consent.v1`); painel
  `MyDataPanel` ("Meus dados") com toggles de consentimento, export JSON promovido
  e "solicitar exclusão" (substituiu o card de export do Report).

## D.2 — Mastery por competência (BKT + decaimento)

- **migration_008_mastery.sql** (idempotente): `student_mastery` (chave composta
  student_id+competency_id, `p_mastery`, `attempts_seen`, `updated_at`).
- **Model** `data/models/student_mastery.py` (`CompositeKey`).
- **Service** `services/mastery.py`: BKT clássico (P_INIT .20 / P_LEARN .15 /
  P_SLIP .10 / P_GUESS .25) + `DECAY_PER_WEEK .02` (decai em direção a P_INIT, nunca
  abaixo). `update_on_attempt` (1 upsert, INSERT/UPDATE explícito p/ chave composta),
  `status_from_mastery` (mantém os 3 rótulos da UI), `mastery_map`.
- **Gancho**: `/question/answer` chama `update_on_attempt` após gravar a tentativa
  (best-effort). **Backfill** `tools/backfill_mastery.py` (`python -m
  tools.backfill_mastery`): recomputa do zero em ordem cronológica — idempotente.
- **Perfil**: `_competency_rows` ganhou LEFT JOIN com `student_mastery`
  (`fn.MAX(p_mastery)`, mesma query — budget ≤8 mantido); status deriva de
  `p_mastery` e expõe `dominio_estimado` (0..1). **Degradação segura**: sem linha
  de mastery, cai na razão acertos/total antiga.
- **Agente**: `listar_competencias_fracas` ordena por domínio ascendente
  (p_mastery quando existe) e expõe `dominio_estimado`.
- **Front**: teia de competências (Evolution) usa `dominio_estimado` quando
  presente (fallback %acertos); tooltip e legenda passam a dizer "domínio".

## Testes (Back-End/tests/) — 42→78→**103**

- `test_events.py` (9): lote válido/ inválido, limite 50, auth, `answered` com
  `response_ms`, minimização de texto do tutor com/sem consentimento.
- `test_consents.py` (8): defaults, grant/revoke opt-in, tracking não-revogável,
  purpose inválido, delete-request (cria alerta + idempotente), auth.
- `test_mastery.py` (8): valores BKT calculados à mão (correto→0.55263,
  errado→0.17742), monotonicidade, decaimento (4 sem →0.752; satura em P_INIT),
  `status_from_mastery`, backfill idempotente, `dominio_estimado` no perfil.
- `conftest.py`: +LearningEvents/Consents/StudentMastery em ALL_MODELS.
- **golden_profile.json regenerado** (novo campo `dominio_estimado`; budget ≤8 ok).

## ✅ Validação em stack real (docker compose, volume limpo) — 2026-07-08

- **Migrations 006/007/008** aplicadas (tabelas `learning_events`, `consents`,
  `student_mastery` conferidas por `information_schema`).
- **D.1**: `POST /events` lote com 1 verbo inválido → `{"accepted":2,"errors":1}`;
  `answered` gravado com `correct=false`, `response_ms=5300`.
- **D.5**: `GET /consents` devolve os 3 defaults (tracking granted/opt_in=false);
  `POST` concede `ia_sobre_dados` com `granted_at`.
- **D.2**: responder questão → `student_mastery` (comp 1) `p_mastery=0.1774`,
  `attempts_seen=1` (**bate com o teste unitário**); perfil expõe
  `dominio_estimado=0.18`, status "não iniciada" (<0.40); competências sem
  tentativa vêm com `dominio=None` (fallback). **Backfill** rodou no container e é
  idempotente (2 execuções → mesmo estado).
- **Front**: `tsc && vite build` **exit 0** — `events.ts`, `ConsentModal`,
  `MyDataPanel`, `response_ms` e a teia por domínio type-checaram e compilaram.

**Gate de saída da Etapa 3 atingido**: eventos fluindo (por verbo), consentimento
aplicado nos caminhos de IA, mastery visível no perfil/teia e alimentando as regras.

**Diferido (documentado)**: eventos discretos de player (played/paused/seeked) e
`asked_tutor` via TutorChat; delegação `interactions`→`/events`; job mensal de
retenção + `events_archive`; smoke dos caminhos de IA com Bedrock credenciado (B.1).

---

# ✅ B.1 — IA REAL (Amazon Bedrock) LIGADA E VALIDADA — 2026-07-09

Ligado o Claude real via **Bedrock API key (bearer token)** — o caminho de IA que
estava pendente desde a Etapa 2 agora foi exercitado ponta a ponta.

**Descobertas e ajustes (contra o SDK real `anthropic` 0.116.0 no container):**
- O `llm.py` usava `AnthropicBedrockMantle` (cliente de outro produto). Trocado por
  **`AnthropicBedrock`** (cliente do Amazon Bedrock — a key decodifica para
  `bedrock.amazonaws.com/?Action=CallWithBearerToken`).
- **Bearer token**: o SDK resolve `AWS_BEARER_TOKEN_BEDROCK` do ambiente como
  `api_key` automaticamente — nenhuma mudança de assinatura necessária. Adicionado
  o passthrough dessa env no `compose.yaml` (não era repassada ao container).
- **Model id**: modelos recentes NÃO aceitam invocação on-demand por
  `anthropic.<modelo>` → 400 "on-demand throughput isn't supported". Precisam de
  **inference profile** (prefixo `us.`/`global.`). Ids confirmados por
  `list_inference_profiles` e fixados no `.env`:
  `us.anthropic.claude-sonnet-4-6` (recomendação/tool-use) e
  `us.anthropic.claude-haiku-4-5-20251001-v1:0` (coach).

**Smoke test (endpoints reais):**
- `/edubot/coach-message` → `ai:true`, model `claude-haiku-4-5-20251001`, fala
  gerada pela LLM.
- `/edubot/recommendation` (com consentimento `ia_sobre_dados`) → `mock:false`,
  model `claude-sonnet-4-6`, `tipo:trilha_minima` redigido pela LLM.

**Segurança/operacional:** a key usada é **temporária (~12h)**; para uso contínuo,
trocar por uma de longa duração. O `.env` (com o segredo) não deve ser comitado.

---

# ETAPA 4 (backbone) — Agente de verdade (loop, redação por caso, revisão) — 2026-07-09

Backbone da Etapa 4 entregue e testável: **123 testes verdes; build front exit 0;
B.4 validado com Bedrock real.** B.5 (fila de aprovação), U.5/U.7 (frontend) e o
sweep top-N ficam para a próxima fatia (documentados abaixo).

## B.4a — Circuit breaker do provider (llm.py)

- N falhas CONSECUTIVAS da LLM (`EDUBOT_LLM_BREAKER_THRESHOLD`, default 3) →
  `is_real()` passa a devolver False por `EDUBOT_LLM_BREAKER_COOLDOWN` (600 s) →
  os caminhos degradam para template/mock sem tentar a rede (evita pagar timeout
  em cascata no sweep). Um sucesso zera o contador. `messages_create` alimenta o
  breaker (success/failure) e repropaga a exceção (chamadores já degradam).

## D.3 — Revisão espaçada (SM-2 simplificado)

- **migration_009_reviews.sql** + model `review_schedule.py` (uc UNIQUE
  student+competency+due).
- **services/reviews.py**: `schedule` (idempotente, reusa a revisão ativa),
  `register_result` (acerto na data → intervalo × ease, teto 60d; erro → 1 dia,
  ease −0.2, piso 1.3), `on_attempt` (orquestra: aplica resultado + agenda a 1ª
  revisão quando p_mastery ≥ 0.8), `mark_due_reviews`, `due_reviews`.
- **Gancho** em `/question/answer` (após o BKT). **Sweep** (`run_class_evaluation`)
  marca vencidas e cria a intervenção "hora de revisar X" (dedup/dia).
- **Rota** `GET /reviews` + front `ReviewsPanel` em "Meu desempenho".

## B.3 — Loop de tool-use genérico + catálogo com tiers

- **agent/loop.py** `run_agent(system, user_prompt, tools_schema, ctx, *, model,
  max_iterations, trigger_type, mock_client, input_digest)`: plumbing único
  (montagem de mensagens, `execute_tool`, coleta de actions/tools_called/usage) e
  registro SEMPRE em `agent_decisions` (B.2). Cérebro injetável: LLM real quando
  `is_real()`, senão o `mock_client` do fluxo.
- **personalized.py** virou um CASO do loop (system prompt + mock específico +
  mapeamento do resultado). Regressão `test_personalized_ova` continua verde.
- **tools.py**: catálogo `TOOLS` com metadado `tier`
  (read|auto|auto_capped|auto_or_queue|queue) + `tier_of`; tools novas com
  IDEMPOTÊNCIA na própria tool: `obter_perfil_resumido` (read), `criar_intervencao`
  (auto — dedup por aluno+tipo+dia, fonte única antes espalhada na proatividade),
  `agendar_revisao` (auto — valida competência do curso). `schema_for(names)`
  monta o toolset de cada fluxo.

## B.4b — Intervenção redigida por caso (Haiku)

- **agent/redactor.py** `redigir_intervencao(digest, rec, lang)`: a regra decide
  se/o quê (grátis); o Haiku redige o como (barato, `max_tokens=250`, system fixo
  com `cache_control` ephemeral = prompt caching); template é o fallback.
- Ligado em `proactivity.evaluate_student`: só quando `allow_llm` (consentimento
  D.5) **e** `trigger_type != "sweep"` **e** `not budget_exceeded()` (B.2). O
  digest inclui as **últimas 3 perguntas ao tutor** (D.1) — o que mata o texto
  genérico. Qualquer falha → template (best-effort).

## Testes (Back-End/tests/) — 103→**123**

- `test_breaker.py` (3): abre após N falhas, sucesso zera, cooldown expira.
- `test_reviews.py` (8): schedule idempotente, acerto expande (3→8), erro reseta
  (ease 2.5→2.3), fora da data não altera, auto-agenda em mastery≥0.8, sweep marca
  vencida, rota `/reviews`.
- `test_agent_loop.py` (6): loop executa tools + registra decisão, exige brain no
  mock, `criar_intervencao` idempotente, `agendar_revisao` valida posse, tiers,
  `schema_for`.
- `test_redactor.py` (3): None no mock (usa template), usa Haiku + system cacheável
  quando real, fallback em erro.
- `conftest.py`: +ReviewSchedule.

## ✅ Validação em stack real (docker compose, volume limpo) — 2026-07-09

- **migration_009** (`review_schedule`) aplicada; front build **exit 0** (valida
  `ReviewsPanel` + `getReviews`).
- **B.4 com Bedrock real**: errar quiz (com consentimento) → intervenção **redigida
  para o caso** ("Olá, Eduardo!… 10% dos recursos… Computação Quântica"), não o
  template; `agent_decisions.mock=0`, model `claude-sonnet-4-6`.
- `GET /reviews` responde (vazio — mastery<0.8; agendamento coberto por testes).

**Diferido (documentado)**: B.5 (fila de aprovação do tutor + `alertar_tutor`/
`propor_mensagem_do_tutor` + `ajustar_dificuldade`, que depende de D.4); U.5
(onboarding) e U.7 (acessibilidade), frontend; sweep top-N do redator; registrar
o custo/tokens da chamada do redator em `agent_decisions` (hoje a redação é uma
chamada LLM separada não contabilizada no budget — refinamento de observabilidade).

---

# ETAPA 5 (D.4 + D.6 + V.1) — Voz e presença + pool adaptativo — 2026-07-09

Entregues os itens testáveis da Etapa 5 e o que destrava o B.5: **137 testes
verdes; build front exit 0; validado em stack real.** V.2 (avatar falante nos
cards) e o wiring de visema no avatar 3D ficam para a próxima fatia.

## D.4 — Dificuldade por questão + pool adaptativo

- **migration_010_difficulty.sql** (idempotente): `questions.difficulty TINYINT
  DEFAULT 2` (1 fácil · 2 média · 3 difícil). Model atualizado.
- **services/quiz.py**: `difficulty_ceiling(mastery)` (domina ≥0.8 → libera
  difícil; senão teto média) + `adaptive_pool(questions, mastery_by_competency)`
  (filtra por teto, ordena fácil→difícil, **nunca devolve quiz vazio**).
- **/question/ova** aplica o pool com `mastery_map` do aluno; expõe `difficulty`
  na questão. Zona proximal, determinístico. Destrava a tool `ajustar_dificuldade`
  (B.5).
- **tools/calibrate_difficulty.py** (one-off, idempotente): calibra por taxa de
  erro histórica (<25%→1, 25–60%→2, >60%→3).
- Testes (6): ceiling, exclui difícil quando baixo, inclui/ordena quando domina,
  nunca vazio, integração `/question/ova`, calibração.

## D.6 — Heatmap de mastery do tutor

- **GET /tutor/mastery** (staff): por competência do curso, média de domínio +
  distribuição (frágil/em desenvolvimento/desenvolvida) e a **matriz aluno ×
  competência** (1 query agregada em `student_mastery`). `.dicts()` evita a
  ambiguidade de FK no join.
- Front: **MasteryHeatmap** (grid colorido por p_mastery, sem lib nova) no
  TutorPanel. Testes (2): heatmap agrega/distribui, exige staff (403 p/ aluno).

## V.1 — Voz do EduBot (Polly neural + visemas + cache)

- **services/speech.py**: `synthesize(text, lang)` → mp3 + timeline de visemas,
  com **cache por hash** (lang|voz|texto) em `EDUBOT_SPEECH_CACHE_DIR`. Vozes
  neurais `Camila`/`Joanna` (env-overridable). **Degradação graciosa**: sem
  credencial de Polly (a Bedrock key NÃO cobre Polly), sem boto3 ou em falha →
  devolve None (memoiza a indisponibilidade, não retenta).
- **POST /edubot/speak** (auth) → `{available, audio_url, visemes, cached}`;
  **GET /edubot/speech/<key>.mp3** (sem auth — voz do BOT, não é dado do aluno;
  key = sha256 valida contra path traversal), `Cache-Control` 1 dia.
- Front: **useSpeech.ts** ganhou modo Polly (toca mp3 + timeline de visemas via
  `requestAnimationFrame` contra `audio.currentTime`, expõe `visemeRef`) mantendo
  a interface (`speak/stop/speaking/supported`); **fallback Web Speech** quando
  `available:false`. Emite evento `played`/speech (métrica V.1).
- Testes (6): available/unavailable, auth, mp3 404, guarda de path traversal,
  parse de visemas.

## ✅ Validação em stack real (docker compose, volume limpo) — 2026-07-09

- **migration_010** (`questions.difficulty`) aplicada; front build **exit 0**
  (valida MasteryHeatmap, useSpeech, api.ts).
- **D.4**: `/question/ova` serve o pool com `difficulty`; calibração roda no
  container (0 calibradas em DB novo — sem histórico, esperado).
- **V.1**: `/edubot/speak` → `{"available": false}` (Polly sem credencial) →
  fallback Web Speech. Degradação graciosa confirmada.
- **D.6**: `/tutor/mastery` responde (9 competências; matriz vazia em DB novo —
  sem mastery ainda). Exige staff.

**Diferido (documentado)**: V.2 (avatar falante nos cards de intervenção +
persona persistida em localStorage), mapeamento de visema→boca no `Avatar3D`/
`EduBotAvatar`, tendência de domínio do aluno (snapshot de 7 dias), e a chamada
REAL do Polly (depende de credencial de voz separada — `polly:SynthesizeSpeech`).

---

# B.5 — Ações novas + fila de aprovação do tutor (destravado por D.4) — 2026-07-09

Fechado o único item da Etapa 4 que dependia da Etapa 5: a tool
`ajustar_dificuldade` precisava do `questions.difficulty` (D.4). **146 testes
verdes; build front exit 0; fila validada end-to-end em stack real.**

## DB (migrations 011/012)

- **migration_011_student_difficulty.sql** + model `StudentDifficulty` (chave
  composta aluno+competência, `level` 1..3): override de dificuldade por aluno.
- **migration_012_alert_approval.sql**: estende `alerts` com `status`
  (aberto|aguardando_aprovacao|aprovado|rejeitado), `proposed_action` (JSON) e
  `decision_id` — `alerts` passa a ser também a FILA DE APROVAÇÃO.

## Tools novas (com tiers de autonomia reais)

- **`ajustar_dificuldade`** (tier `auto_capped`): ±1 nível por vez, **teto de 1
  mudança/dia** por competência (validado NA TOOL, não no prompt), clamp [1,3],
  valida posse da competência. Efeito real via `student_difficulty`.
- **`alertar_tutor`** (tier `auto_or_queue`): severidade baixa/media → alerta
  direto (`status=aberto`); **alta → fila** (`aguardando_aprovacao`), sem
  notificar o aluno. Dedup por (aluno, tipo) não lido.
- **`propor_mensagem_do_tutor`** (tier `queue`): SEMPRE entra na fila; nada é
  enviado ao aluno sem aprovação. `proposed_action` guarda a mensagem a executar.

## Pool adaptativo com override (D.4 + B.5)

- `adaptive_pool(questions, mastery, difficulty_overrides)`: quando há override
  de dificuldade, o teto é `min(3, level+1)`; senão deriva do domínio (D.4).
  `/question/ova` passa o mapa `difficulty_overrides_for(student)`.

## Fila de aprovação (rotas + execução)

- **GET /tutor/queue** (staff): itens `aguardando_aprovacao` do curso (com
  `proposed_action` + justificativa). Filtrados da central de alertas (não
  duplicam).
- **POST /tutor/queue/approve** / **/reject**: aprovar **executa** a
  `proposed_action` (ex.: intervenção assinada "mensagem_tutor" para o aluno) e
  marca `aprovado`; rejeitar marca `rejeitado`. **Idempotente**: só age enquanto
  `aguardando_aprovacao` (reaprovar → 404). Seta `outcome` na decisão vinculada
  (gancho para B.6).
- Front: **ApprovalQueue** ("Ações propostas pelo EduBot") no TutorPanel, com
  Aprovar/Rejeitar; some quando a fila está vazia.

## Testes (Back-End/tests/) — 137→**146**

- `test_approval_queue.py` (9): ajustar_dificuldade (seta/teto-dia/clamp/posse),
  override afeta o pool de `/question/ova`, alertar_tutor (media=aberto,
  alta=fila), propor_mensagem (nunca cria intervenção direto), aprovar executa
  UMA vez (idempotência), rejeitar sem efeito ao aluno, fila exige staff.

## ✅ Validação em stack real (docker compose, volume limpo) — 2026-07-09

- **migrations 011/012** aplicadas (`student_difficulty`; `alerts.status/
  proposed_action/decision_id`); front build **exit 0** (valida ApprovalQueue).
- **Fila end-to-end**: item `aguardando_aprovacao` → GET /tutor/queue mostra a
  mensagem → **approve** cria a intervenção `mensagem_tutor` (id 1) para o aluno
  → **reaprovar → 404** (executa uma vez só).

**ETAPA 4 agora 100% do backbone + B.5.** Diferido: U.5 (onboarding) e U.7
(acessibilidade), ambos frontend; sweep top-N do redator (B.4).

---

# ETAPA 6 — B.6: outcomes (o agente aprende com o efeito das ações) — 2026-07-09

Fechado o loop de aprendizado do agente. **155 testes verdes; build front exit 0;
loop validado end-to-end em stack real.** V.3/V.4/V.5 (avatares GLB + licenças)
ficam diferidos por design (o próprio plano os condiciona às métricas do V.2 e a
trabalho jurídico).

## B.6 — `outcome`: o EduBot observa o efeito do que fez

- **Baseline no digest** (`proactivity.evaluate_student`): a decisão passa a
  gravar `competencia_alvo_id` + `mastery_alvo` (domínio da competência mais
  fraca no momento) — base para o job medir "melhorou".
- **services/outcomes.py** `compute_outcomes()` (job diário, ligado no sweep):
  para cada `agent_decisions` com `outcome IS NULL` e idade ≥ 2 dias, classifica
  a partir dos eventos (D.1) e do domínio (D.2) posteriores:
    · **melhorou** — domínio da competência-alvo subiu ≥ 0.1 desde a decisão;
    · **aceita** — voltou a estudar (opened/answered/played/read/completed) em ≤7d;
    · **dispensada** — houve `dismissed` e nenhum engajamento em 7d;
    · **expirada** — nada em 14d.
  `outcomes_summary(student)` → {outcome: contagem} p/ o redator e o agente.
- **Redator (B.4)**: o digest ganha `historico_outcomes`; o system prompt instrui
  a **VARIAR a abordagem** quando intervenções recentes foram dispensadas.
- **Tool `historico_intervencoes`** (tier read): devolve o resumo + as últimas
  decisões com outcome — o agente evita repetir o que não funcionou.
- **KPI do tutor**: `GET /tutor/agent-kpi` — taxa de aceitação por tipo de
  intervenção (aceita+melhorou = sucesso), últimos 60 dias da turma. Front:
  card **AgentKpi** no TutorPanel.
- A fila de aprovação (B.5) já setava `outcome` (aceita/dispensada) na aprovação/
  rejeição — o job cobre o resto (proatividade, on_demand, personalized_ova).

## Testes (Back-End/tests/) — 146→**155**

- `test_outcomes.py` (9): aceita (engajou em 7d), dispensada (dismissed sem
  engajamento), melhorou (domínio subiu ≥0.1), expirada (14d), jovem demais fica
  pendente, idempotência, outcomes_summary, tool historico_intervencoes, rota
  /tutor/agent-kpi (taxa 0.67 em 2/3 sucesso).

## ✅ Validação em stack real (docker compose) — 2026-07-09

- Front build **exit 0** (valida AgentKpi + api.ts). Sem migration nova (usa
  `agent_decisions.outcome` da migration_005 + learning_events + student_mastery).
- **Loop completo**: `/edubot/recommendation` grava a decisão → evento `opened`
  → decisão backdatada 3 dias → `compute_outcomes` classifica **aceita** →
  `/tutor/agent-kpi` mostra `trilha_minima` com **taxa de aceitação 1.0**.

**Diferido (documentado)**: V.3 (pipeline GLB/VRM com blendshapes — só se as
métricas do V.2 justificarem), V.4 (avatar_licenses + termo jurídico + piloto
professor), V.5 (vídeo generativo, opcional). Também pendentes de etapas
anteriores: U.5 (onboarding) e U.7 (acessibilidade), frontend; V.2 (avatar
falante nos cards); chamada REAL do Polly (credencial de voz) e do sweep top-N.

---

# FRONTEND — U.5 (onboarding) + V.2 (avatar falante) + U.7 (acessibilidade) — 2026-07-09

Fechados os itens de frontend pendentes das Etapas 4/5. **Build `tsc && vite build`
exit 0** (todas as mudanças type-checaram e compilaram); backend intacto (155 testes).

## V.2 — Avatar falante nos momentos de fala + persona persistida

- **services/persona.ts**: a escolha de avatar (EduBot/Einstein/Curie) passa a ser
  lembrada em localStorage (`edubot.persona`) — antes resetava a cada visita. O
  `PerformanceCoach` lê/grava e marca `aria-pressed` no seletor.
- **Cards de intervenção (Dashboard/EduBotInbox)**: cada recomendação ganhou botão
  **Ouvir** (usa `useSpeech` — Polly com fallback Web Speech) e um **mini-avatar**
  do EduBot que anima a boca só no card que está falando.

## U.5 — Onboarding no primeiro login

- **OnboardingModal**: 3 passos apresentados pelo avatar FALANTE — "seus módulos
  estão aqui" → "o quiz libera após a leitura" → "eu aviso você por aqui". Botão
  Ouvir por passo, Pular/Próximo/Começar, indicador de passos. Flag
  `edubot.onboarding.v1`. No `App`, aparece logo APÓS o consentimento (D.5).
- **Estado vazio do dashboard**: conta zerada (nada consumido, sem leitura) mostra
  um banner acolhedor com CTA **"Abrir meu primeiro módulo"**.

## U.7 — Acessibilidade

- **aria-live**: container de toasts vira região `aria-live="polite"`; o feedback
  de correção do quiz (Correta!/Incorreta.) ganhou `role="status"` (Quiz + OvaQuiz).
- **Modais**: `ConsentModal` e `OnboardingModal` viraram `role="dialog"` +
  `aria-modal` + `aria-labelledby`, com foco inicial no diálogo; o onboarding
  fecha no **Esc**.
- **prefers-reduced-motion**: o `EduBotAvatar` desliga flutuar/piscar/falar para
  quem pediu menos movimento.
- **Teclado**: `Carousel` navegável por setas ←/→ (role="group", tabIndex, foco
  visível). `Accordion` já era acessível (`<button>` + `aria-expanded`).

## Diferido (documentado)

- Wiring de visema → boca no `Avatar3D`/`EduBotAvatar` (o `visemeRef` do V.1 já
  está pronto; falta mapear no 3D); gestão de foco do `TutorChat`; V.3/V.4
  (avatares GLB + licenças, condicionados às métricas do V.2); tendência de
  domínio do aluno (snapshot 7d); chamada REAL do Polly (credencial de voz).

**Status do roadmap**: as 6 etapas têm o backbone entregue e o frontend do aluno
fechado (onboarding, voz, acessibilidade). Restam apenas itens condicionados a
recursos externos (voz AWS, avatares GLB + jurídico) — nada bloqueante.

---

# AUDITORIA DE CONSISTÊNCIA — Etapas 1 a 6 (2026-07-10)

Revisão completa do que foi entregue contra o `PLANO_EXECUCAO.md`, item a item
(A.1–A.7, U.1/U.4/U.5/U.7, B.1–B.6, D.1–D.6, V.1–V.2). Baseline: 155 testes
verdes. A auditoria encontrou **7 defeitos/lacunas reais** — todos corrigidos
na hora; suíte final: **160 testes verdes**, build do front exit 0, correções
validadas no stack real.

## Defeitos encontrados e corrigidos

1. **(B.5/B.6) `alerts.decision_id` nunca era escrito** — o approve/reject do
   tutor lia `alert.decision_id` para marcar o outcome da decisão, mas nenhum
   código o preenchia: o loop de aprendizado do agente ficava mudo para itens
   de fila. Fix: `agent/loop.py` liga os alertas `aguardando_aprovacao` criados
   na execução à decisão recém-registrada (ignorando itens dedup de execuções
   anteriores). Teste: `test_queue_item_linked_to_decision_and_outcome`.
2. **(B.5) `propor_mensagem_do_tutor` sem dedup** — execuções sucessivas do
   agente empilhavam propostas idênticas na fila do tutor. Fix: enquanto houver
   proposta pendente do aluno, a tool devolve a existente (`dedup: true`) —
   mesma política das demais tools de escrita. Teste:
   `test_propor_mensagem_dedup_while_pending`.
3. **(D.1) `_parse_dt` descartava o fuso** — o front manda `toISOString()`
   (UTC, sufixo Z) e o backend gravava o RELÓGIO UTC como hora local (no host
   em UTC-3, eventos 3h no futuro — o bastante para virar fronteira de dia da
   inatividade e das janelas de outcome). Fix: converte ao fuso local antes de
   descartar o tzinfo. Teste: `test_parse_dt_converts_utc_to_local`.
4. **(B.4) Redator quebrado na Bedrock por configuração** — `compose.yaml` só
   repassa variáveis LISTADAS; as da Etapa 4/5 (`EDUBOT_REDACTOR_*`,
   `EDUBOT_LLM_BREAKER_*`, `EDUBOT_DAILY_BUDGET_USD`, `EDUBOT_SPEECH*`,
   `EDUBOT_POLLY_*`, `EDUBOT_COACH_MAX_TOKENS`) não chegavam ao container. O
   redator caía no default `claude-haiku-...` → prefixado `anthropic....` → 400
   na Bedrock (exige inference profile) → toda redação falhava E alimentava o
   circuit breaker (3 intervenções derrubariam TODA a IA por 10 min). Fixes:
   passthrough completo no compose; `EDUBOT_REDACTOR_MODEL` explícito no
   `.env`/`.env.example` (id de inference profile); e o redator agora HERDA o
   `EDUBOT_COACH_MODEL` quando não configurado (mesmo papel de Haiku barato).
5. **(B.2) Orçamento cego para coach e tutor-chat** — `record_decision` não era
   chamado nesses dois caminhos (o plano pedia), então chamadas REAIS ao
   Bedrock não entravam em `spent_today_usd()` — justamente os endpoints que o
   aluno pode chamar à vontade. Fix: coach registra a própria chamada real
   (tokens/latência); `tutor_reply` devolve `usage` e a rota registra
   (`trigger=chat`, só metadados).
6. **(D.1→B.4) `asked_tutor` nunca era emitido** — o front foi diferido, mas
   ninguém emitia o evento; `_last_tutor_questions` (o que torna a intervenção
   do redator ESPECÍFICA) lia uma tabela eternamente vazia. Fix: a rota
   `/edubot/tutor-chat` emite `asked_tutor` no backend — a minimização LGPD já
   acontece em `events.emit` (sem consentimento, `text: null`). Teste:
   `test_tutor_chat_emits_asked_tutor`.
7. **(D.1) `completed` nunca era emitido** — o plano lista o verbo na
   instrumentação (e `ENGAGE_VERBS` do B.6 o consome), mas nenhum código o
   gravava. Fix: `/progress/ova` emite `completed` na TRANSIÇÃO de conclusão
   (uma vez só). Teste: `test_ova_completion_emits_completed`.

## Verificado e OK (sem mudança)

- A.1 perfil em 8 queries + contrato golden; A.2 índices; A.3 auth/CORS/429;
  A.4 ack + expiração 14d; A.5 ticker visibilidade/idle; A.6 upsert atômico;
  U.1 gate no backend (listagem + correção); B.2 trilha/custo/budget; D.2 BKT +
  decay + degradação segura; D.3 SM-2 + sweep; D.4 pool adaptativo (nunca
  vazio) + override B.5 (teto 1/dia); D.5 enforcement no backend (texto
  minimizado, `allow_llm`, tracking não revogável); D.6 heatmap; V.1 Polly com
  fallback memoizado + validação anti path-traversal da key; V.2/U.5/U.7;
  B.6 outcomes (precedência melhorou > aceita > dispensada > expirada);
  migrations 003–012 idempotentes e em paridade com os models.

## Observações (não são defeitos; decisões documentadas)

- Flags de consentimento/onboarding são por NAVEGADOR (localStorage), não por
  usuário — aceitável no protótipo; revisar se houver máquinas compartilhadas.
- `review_schedule.status='cumprida'` existe no schema mas o fluxo mantém a
  revisão ativa avançando (design do módulo); `BEDROCK_MODEL_ID` hardcoded nos
  mocks é só rótulo de envelope simulado.
- No container o relógio é UTC (o fix nº 3 é neutro lá e correto em qualquer
  outro fuso — host de testes é UTC-3).
- O bearer token da Bedrock EXPIROU (era temporário ~12h): coach/tutor-chat
  degradam para mock graciosamente (verificado ao vivo). Para religar a IA
  real, gere uma nova Bedrock API key e atualize `AWS_BEARER_TOKEN_BEDROCK` no
  `.env` + `docker compose up -d ova_flask`.

**Validação final**: `pytest` 160/160 · `ova_react_build` exit 0 · front HTTP
200 · smoke no stack real (tutor-chat → evento `asked_tutor` minimizado no
MySQL; evento com `occurred_at` UTC convertido; fallback de IA sem 500).

---

# ETAPA 7 (Plano 2) — O Reforço percebe como o aluno aprende (2026-07-11)

Primeira etapa do `PLANO_EXECUCAO_2.md`. Objetivo: a trilha de reforço, a
recomendação e o redator passam a usar preferência de aprendizagem REAL; nasce o
histórico diário de domínio que a Etapa 8 vai ilustrar. **174 testes verdes**
(eram 160 no fim da auditoria), build do front exit 0, validado no stack real.

## P.1 — Serviço de preferência de aprendizagem (sem tabela nova)

- **services/preferences.py** — `learning_preference(student_id, profile=None)`
  cruza 3 sinais que já existiam: (1) taxa de CONCLUSÃO por formato
  (`consumption_by_type`), (2) resposta às intervenções por formato
  (`agent_decisions.input_digest.formato_sugerido` × `outcome` — o B.6 vira
  sensor), (3) dificuldade confortável (`attempts × questions.difficulty`).
  `preferred_format(...)` só devolve o formato quando `confianca >= 0.4` —
  degradação segura é o default (sem sinal ⇒ comportamento atual).
- **student_context.py** — `preferencia_formato` do perfil passou a ser por
  CONCLUSÃO (`concluidos`), não por consumo. MESMA query — o perfil segue em
  ≤ 8 queries (contrato golden intacto).
- **proactivity.py / edubotRoute.py** — o digest das decisões passou a gravar
  `formato_sugerido` (é o que o sensor de P.1 e o KPI de P.3 leem).

## P.2 — Reforço e OVA personalizada no formato do aluno

- **tools.py** `listar_recursos_remediacao` ordena os recursos pelo formato
  preferido (estável) e expõe `formato_preferido_do_aluno` ao modelo. O mock do
  agente herda a ordem automaticamente (comportamento de referência igual com e
  sem LLM); system prompt instrui a começar pelo formato preferido, com fallback.
- **personalized.py / personalizedOvaRoute.py** — expõem `formato_preferido` na
  criação e ao reabrir a OVA (derivado do 1º recurso da trilha).
- **Reforco.tsx** — chip **"No seu formato: 🎬 vídeo primeiro"** ao lado do "Foco:".

## P.3 — Recomendação e redator citam (e o tutor mede) o formato

- **redactor.py / proactivity.py** — o digest do redator carrega
  `formato_preferido` e `respondeu_melhor_a`; o system prompt instrui a PROPOR no
  formato que funciona ("preparei um vídeo curto…") e a variar quando dispensam.
- **tutorRoute.py `/tutor/agent-kpi`** — ganhou `kpis_por_formato` (taxa de
  aceitação × formato sugerido); **AgentKpi.tsx** exibe o recorte por formato.

## H.1 — Histórico diário de domínio (fundação das setas de tendência)

- **migration_014_mastery_history.sql** + **student_mastery_history.py** (PK
  composto por dia → idempotente). 013 segue reservada (avatar_licenses).
- **mastery.py** — `snapshot_today()` (chamado no sweep diário) e
  `mastery_trend(student_id, days=7)` (atual vs. snapshot mais antigo da janela).
- **masteryRoute.py `GET /mastery/trend`** (rota SEPARADA do /student/me de
  propósito) + cliente `getMasteryTrend` no api.ts. A UI das setas é a Etapa 8/G.5.

## Correção de robustez descoberta no smoke (não era da Etapa 7)

O smoke no stack real (com o token da Bedrock JÁ EXPIRADO) revelou que o loop do
agente de OVA personalizada NÃO degradava quando o LLM real falhava no meio do
loop — estourava **500** (diferente do coach/tutor, que já tinham try/except).
Corrigido em **agent/loop.py**: se o cliente real falha e há mock determinístico,
o loop cai nele (alimenta o breaker, registra a decisão como mock, custo 0) —
mesma degradação graciosa do resto do projeto. Teste:
`test_run_agent_falls_back_to_mock_when_real_fails`. Efeito verificado ao vivo:
`POST /edubot/personalized-ova` voltou de 500 para **201** com o token expirado.

## Testes (160 → 174)

Novos: `test_preferences.py` (5), `test_mastery_history.py` (4), fallback do loop
(1). Ampliados: `test_personalized_ova.py` (+3 — ordem por formato, trilha começa
pelo preferido, sem preferência preserva ordem), `test_outcomes.py` (+1 — KPI por
formato).

## Validação

`pytest` 174/174 · `ova_react_build` exit 0 · front HTTP 200 · migration_014
idempotente (rodada 2× no MySQL) · smoke ao vivo: `/mastery/trend` devolve
`delta +0.22 · direcao up`; reforço degrada para 201 com token expirado.

## Diferido (para a Etapa 8, por design)

Setas de tendência na teia (G.5 consome `getMasteryTrend`); a preferência com
horário de estudo (fica fora do escopo escolhido). O backfill de
`student_mastery_history` acumula sozinho a partir do 1º sweep — a tendência só
aparece após ~2 dias de snapshots (esperado).

---

# ETAPA 8 (Plano 2) — Gamificação núcleo (2026-07-11)

XP, nível, sequência com escudo, conquistas e ranking semanal opt-in, mais a
reforma de "Meu Desempenho". **189 testes verdes** (eram 174), build do front
exit 0, validada ponta a ponta no stack real. Toda a camada é ADITIVA e desligável
(`EDUBOT_GAMIFICATION=off` → award/register viram no-op e o front esconde a UI).

## Princípios aplicados (decisões de produto)
- **XP mede esforço, não nota** — concluir módulo, revisar EM DIA, voltar amanhã,
  perguntar ao tutor. Dominar competência vira CONQUISTA pessoal (invisível ao
  ranking). Um aluno com dificuldade pode vencer a semana.
- **Anti-farm por construção** — XP só server-side; dedup por (aluno, regra,
  objeto, dia) + teto diário por regra; nada de XP por evento bruto do front.
- **Perder a sequência não pune** — zera o contador, nunca tira XP; 1 escudo/semana
  cobre exatamente 1 folga.
- **LGPD** — ranking é finalidade nova de consentimento (`ranking_turma`, opt-in,
  ZERO migration) + apelido obrigatório; revogar esconde na hora; o aluno sempre
  vê a própria posição, nunca expõe quem não participou.

## G.1 — Motor de XP (migration_015: xp_events, student_streak, student_achievements)
- **services/gamification.py** — `XP_RULES` (pontos, teto/dia), `award()`
  idempotente/anti-farm, `level_from_xp` (curva `1+floor(sqrt(xp/60))`),
  `level_progress`. Flag `EDUBOT_GAMIFICATION`.
- **Ganchos** (pontos que já emitiam evento — zero rota nova de escrita):
  `progressRoute` (modulo_concluido + dia de estudo), `questionRoute`
  (quiz_do_modulo quando responde TODAS as questões, independe da nota + devolve
  o XP no payload p/ o micro-momento), `reviews.on_attempt` (revisao_em_dia),
  `edubotRoute` tutor-chat (pergunta_ao_tutor, teto 2/dia), `eventRoute`
  (dia de estudo por qualquer atividade rastreada).

## G.3 — Sequência com escudo
- `update_streak` (idempotente por dia; +1 no dia seguinte; escudo cobre 1 folga
  1×/semana ISO; buraco maior zera, best preservado). `register_daily_activity`
  é o gancho único chamado pelos pontos de atividade.

## G.2 — Conquistas (catálogo no código)
- `ACHIEVEMENTS` (8): primeiro_modulo, revisor_pontual, sequencia_7,
  mestre_competencia, curioso, trilha_completa, no_seu_formato, desafiante
  (dispara na Etapa 9). `check_achievements` desbloqueia o cumprido (idempotente);
  retroativo no login. Conquistas de desempenho são PESSOAIS (não somam ranking).

## G.4 — Ranking semanal opt-in (migration_016: students.nickname + title)
- Finalidade `ranking_turma` (opt-in) em consents.PURPOSES. `leaderboard` soma XP
  da semana ISO corrente dos alunos do curso COM opt-in (público); `me` sempre vê
  rank + top_percent do cohort (motiva o opt-in). Segunda-feira zera pelo filtro
  de semana (sem job). Rotas: GET /gamification/me|leaderboard,
  POST /gamification/participate (apelido + consent).

## G.5/G.6 — Frontend
- **Gamification.tsx**: JourneyHeader (nível+barra XP, chama da sequência+escudo,
  XP/semana), AchievementsShowcase (desbloqueadas coloridas, bloqueadas em
  silhueta com o nome = o caminho), LeaderboardCard (top + opt-in com apelido).
  Embutido no topo de **Evolution** ("Meu Desempenho").
- **Teia 2.0**: setas de tendência de 7 dias (consome `/mastery/trend` do H.1),
  com rótulo textual (U.7).
- **Dashboard**: chip sequência/nível/XP + "próxima conquista" (G.6).
- **Quiz**: painel de fechamento "+N XP" + celebração de conquista nova (G.6).
- Acessível: barra de XP com role=progressbar; chama respeita prefers-reduced-motion.

## Correção descoberta no smoke real (não pega nos testes SQLite)
`SUM(points)` volta **decimal.Decimal** no MySQL (int no SQLite) → `Decimal ** float`
estourava 500 em `/gamification/me` e `/leaderboard`. Corrigido: `xp_total`,
`xp_week` e `_course_active_weekly_xp` normalizam para int; `level_from_xp` faz
`float(total)`. (Padrão a lembrar: agregações numéricas do MySQL precisam de
coerção explícita — os testes em SQLite não pegam.)

## Testes (174 → 189)
Novo `test_gamification.py` (15): award once-per-object/dia, teto diário, regra
sem objeto 1x/dia, flag off = no-op, curva de nível, streak (cresce/escudo/zera),
conquistas (primeiro_modulo, mestre_competencia), ranking opt-in (só listados
participam; `me` sempre vê posição), rotas participate/me, gancho ponta a ponta.

## Validação
`pytest` 189/189 · `ova_react_build` exit 0 (tsc estrito) · front HTTP 200 ·
migrations 015/016 idempotentes (2× no MySQL) · smoke ao vivo: concluir módulo +
responder = 50 XP, streak 1, conquistas retroativas, ranking com apelido "Eddy".

## Diferido (Etapa 9, por design)
Recompensas de nível (personas/títulos/desafios — R.1/R.2/R.3), metas semanais
(E.3), deep-links de módulo (E.1), sino unificado (E.2) e o painel antes×depois
de engajamento do tutor (E.4). As regras meta_semanal e desafio_tentado já estão
no XP_RULES e a conquista `desafiante` já existe, aguardando os gatilhos da Etapa 9.

---

# ETAPA 9 (Plano 2) — Recompensas, metas e o ciclo completo (2026-07-11)

Última etapa do `PLANO_EXECUCAO_2.md`. Dá consequência ao nível (personas,
títulos, desafios), deixa o aluno assumir metas, remove atritos de navegação e
MEDE se a gamificação funcionou. **203 testes verdes** (eram 189), build do front
exit 0, validada ponta a ponta no stack real. **PLANO 2 COMPLETO (Etapas 7–9).**

## R.3 — Desafios avançados
- **quiz.challenge_pool**: só questões `difficulty=3` de competências DOMINADAS
  (BKT ≥ 0.8). `/question/ova` aceita `{"desafio": true}` → 403 `challenge_locked`
  quando não há (mesmo padrão do gate U.1). Responder uma difícil de competência
  dominada concede `desafio_tentado` (+20) e desbloqueia a conquista `desafiante`
  (gatilho que faltava da Etapa 8). Front: toggle "Modo desafio 🏆" no Quiz.

## R.1 — Personas por nível
- `PERSONA_UNLOCK = {einstein: 3, curie: 5}`; `me_state.personas` expõe o estado
  (a validação de nível é do BACKEND). Front (**PerformanceCoach**): persona
  travada mostra cadeado + "NvN" e não é selecionável (cai no mascote livre).

## R.2 — Títulos
- `TITLE_BY_ACHIEVEMENT` (revisor_pontual→"Revisor Pontual", mestre_competencia→
  "Mestre"…). `available_titles` (só os ganhos) + `POST /gamification/title`
  (valida que foi conquistado). Front: seletor de título no cabeçalho de jornada;
  aparece ao lado do nível. Coluna `students.title` (migration_016, já existia).

## E.3 — Metas semanais (migration_017: weekly_goals)
- **services/goals.py**: sugere 2 metas do tamanho do aluno (constância +
  concluir/revisar conforme o momento), idempotente por (aluno, semana, tipo);
  progresso DERIVADO dos mesmos sinais de XP (sem telemetria nova); cumprir
  concede `meta_semanal` (+50) 1×. Sweep sugere na semana e cria nudge de
  meio-de-semana (quinta+) se progresso zero. Rotas GET /goals, POST /goals/accept.
  Front: **WeeklyGoalsCard** no Dashboard (barra de progresso + aceitar).

## E.1 — Deep-links de módulo (retoma U.8)
- Hash router entende `#/modulo/:id`: F5 dentro de um módulo reabre o mesmo;
  abrir um OVA agora escreve a URL (linkável/compartilhável). O leitor deriva da
  rota (moduleId → resolvido para readerOva quando o perfil carrega). Voltar do
  leitor limpa o `#/modulo`. Base para intervenções apontarem o alvo (o
  targeting por-intervenção precisa de uma coluna alvo nas interventions —
  diferido).

## E.2 — Sino unificado (retoma U.3)
- **hooks/useInterventions.ts**: fonte ÚNICA das intervenções NÃO LIDAS. O sino
  da topbar deixou de ler `historico_intervencoes` (que incluía lidas) e passou a
  bater com o card do dashboard; dá para dispensar dali (ack).

## E.4 — Painel de engajamento do tutor + validação antes×depois
- **GET /tutor/engagement**: participação no ranking, distribuição de sequências,
  XP médio/semana, alunos "prestes a perder a sequência" (estudaram ontem, não
  hoje) e o gate honesto ANTES×DEPOIS: dias ativos/aluno em duas janelas de 28d
  (via learning_events, coletados desde a Etapa 3). Front: **EngagementPanel** no
  TutorPanel.

## Correção descoberta no smoke real
Processo Flask com `EDUBOT_DEBUG=0` (sem reloader) servia código antigo após
adicionar rotas/arquivos novos → 500/rota ausente. Resolvido com
`docker compose restart ova_flask`. (Lembrete operacional: rotas/módulos novos
exigem restart do backend quando o debug está desligado; edições em arquivos já
importados idem.)

## Testes (189 → 203)
Novos: `test_goals.py` (6 — sugestão idempotente, 2ª meta por revisão ativa,
progresso+conclusão concede XP, aceitar, rota sugere quando vazio, flag off),
`test_challenge_rewards.py` (6 — challenge_locked sem domínio, serve só difícil
da dominada, XP+conquista ao responder, personas por nível, título ganho/negado),
`test_engagement.py` (2 — restrito a staff, shape+em risco).

## Validação
`pytest` 203/203 · `ova_react_build` exit 0 (tsc estrito) · front HTTP 200 ·
migration_017 idempotente (2× no MySQL) · smoke ao vivo: /goals sugere 2 metas,
/gamification/me traz personas+título "Mestre", desafio 403 sem domínio,
/tutor/engagement com antes×depois.

## Diferido (por design, fora do escopo do Plano 2)
Targeting por-intervenção (uma coluna alvo em `interventions` para o deep-link
apontar o módulo exato de cada aviso); V.3/V.4 (avatares GLB + licenças, migration
013, condicionados às métricas do V.2); e a chamada real do Polly (credencial de
voz). Tudo registrado nos planos.

═══════════════════════════════════════════════════════════════════════════════
PLANO 2 COMPLETO — Etapas 7 (preferência de aprendizagem), 8 (gamificação núcleo)
e 9 (recompensas + ciclo). De 160 a 203 testes; 5 migrations novas (014–017 + o
purpose ranking_turma sem migration); build do front exit 0 em todas.
═══════════════════════════════════════════════════════════════════════════════

---

# AUDITORIA DE CONSISTÊNCIA 2 — Plano 2, Etapas 7 a 9 (2026-07-11)

Mesma disciplina da auditoria das Etapas 1–6: releitura crítica de tudo que o
Plano 2 entregou (P.x, H.1, G.x, R.x, E.x), procurando defeitos reais de código
e implementação. Baseline: 203 testes verdes. Encontrados **6 defeitos + 1 código
morto** — todos corrigidos; suíte final **207 verdes**, build exit 0, correções
validadas no stack real (MySQL).

## Defeitos encontrados e corrigidos

1. **(E.4 — o mais grave) "Dias ativos" contava TIMESTAMPS, não dias** — o
   antes×depois (o gate honesto que decide se a gamificação funcionou!) fazia
   `DISTINCT occurred_at` sobre um DATETIME: cada evento é quase único, então a
   métrica virava "nº de eventos" (o smoke da Etapa 9 mostrou 4.0 "dias" com
   atividade em um único dia). Fix: `COUNT(DISTINCT DATE(occurred_at))` (funciona
   em MySQL e SQLite). Verificado ao vivo: caiu de 4.0 para 2.0 (os 2 dias reais).
   Teste: `test_active_days_counts_distinct_days_not_events`.
2. **(G.3) Display da sequência ignorava o escudo** — última atividade anteontem
   + escudo disponível: `update_streak` preservaria a chama ao estudar hoje, mas
   `streak_state` exibia 0 — o aluno via a chama "apagada" que o escudo ia
   salvar, minando o propósito psicológico do escudo. Fix: o display considera
   viva a sequência quando o escudo cobriria o buraco de 1 dia. Teste:
   `test_streak_display_respects_shield`.
3. **(R.2) Título quebrado em inglês** — `set_title` grava o rótulo PT; as
   opções do `<select>` vinham traduzidas → em EN o select não casava com o
   título ativo (mostrava "No title") e o rótulo exibido ficava sempre em PT.
   Fix: `me_state` devolve `title_id` (reverse lookup do rótulo gravado) +
   rótulo TRADUZIDO; o front seleciona por id. Teste:
   `test_title_translated_and_id_exposed`. Confirmado ao vivo com o título
   "Mestre" setado por uso real → EN devolve "Master".
4. **(R.3 front) 403 ambíguo no modo desafio** — o gate de leitura (U.1) também
   responde 403; no modo desafio qualquer 403 virava "domine a competência",
   mensagem errada quando o bloqueio era de leitura. Fix: `quizLockFromError`
   distingue pelo corpo (`quiz_locked` tem gate/perc) antes de assumir
   `challenge_locked`.
5. **(G.4) Apelido sem proteção de colisão** — dois alunos da turma podiam usar
   o MESMO apelido (inclusive imitar o do colega — personificação no placar).
   Fix: `/gamification/participate` devolve **409** se outro aluno do curso já
   usa o apelido (case-insensitive); o front mostra a mensagem. Teste:
   `test_participate_rejects_duplicate_nickname_in_course`. Verificado ao vivo
   (RA 3 tentando "eddy" → 409).
6. **(perf) Varredura de conquistas em todo sync** — `register_daily_activity`
   rodava as 8 checagens (~10 queries) a cada flush de 15s do front. Fix: só na
   PRIMEIRA atividade do dia (xp>0) — único momento em que a sequência (e
   `sequencia_7`) muda; os demais critérios têm checagem própria nos seus
   ganchos (conclusão, resposta, login retroativo).
7. **(higiene)** `_fk_id` morto removido de `mastery.py`.

## Verificado e OK (sem mudança)

- Motor de XP: dedup por (aluno, regra, objeto, dia) + tetos; coerção Decimal→int
  (fix da Etapa 8) cobre todos os SUMs; flag off = no-op comprovado.
- Escudo do streak: 1/semana ISO, gap==2 exato; buraco maior zera sem punição.
- Ranking: só opt-in listado; `me` sempre vê rank/top_percent; semana ISO corta
  certo; tutor não aparece no placar (filtro role=aluno) mesmo que participe.
- Metas: sugestão idempotente por (aluno, semana, tipo); progresso derivado dos
  xp_events (fonte única); meta "sugerida" que o aluno cumpre sem aceitar também
  premia (decisão registrada: esforço aconteceu).
- Desafio: gate de leitura roda ANTES do challenge_pool (defesa em profundidade);
  XP por tentativa dedup por questão/dia; mastery atualizada antes da checagem.
- Preferência (P.1): caminho do perfil segue ≤ 8 queries (golden intacto);
  degradação segura com confiança < 0.4; digest com formato_sugerido fluindo
  para o sensor B.6 e o KPI por formato.
- Deep-links: F5 dentro do módulo, voltar/avançar, link antes do login (o
  moduleId sobrevive à tela de Login); módulo inexistente cai em Conteúdos.
- Sino unificado: topbar e dashboard leem a MESMA fonte (não lidas).
- Migrations 014–017 idempotentes (2× no MySQL) e em paridade com os models.

## Observações (aceitas, não são defeitos)

- "Próxima conquista" no dashboard é a primeira bloqueada do catálogo, não a
  mais próxima de cumprir (aproximação barata).
- EduBotInbox mantém fetch próprio (mesmo endpoint do hook do sino — contagens
  batem; só há uma requisição duplicada por carga de dashboard).
- Metas de semanas passadas não são marcadas "expirada" (a UI só lê a semana
  corrente; higienização fica para um job futuro se a tabela crescer).
- `EDUBOT_XP_LEVEL_BASE` é lido no import (mudar exige restart — igual aos
  demais tunables do projeto).

**Validação final**: `pytest` 207/207 · `ova_react_build` exit 0 (tsc estrito) ·
front HTTP 200 · smoke ao vivo no MySQL: dias ativos 4.0→2.0 (real), apelido
duplicado 409, título traduzido com title_id, streak com escudo.
