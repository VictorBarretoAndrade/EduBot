# Plano de Execução Detalhado — Evolução do EduBot

> Documento derivado da varredura estratégica pós-refatoração (2026-07-07), no mesmo espírito do
> `AUDITORIA_TECNICA.md`. Cada etapa está quebrada em passos implementáveis, com arquivos-alvo,
> esqueletos de código/SQL, critérios de aceite e validação. Executar **na ordem** — as dependências
> estão marcadas. A lógica geral: *dado confiável → decisão barata → autonomia auditável → presença
> encantadora*.

## Convenções deste documento

- **Esforço**: P (≤ meio dia), M (1–3 dias), G (1–2 semanas).
- **IDs**: A.x = fundação/auditoria · B.x = agente/Bedrock · U.x = UX/IA de navegação ·
  D.x = dados/personalização · V.x = voz/avatares.
- **Migrations**: todo passo que toca schema entrega `Database/sql/migration_NNN_*.sql`
  **idempotente** (padrão `information_schema` + `PREPARE`, como as migrations 001/002) e roda em
  volume existente com `docker exec -i ova_db mysql -ueduardo -pPassword-1 ova_db < arquivo.sql`.
- **Testes**: todo passo de backend adiciona/atualiza pytest em `Back-End/tests/` (SQLite em memória,
  fixtures de `conftest.py`).
- **Fallback**: nenhum passo pode quebrar o modo `EDUBOT_LLM_PROVIDER=mock` — é a rede de segurança
  permanente do projeto.
- **Validação manual mínima por etapa**: `docker compose up` + fluxo aluno completo
  (login → ler OVA → quiz → recomendação) + fluxo tutor (turma → alertas).

## Mapa de dependências entre etapas

```
ETAPA 1 (fundação) ──► ETAPA 2 (UX + Bedrock ligado) ──► ETAPA 4 (agente de verdade)
        │                                                      ▲
        └────────────► ETAPA 3 (eventos + LGPD + mastery) ─────┘
                                                               │
                       ETAPA 5 (voz + presença) ◄──────────────┘
                       ETAPA 6 (fechamento de loop + visão de avatares)
```

---

# ETAPA 1 — Fundação (Frente 1: auditoria pós-refatoração)

**Objetivo**: eliminar o gargalo do perfil, fechar as brechas de segurança remanescentes e
consertar os dois defeitos lógicos (alertas eternos, read_time que superconta). Tudo abaixo é
pré-requisito para as etapas 2–6.

**Duração estimada**: 1–2 semanas.

---

## A.1 — Reescrever `build_student_profile` com agregações SQL (M)

**Problema** (verificado): `edubot/services/student_context.py:94-135` faz 4 counts por competência
em loop; `:197-231` faz `get_or_none` + counts por OVA e por recurso. ~80–120 queries por perfil.
O perfil é chamado em todo `refreshProfile` do front, em toda recomendação, no coach e na varredura
de até 200 alunos (`proactivity.py:121-139`) → ~20.000 queries por sweep.

**Contrato**: a saída (dict) **não muda**. `tests/test_profile.py` é o teste de contrato; ampliá-lo
ANTES de mexer (snapshot do dict com o seed do conftest, campo a campo).

**Implementação** — substituir os loops por 4 consultas agrupadas:

1. **Competências** (substitui `_competency_statuses`): uma query por curso.

```python
# edubot/services/student_context.py (novo corpo de _competency_statuses)
from peewee import Case, fn, JOIN

def _competency_rows(student):
    """Uma linha por competência do curso com: total de questões, acertos do aluno
    (answers), tentativas e erros (attempts). 1 query no lugar de 4×N."""
    acertos = fn.COUNT(Answers.answer_id.distinct())
    tentativas = fn.COUNT(Attempts.attempt_id.distinct())
    erros = fn.SUM(Case(None, [(Attempts.is_correct == False, 1)], 0))
    total_q = fn.COUNT(Questions.question_id.distinct())

    return (Competencies
            .select(Competencies, total_q.alias("total_questoes"),
                    acertos.alias("acertos"), tentativas.alias("tentativas"),
                    erros.alias("erros"))
            .join(Subjects, on=(Competencies.subject_id == Subjects.subject_id))
            .join(Offerings, on=(Offerings.subject_id == Subjects.subject_id))
            .switch(Competencies)
            .join(Questions, JOIN.LEFT_OUTER,
                  on=(Questions.competency_id == Competencies.competency_id))
            .join(Answers, JOIN.LEFT_OUTER,
                  on=((Answers.question_id == Questions.question_id) &
                      (Answers.student_id == student.student_id)))
            .switch(Questions)
            .join(Attempts, JOIN.LEFT_OUTER,
                  on=((Attempts.question_id == Questions.question_id) &
                      (Attempts.student_id == student.student_id)))
            .where(Offerings.course_id == student.course_id)
            .group_by(Competencies.competency_id))
```

2. **Recursos + progresso**: `Resources LEFT JOIN ResourceProgress (do aluno)` filtrado pelos OVAs
   do curso — 1 query; montar `ovas_data`/`consumption_by_type` em Python a partir das linhas.
3. **OVAProgress do aluno**: `OVAProgress.select().where(student)` — 1 query, indexar por `ova_id`
   em dict.
4. **Attempts por OVA** (para `has_quiz_attempt`): `Attempts JOIN Questions GROUP BY ova_id` — 1 query.
5. `_days_without_access` mantém as 4 subconsultas MAX (baratas) ou vira 1 query com UNION — opcional.

**Meta de aceite**: perfil completo em **≤ 8 queries** (verificar com contador: em teste,
`peewee` expõe `db.execute_sql` — usar fixture que intercepta e conta; assert `<= 8`).

**Validação**: suíte verde (contrato intacto) + fluxo manual + tempo de resposta de `/student/me`
logado antes/depois (esperado: 10–50× mais rápido em MySQL).

**Risco**: divergência sutil de semântica em LEFT JOIN com aluno sem dados → o teste de contrato
com aluno "vazio" (student_id=2 do seed, sem attempts) cobre isso.

---

## A.2 — Índices no schema (P)

**Problema**: zero índices secundários em `ddl.sql`/`ddl_extra.sql`; todas as queries do perfil e
do agente varrem tabelas inteiras.

**Entrega**: `Database/sql/migration_003_indexes.sql` (idempotente — MySQL 8: usar
`CREATE INDEX` guardado por `information_schema.STATISTICS`):

```sql
-- Padrão idempotente (repetir por índice):
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'CREATE INDEX idx_attempts_student ON attempts(student_id, attempt_time)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA='ova_db' AND TABLE_NAME='attempts' AND INDEX_NAME='idx_attempts_student');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
```

Índices a criar:

| Tabela | Índice | Serve a |
|---|---|---|
| attempts | (student_id, attempt_time) | perfil, inatividade, mastery |
| attempts | (question_id) | agregação por competência/OVA |
| answers | (student_id) | perfil (uc_answers já cobre student+question) |
| interactions | (student_id, interaction_date) | inatividade |
| questions | (competency_id) · (ova_id) | quiz, tools do agente |
| resources | (ova_id) · (competency_id) | perfil, remediação |
| interventions | (student_id, date, result) | dedup diária, inbox |
| alerts | (student_id, `read`) | dedup e painel do tutor |
| ova_progress | (student_id, last_access) | "continuar de onde parou" (U.4) |

**Validação**: `EXPLAIN` nas 4 queries do A.1 sem full scan; migration roda 2× sem erro.

---

## A.3 — Fechar as rotas abertas + rate-limit no login (P)

**Problemas** (verificados):
- `GET /question/all` sem token (`questionRoute.py:36-62`) — expõe todo o banco de questões.
- `GET /student/course/<id>` sem token (`studentRoute.py:33-54`) — vaza nome+ID de alunos (LGPD).
- `/login` sem rate-limit; RA enumerável, senha do seed = RA até o 1º login.
- `CORS(app)` aberto para qualquer origem (`api/app.py:25`).

**Implementação**:
1. `@require_auth` em `/question/all`. Avaliar se a rota ainda tem consumidor (o React usa
   `/question/ova`); se não tiver, **remover** a rota (menos superfície).
2. `/student/course/<id>`: `@require_auth` + exigir papel tutor/admin (reutilizar o `_is_tutor()`
   de `tutorRoute.py:32-34` — movê-lo para `edubot/api/auth.py` como `require_role("tutor","admin")`
   decorator, fonte única).
3. Rate-limit do login, in-process (suficiente para 1 réplica):

```python
# edubot/api/auth.py
import time
from collections import defaultdict, deque
_attempts = defaultdict(deque)          # chave: f"{ra}|{ip}"
LOGIN_MAX, LOGIN_WINDOW_S = 5, 60

def login_throttled(ra, ip):
    key = f"{ra}|{ip}"; now = time.time(); q = _attempts[key]
    while q and now - q[0] > LOGIN_WINDOW_S: q.popleft()
    if len(q) >= LOGIN_MAX: return True
    q.append(now); return False
```

   Em `loginRoute.py`: se `login_throttled(...)` → `429` com `Retry-After`.
4. CORS: `CORS(app, origins=os.environ.get("EDUBOT_CORS_ORIGINS", "*").split(","))` +
   `EDUBOT_CORS_ORIGINS: http://localhost:8010` no `compose.yaml`.

**Testes**: `test_auth.py` ganha: rota sem token → 401; aluno em rota de tutor → 403; 6º login em
60 s → 429.

---

## A.4 — Ack de alertas do tutor (P) — corrige a dedup congelada

**Problema** (verificado): a dedup de alertas é "por tipo enquanto não lido"
(`proactivity.py:63-68`), mas não existe endpoint nem botão para marcar como lido → o primeiro
alerta de cada tipo suprime todos os futuros do mesmo tipo, para sempre.

**Implementação**:
1. `POST /tutor/alert/ack` em `tutorRoute.py` (espelho do `/edubot/intervention/ack` de
   `edubotRoute.py:208-225`): valida papel de tutor + que o aluno do alerta pertence ao curso do
   tutor; seta `read = True`.
2. `TutorPanel.tsx`: botão "Marcar como tratado" em cada alerta da central; some da contagem de
   abertos.
3. Higiene na varredura: em `run_class_evaluation`, expirar (marcar `read=True` com sufixo
   `auto-expirado`) alertas não lidos com `created_at` > 14 dias — evita acúmulo eterno.

**Teste**: criar alerta → ack → nova avaliação do mesmo aluno gera alerta novo do mesmo tipo.

---

## A.5 — read_time honesto: pausa por visibilidade e ociosidade (P)

**Problema** (verificado): o ticker de `OvaReader.tsx:157-164` soma 1 s/segundo enquanto o
componente estiver montado — aba em background e aluno ausente contam como leitura. A métrica
central agora **superconta** (inverso do A1 original).

**Implementação** (só front, contrato intocado):

```tsx
// OvaReader.tsx — dentro do useEffect de rastreio
const IDLE_LIMIT_S = 180;                       // 3 min sem sinal = pausa
const lastActivityRef = { current: Date.now() };
const markActivity = () => { lastActivityRef.current = Date.now(); };

// eventos que contam como presença
["scroll", "mousemove", "keydown", "pointerdown"].forEach((ev) =>
  window.addEventListener(ev, markActivity, { passive: true }));

const ticker = window.setInterval(() => {
  const hidden = document.visibilityState === "hidden";
  const idle = (Date.now() - lastActivityRef.current) / 1000 > IDLE_LIMIT_S;
  if (hidden || idle) return;                   // não conta o segundo
  sessionSecondsRef.current += 1;
  unsyncedRef.current += 1;
  // ... (progresso de página curta como está)
}, 1000);
```

Ao voltar a ficar visível (`visibilitychange`), chamar `markActivity()`. Remover listeners no
cleanup. Bônus barato: enviar `persist(false)` no `visibilitychange → hidden` (flush antecipado).

**Validação manual**: abrir OVA, trocar de aba 2 min, voltar → `read_time` no banco não subiu no
intervalo (conferir via `/student/me`).

---

## A.6 — Higiene de código e contratos (P/M)

Checklist (tudo verificado no código atual):

- [ ] Remover `try/except PeeweeException → json.dumps(...), 500` de todas as rotas — o handler
      global de `api/app.py:36-46` já responde JSON 500 e loga stack trace. Rotas ficam finas.
- [ ] Trocar `json.dumps(...)` manual por `jsonify(...)` nas rotas (consistência de content-type).
- [ ] Remover `if request.method == ...` morto (`questionRoute.py:40,72,116` etc. — o blueprint já
      restringe `methods`).
- [ ] Remover `import sys, os` órfãos (`agent/tools.py:14`, `routes/edubotRoute.py:11`,
      `routes/personalizedOvaRoute.py:15`, `routes/loginRoute.py:2`, `routes/interactionRoute.py:2`).
- [ ] Unificar `_alternatives_list` (hoje em `questionRoute.py:27` e `personalizedOvaRoute.py:44`)
      em `edubot/services/quiz.py` (novo módulo de serviço; o resto da lógica de quiz migra aqui
      no U.1).
- [ ] Unificar o status de competência: `tools.listar_competencias_fracas` (`tools.py:118-160`)
      passa a chamar a query agregada do A.1 em vez de recalcular — fonte única de verdade.
- [ ] `api.ts`: remover `student_id` dos bodies de `getOVAQuestions`/`answerQuestion`
      (`api.ts:327-334`) — o backend resolve do token; o contrato atual mente.
- [ ] Upsert atômico do progresso (corrige perda de delta em syncs concorrentes,
      `progressRoute.py:85-114`):

```python
# MySQL: INSERT ... ON DUPLICATE KEY UPDATE read_time = read_time + delta
(OVAProgress.insert(student_id=g.student, ova_id=ova, read_time=delta, ...)
 .on_conflict(conflict_target=None,   # MySQL usa a unique uc_ova_progress
              update={OVAProgress.read_time: OVAProgress.read_time + delta,
                      OVAProgress.perc_scrolled: fn.GREATEST(OVAProgress.perc_scrolled, perc),
                      OVAProgress.completed: OVAProgress.completed | completed,
                      OVAProgress.last_access: datetime.datetime.now()})
 .execute())
```

      (No SQLite dos testes o `on_conflict` do Peewee também funciona com a unique.)
- [ ] Alinhar `BEDROCK_MODEL_ID` (`agent.py:20`, `personalized.py:20`, `tutor.py:23`) com
      `llm.DEFAULT_MODEL` — ou melhor: os mocks passam a ler `llm.model_id()` (uma constante a menos).

---

## A.7 — Testes dos fluxos descobertos (M)

Novos arquivos em `Back-End/tests/`:

- `test_tutor_routes.py`: 403 para aluno em `/tutor/*`; turma limitada ao curso do tutor; ack de
  alerta (A.4); `/tutor/evaluate` cria intervenções dedupadas.
- `test_personalized_ova.py`: agente mock cria OVA com itens válidos; IDs inventados são
  filtrados (`tools.py:195-211`); acesso à OVA de outro aluno → 404; sem conteúdo de remediação →
  422 (`personalizedOvaRoute.py:64-69`).
- `test_tracking.py` (ampliar): delta negativo → clamp 0; delta não-numérico → 400; concorrência
  simulada (2 upserts) soma os dois deltas (A.6).
- `test_profile.py` (ampliar): contrato completo (snapshot) + contador de queries ≤ 8 (A.1).

**Gate de saída da Etapa 1**: suíte verde, fluxo manual completo, perfil ≤ 8 queries, nenhuma rota
sem auth (exceto `/login`), alerta com ciclo de vida completo.

---

# ETAPA 2 — IA de navegação + Bedrock ligado

**Objetivo**: corrigir a arquitetura de informação (quiz no módulo, jornada única) e tirar a IA do
modo mock com medição desde o primeiro dia.
**Depende de**: Etapa 1 (A.1 para custo de perfil; A.6 para o serviço de quiz).
**Duração estimada**: 2–3 semanas. U.x e B.x podem andar em paralelo (front/back).

---

## U.8 — Rotas com parâmetro no hash router (M) — *fazer primeiro, os demais U.x dependem*

**Problema**: o router de `App.tsx:37-41` só conhece views fixas; o leitor de OVA aberto
(`readerOva`) não sobrevive a refresh nem é linkável — uma intervenção não consegue apontar para
"módulo 3, passo quiz".

**Implementação**: estender o parser de hash para `#/modulo/:id` e `#/modulo/:id/:passo`
(`passo ∈ conteudo|atividade|quiz`), mantendo o mecanismo atual (sem react-router):

```tsx
// App.tsx
type Route = { view: string; ovaId?: number; step?: string };
const parseHash = (): Route => {
  const m = window.location.hash.match(/^#\/modulo\/(\d+)(?:\/(\w+))?/);
  if (m) return { view: "module", ovaId: Number(m[1]), step: m[2] ?? "conteudo" };
  const raw = window.location.hash.replace(/^#\/?/, "");
  return { view: KNOWN_VIEWS.includes(raw) ? raw : "dashboard" };
};
```

`readerOva` deixa de ser estado paralelo: abrir OVA = navegar para `#/modulo/<id>` (o estado deriva
da rota; refresh funciona; sidebar destaca "Meus módulos"). Ao montar com `ovaId` na URL, buscar o
OVA no `profile.ovas`.

**Validação**: F5 dentro de um OVA reabre o mesmo OVA; voltar/avançar do navegador funciona;
link colado em outra aba (logado) abre direto.

---

## U.1 — Quiz vive no módulo, com regra de liberação validada no backend (M)

**Problema**: a aba Quiz global (`Quiz.tsx:105-117`) libera qualquer quiz sem relação com o
consumo — pedagogia invertida e dado do agente contaminado (aluno pode "errar tudo" sem nunca ter
visto o conteúdo).

**Backend**:
1. `migration_004_quiz_gate.sql`: `ALTER TABLE ovas ADD COLUMN quiz_gate_perc INT NOT NULL DEFAULT 70`
   (idempotente). `0` = sem gate (conteúdo introdutório).
2. Novo serviço `edubot/services/quiz.py` (nasce no A.6) ganha:

```python
def quiz_unlocked(student, ova):
    gate = ova.quiz_gate_perc or 0
    if gate == 0:
        return True, None
    progress = OVAProgress.get_or_none((OVAProgress.student_id == student) &
                                       (OVAProgress.ova_id == ova))
    perc = progress.perc_scrolled if progress else 0
    return perc >= gate, {"gate": gate, "perc": perc}
```

3. `/question/ova` (`questionRoute.py:65`): se bloqueado → `403` com corpo
   `{"error": "quiz_locked", "gate": 70, "perc": 35}` (o front mostra o motivo, não um erro
   genérico). **Gate no backend é o ponto** — esconder botão não impede curl.
4. `/question/answer`: mesma checagem (defesa em profundidade).

**Frontend**:
1. O leitor (`OvaReader.tsx`) vira a **página do módulo** com stepper no topo:
   `1. Conteúdo → 2. Atividade → 3. Quiz` (o `OvaQuiz.tsx` embutido já existe — promovê-lo a passo;
   as atividades do OVA já são renderizadas no leitor, `OvaReader.tsx:353-378`).
2. Passo Quiz bloqueado mostra cadeado + "Leia ao menos 70% do conteúdo para liberar
   (você está em 35%)" — dados vindos do 403.
3. **Remover a aba Quiz da sidebar** (`Sidebar.tsx:20`) e do router. A view `Quiz.tsx` pode ser
   aposentada (o `OvaQuiz` cobre) ou mantida como componente interno do passo.
4. Intervenções do EduBot que citam quiz passam a linkar `#/modulo/<id>/quiz`.

**Testes**: `test_quiz.py` ganha: gate 70 + scroll 30 → 403 em `/question/ova` e `/question/answer`;
gate 0 → liberado; scroll 90 → liberado.

**Validação pedagógica**: com o gate ativo, `attempts` só nasce após consumo real → a taxa de erro
que alimenta as regras passa a medir dificuldade, não desordem de navegação.

---

## U.2 — Fundir "Atividades" em "Meus módulos" (P)

A aba `Exercises.tsx` é auto-declaração descontextualizada (botão "marcar como concluída" solto).
As mesmas atividades já aparecem dentro do leitor.

1. Remover `exercises` da sidebar e do router (redirect `#/exercises` → `#/contents`).
2. `Contents.tsx` (agora "Meus módulos") mostra, por OVA: % lido, atividades concluídas/total,
   estado do quiz (bloqueado/liberado/feito) — os dados já estão no perfil (`profile.ovas[].recursos`).
3. Aposentar `Exercises.tsx`.

---

## U.3 — Caixa de entrada única do EduBot (P)

**Problema**: o sino da topbar lê `historico_intervencoes` (`Sidebar.tsx:134`) e o card do
dashboard lê `/edubot/interventions` (não lidas) — mesma entidade, duas fontes, contagens
incoerentes.

1. O sino passa a consumir `getInterventions()` (não lidas) — badge = quantidade real pendente;
   cada item tem os mesmos botões do card (agir/dispensar → `ackIntervention`).
2. O card `EduBotInbox` do Dashboard permanece (mesma fonte, mesmo estado — extrair hook
   `useInterventions()` compartilhado).
3. Histórico completo (lidas incluídas) vai para "Meu desempenho" (U.6).

---

## U.4 — "Continuar de onde parou" (P)

No Dashboard, card no topo: maior `last_access` de `ova_progress` do aluno → "Continue: *{nome do
OVA}* — você parou em {perc}%" → link `#/modulo/<id>` (usa o índice de A.2). Backend: já está no
perfil (`profile.ovas[].read_time/perc_scrolled`); se quiser o timestamp, adicionar `last_access`
ao dict do OVA em `build_student_profile` (1 campo, sem query extra após A.1).

---

## U.6 — Renomear "Professor Mediador" e mover para "Meu desempenho" (P)

1. `Report.tsx` (pedir recomendação + histórico + export) vira seção dentro de `Evolution.tsx`
   ("Meu desempenho"): avatar/coach no topo (já está lá via `PerformanceCoach`), botão
   **"Pedir orientação ao EduBot"**, histórico de intervenções, export JSON.
2. Remover `report` da sidebar; redirect de hash.
3. A sidebar final do aluno fica: **Início · Meus módulos · Reforço · Meu desempenho** (+ Turma).

---

## B.1 — Ligar o Bedrock real e medir por 1 semana (P)

O código está pronto (`llm.py` verificado na auditoria). Passos:

1. Criar `.env` na raiz (o compose já o injeta — `compose.yaml:48-62`):

```env
EDUBOT_LLM_PROVIDER=bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
EDUBOT_LLM_MODEL=claude-sonnet-4-6        # tool-use / recomendação
EDUBOT_COACH_MODEL=claude-haiku-4-5-20251001
```

   IAM mínimo: policy só com `bedrock:InvokeModel` nos ARNs dos modelos usados.
2. Smoke test dos 4 caminhos com `mock: false` na resposta:
   - `GET /edubot/recommendation` (badge "resposta simulada" do `Report.tsx:90-94` deve sumir);
   - `POST /edubot/tutor-chat` (resposta ancorada no material);
   - `GET /edubot/coach-message` (`ai: true`);
   - `POST /edubot/personalized-ova` (loop de tool-use real — conferir `iteracoes` e a validação
     de IDs segurando alucinação).
3. Teste de resiliência: derrubar a credencial → os 4 caminhos degradam para mock **sem** erro
   ao usuário (caminhos de fallback já existem: `agent.py:262`, `tutor.py:217`, `coach.py:67`).
4. Registrar custo/latência por chamada durante 1 semana (see B.2 — nasce junto).

**Atenção**: `personalized.py:180` escolhe o cliente no **import** (`_client = _RealAgentClient()
if llm.is_real() ...`) — trocar provider exige restart do container. Aceitável; documentar no README.

---

## B.2 — `agent_decisions`: auditoria e observabilidade desde o dia zero (P/M)

**Antes de dar autonomia, dar rastro.** Tudo que o "cérebro" decidir — mock incluído — fica
registrado.

1. `migration_005_agent_decisions.sql`:

```sql
CREATE TABLE agent_decisions (
    decision_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    trigger_type VARCHAR(40),        -- quiz_failed | ova_completed | sweep | on_demand | chat
    input_digest JSON,               -- digest do perfil enviado (minimizado, sem RA/nome completo)
    model_id VARCHAR(80),
    mock BOOLEAN,
    tools_called JSON,               -- [{name, ok}, ...]
    actions JSON,                    -- [{type: "intervention", id: 12}, ...]
    latency_ms INT,
    input_tokens INT, output_tokens INT,
    outcome VARCHAR(30) NULL,        -- preenchido depois (B.6): aceita|dispensada|expirada|melhorou
    created_at DATETIME,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    INDEX idx_decisions_student (student_id, created_at)
);
```

2. Modelo Peewee `edubot/data/models/agent_decisions.py` + helper
   `edubot/services/decisions.py::record_decision(...)` chamado em: `get_recommendation` (rota),
   `evaluate_student` (proatividade), `run_personalized_ova_agent`, `tutor_reply` (só metadados,
   não o conteúdo do chat — o conteúdo vai para eventos no D.1), `coach_message`.
   Tokens/latência: o SDK devolve `resp.usage`; no mock, zeros.
3. Painel: aba "Decisões do EduBot" no `TutorPanel.tsx` — tabela paginada (aluno, gatilho, modelo,
   ação, custo estimado, quando). Custo estimado = tokens × preço por modelo (dict no front ou no
   back; conferir preços vigentes na doc da Anthropic/Bedrock ao implementar).
4. Guarda de orçamento (usada de verdade no B.4/B.5): `decisions.py::budget_exceeded()` — soma
   `input_tokens/output_tokens` do dia × preço e compara com `EDUBOT_DAILY_BUDGET_USD` (env,
   default 1.00). Excedeu → caminhos LLM degradam para template e logam WARNING.

**Gate de saída da Etapa 2**: quiz só após consumo (validado por API), sidebar com 4 itens,
inbox única, IA real respondendo nos 4 caminhos com fallback comprovado, cada decisão registrada
com custo, orçamento diário aplicado.

---

# ETAPA 3 — Dados que valem algo (eventos, LGPD, mastery)

**Objetivo**: schema de eventos unificado, base legal estruturada e o modelo do aluno (BKT) que
substitui o limiar binário.
**Depende de**: Etapa 1 (A.1). D.1 e D.5 nascem juntos; D.2 depende de D.1 existir (mas processa
também o histórico de `attempts` retroativamente).
**Duração estimada**: 2–3 semanas.

---

## D.1 — Tabela `learning_events` (xAPI-lite) + instrumentação (M)

**Problema**: `interactions.student_action` mistura tipos enumerados (`ova_opened`,
`quiz_submitted`) com strings PT livres ("Abriu o assistente do OVA" — `OvaReader.tsx:239`);
tempo de resposta do quiz, play/pause/seek de mídia e as perguntas do tutor-chat (o sinal
diagnóstico mais rico) não são registrados.

1. `migration_006_learning_events.sql`:

```sql
CREATE TABLE learning_events (
    event_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    verb VARCHAR(30) NOT NULL,       -- logged_in|opened|read|played|paused|seeked|completed|
                                     -- answered|asked_tutor|received_intervention|dismissed
    object_type VARCHAR(20) NOT NULL,-- ova|resource|question|intervention|session
    object_id INT NULL,
    context JSON NULL,               -- {perc, seconds, correct, response_ms, session_id, text_hash...}
    occurred_at DATETIME NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    INDEX idx_events_student (student_id, occurred_at),
    INDEX idx_events_verb (verb, occurred_at)
);
```

2. Backend: `POST /events` (auth; aceita **lote** `{events: [...]}`, máx. 50/req; valida verbos
   contra enum; `student_id` do token). Serviço `edubot/services/events.py::emit(student, verb,
   object_type, object_id, **context)` para uso interno (rotas emitem `answered` com `response_ms`
   e `correct` dentro de `/question/answer`; `received_intervention`/`dismissed` na proatividade e
   no ack).
3. Front: `services/events.ts` — fila em memória, flush a cada 15 s junto do sync de progresso e
   no `pagehide` (mesmo padrão do delta). Instrumentar:
   - `logged_in` (Login), `opened` (OvaReader), `completed` (transição de conclusão);
   - players: `played`/`paused`/`seeked` (VideoPlayer/AudioPlayer já têm os handlers de
     progresso — adicionar os eventos discretos);
   - quiz: `response_ms` medido do render da questão ao submit;
   - `asked_tutor`: o `TutorChat` emite com `context.text` = pergunta do aluno (com consentimento
     do D.5; guardar o texto é o valor — é a matéria-prima do diagnóstico do agente).
4. **Não** apagar `interactions` ainda: `registerInteraction` passa a delegar para `/events`
   internamente (verbo mapeado), e `_days_without_access` ganha `learning_events` como quinta
   fonte. Aposentar `interactions` só quando D.2/D.3 estiverem estáveis (migration futura).

**Teste**: lote com verbo inválido → 400; 51 eventos → 400; eventos gravados com student do token.

---

## D.5 — Consentimento, "Meus dados" e retenção (M) — *junto com D.1*

1. `migration_007_consents.sql`:

```sql
CREATE TABLE consents (
    consent_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    purpose VARCHAR(40) NOT NULL,    -- tracking_pedagogico | ia_sobre_dados | imagem_voz
    granted BOOLEAN NOT NULL,
    granted_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT uc_consent UNIQUE (student_id, purpose)
);
```

2. Fluxo: no primeiro login pós-migração, modal de consentimento (React) explica as 3 finalidades;
   `tracking_pedagogico` é condição do serviço (base legal: execução de contrato educacional —
   informar, não opcional); `ia_sobre_dados` e `imagem_voz` são opt-in revogáveis.
   `POST /consents` grava; `GET /consents` alimenta a tela.
3. Enforcement no backend (não só UI): `events.emit` de `asked_tutor` com texto exige
   `ia_sobre_dados`; sem ele, grava só metadados (`text: null`). Caminhos LLM sem `ia_sobre_dados`:
   agente roda **só regras/templates** para aquele aluno (o fallback já existe — é escolher o ramo).
4. Tela "Meus dados" (em Meu desempenho): consentimentos com toggle, export JSON (promover o botão
   que já existe em `Report.tsx:44-51`), botão "solicitar exclusão" → `POST /student/me/delete-request`
   cria alerta para admin (exclusão efetiva é manual na v1; os `ON DELETE CASCADE` do schema já
   propagam quando o admin executar).
5. Retenção: job mensal no scheduler — eventos > 24 meses são agregados (contagens por verbo/mês em
   tabela `events_archive`) e apagados.
6. Minimização nos prompts como **política declarada**: digest do agente carrega primeiro nome e
   métricas, nunca RA/e-mail (o `coach.py:19-33` já faz certo; replicar no B.4 e documentar).

---

## D.2 — Mastery por competência (BKT + decaimento) (M)

**Problema**: o "modelo do aluno" é razão acertos/total com limiar 0.8, sem tempo, sem tentativas,
sem esquecimento (`student_context.py:118-124`).

1. `migration_008_mastery.sql`:

```sql
CREATE TABLE student_mastery (
    student_id INT NOT NULL,
    competency_id INT NOT NULL,
    p_mastery FLOAT NOT NULL DEFAULT 0.2,
    attempts_seen INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (student_id, competency_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(competency_id) ON DELETE CASCADE
);
```

2. `edubot/services/mastery.py` — BKT clássico, ~30 linhas, parâmetros em constantes ajustáveis
   (mesmo espírito dos thresholds de `student_context.py:33-36`):

```python
P_INIT, P_LEARN, P_SLIP, P_GUESS = 0.20, 0.15, 0.10, 0.25
DECAY_PER_WEEK = 0.02        # esquecimento: p_mastery decai por semana sem prática

def update_on_attempt(student_id, competency_id, is_correct):
    row = _get_or_init(student_id, competency_id)
    p = _apply_decay(row.p_mastery, row.updated_at)
    if is_correct:
        num = p * (1 - P_SLIP)
        den = num + (1 - p) * P_GUESS
    else:
        num = p * P_SLIP
        den = num + (1 - p) * (1 - P_GUESS)
    p_given = num / den if den else p
    row.p_mastery = p_given + (1 - p_given) * P_LEARN
    row.attempts_seen += 1
    row.updated_at = datetime.datetime.now()
    row.save()
```

3. Ganchos: `/question/answer` chama `update_on_attempt` após gravar o attempt (síncrono, é 1
   upsert). Script one-off `tools/backfill_mastery.py` reprocessa `attempts` históricos em ordem
   cronológica (o índice de A.2 ajuda).
4. Integração no perfil: `_competency_rows` (A.1) ganha LEFT JOIN com `student_mastery`; o status
   textual passa a derivar de `p_mastery` (mantendo os 3 rótulos da UI):
   `< 0.4` não iniciada/frágil · `0.4–0.8` em desenvolvimento · `≥ 0.8` desenvolvida.
   Expor também o número (`p_mastery`) — o front mostra "domínio estimado: 74%".
5. As regras do agente e as tools (`listar_competencias_fracas`) ordenam por `p_mastery` asc em vez
   de taxa de erro — sinal mais estável.

**Teste**: sequência acerto/erro conhecida → p_mastery esperado (valores calculados à mão);
decaimento após 4 semanas simuladas; backfill idempotente.

**Comunicação**: os números do dashboard mudam de significado — anunciar como "estimativa de
domínio v2" (nota de corte, como o read_time da Fase 1 original).

**Gate de saída da Etapa 3**: eventos fluindo (conferir contagem por verbo), consentimento
aplicado nos caminhos de IA, mastery visível no perfil e alimentando as regras.

---

# ETAPA 4 — Agente de verdade (loop genérico, ações, revisão espaçada)

**Objetivo**: generalizar o loop de tool-use, fazer a intervenção ser redigida para o caso
concreto, dar ao agente ações novas com tiers de autonomia.
**Depende de**: Etapas 2 (B.1/B.2) e 3 (D.2; D.3 nasce aqui).
**Duração estimada**: 3–4 semanas.

---

## B.3 — Loop de tool-use genérico + catálogo unificado (M)

O loop de `personalized.py:197-220` está correto e testado — generalizá-lo, não reescrevê-lo.

1. Novo `edubot/agent/loop.py`:

```python
def run_agent(system, user_prompt, tools_schema, ctx, *, model=None,
              max_iterations=8, trigger_type="on_demand"):
    """Loop Messages API genérico: percepção já está no prompt; cada tool_use é
    executado por execute_tool (validação server-side); devolve (final_text,
    actions, usage). Registra em agent_decisions (B.2) ao final, sempre."""
```

   `personalized.py` passa a ser: system prompt específico + chamada a `run_agent` — o
   comportamento atual vira um *caso* do loop (teste de regressão: `test_personalized_ova.py`
   continua verde).
2. `tools.py` reorganizado em dois grupos com metadado de autonomia:

```python
TOOLS = {
  # leitura — livres
  "obter_perfil_resumido":        {"fn": ..., "tier": "read"},
  "listar_competencias_fracas":   {"fn": ..., "tier": "read"},   # já existe
  "listar_recursos_remediacao":   {"fn": ..., "tier": "read"},   # já existe
  "listar_questoes_reforco":      {"fn": ..., "tier": "read"},   # já existe
  "historico_intervencoes":       {"fn": ..., "tier": "read"},   # inclui outcome (B.6)
  # escrita — autônomas (reversíveis, internas, idempotentes)
  "criar_intervencao":            {"fn": ..., "tier": "auto"},
  "criar_ova_personalizada":      {"fn": ..., "tier": "auto"},   # já existe
  "agendar_revisao":              {"fn": ..., "tier": "auto"},   # D.3
  "ajustar_dificuldade":          {"fn": ..., "tier": "auto_capped"},  # ±1 nível/dia
  # escrita — human-in-the-loop
  "alertar_tutor":                {"fn": ..., "tier": "auto_or_queue"}, # severidade alta → fila
  "propor_mensagem_do_tutor":     {"fn": ..., "tier": "queue"},  # tutor aprova antes
}
```

3. **Idempotência dentro das tools** (o modelo não consegue duplicar nem repetindo):
   `criar_intervencao` calcula `key = (student_id, tipo, date.today())` e faz o mesmo dedup de
   `proactivity.py:49-56` — movido para a tool, fonte única.
4. `execute_tool` mantém o contrato atual (erro vira payload, nunca exceção — `tools.py:250-259`).

---

## B.4 — Intervenção redigida por caso (Haiku) no gatilho por evento (M)

Hoje o gatilho aplica regra → template fixo. Passa a: regra decide **se e o quê** (grátis), Haiku
redige **como** (barato), template é o fallback.

1. Em `proactivity.evaluate_student`: após `get_recommendation` escolher a regra, se
   `llm.is_real()` e orçamento ok (B.2) e consentimento ok (D.5):

```python
texto = redigir_intervencao(digest, regra, lang)   # novo, em edubot/agent/redactor.py
# Haiku, max_tokens=250, system fixo (cacheável), fallback = rec["mensagem_aluno"] (template)
```

   `redactor.py` usa `llm.messages_create(model=os.getenv("EDUBOT_REDACTOR_MODEL",
   "claude-haiku-4-5-20251001"), ...)` — mesmo padrão do coach (`coach.py:59-64`).
   O digest inclui: primeiro nome, regra disparada, competência mais fraca **com as últimas 3
   perguntas feitas ao tutor** (D.1 — é isso que mata o "genérico") e o outcome das últimas
   intervenções (B.6, quando existir).
2. **Prompt caching**: system prompt do redator e catálogo de tools são estáveis → habilitar cache
   (`cache_control` no system block; na Bedrock via SDK anthropic funciona igual). Medir hit rate
   no `agent_decisions`.
3. Sweep noturno: por padrão continua template (custo zero); env
   `EDUBOT_SWEEP_LLM_TOP_N=10` → os N alunos de maior risco (menor mastery média + mais dias sem
   acesso) ganham redação LLM.
4. Circuit breaker em `llm.py`: 3 falhas consecutivas → `is_real()` retorna False por 10 min
   (estado em módulo) + WARNING. Evita pagar timeout em cascata no sweep.

**Teste**: com provider mock, tudo continua igual (template); simular falha da LLM → intervenção
sai com template, request não quebra (o padrão best-effort de `trigger_evaluation` já garante).

---

## D.3 — Revisão espaçada (SM-2 simplificado) + tool `agendar_revisao` (M)

1. `migration_009_reviews.sql`:

```sql
CREATE TABLE review_schedule (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    competency_id INT NOT NULL,
    due_date DATE NOT NULL,
    interval_days INT NOT NULL DEFAULT 1,
    ease FLOAT NOT NULL DEFAULT 2.5,
    status VARCHAR(20) NOT NULL DEFAULT 'agendada',  -- agendada|vencida|cumprida|cancelada
    created_by VARCHAR(20) NOT NULL DEFAULT 'agent', -- agent|rule|tutor
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(competency_id) ON DELETE CASCADE,
    INDEX idx_review_due (due_date, status),
    CONSTRAINT uc_review UNIQUE (student_id, competency_id, due_date)
);
```

2. `edubot/services/reviews.py`:
   - `schedule(student, competency, base_interval=1)` — cria/reagenda (a unique dá idempotência);
   - gatilho automático: quando `p_mastery` cruza 0.8 para cima (D.2), agenda revisão em 3 dias;
   - ao responder questões da competência **na data ou depois**: acerto → `interval_days ×= ease`
     (teto 60), reagenda; erro → volta a 1 dia e `ease = max(1.3, ease - 0.2)`;
   - o sweep diário marca vencidas e cria intervenção "hora de revisar *X*" (dedupada) com link
     `#/modulo/<ova_da_competencia>/quiz`.
3. Tool `agendar_revisao(competency_id, days_from_now)` para o agente (tier auto; valida que a
   competência é do curso do aluno, mesmo padrão de validação de `tools.py:195-211`).
4. UI: "Meu desempenho" mostra a agenda ("Revisões desta semana"); a intervenção de revisão é o
   canal principal.

**Teste**: acerto na revisão expande intervalo; erro reseta; sweep cria intervenção só no
vencimento; dedup por dia.

---

## B.5 — Ações novas + fila de aprovação do tutor (G)

1. **`ajustar_dificuldade`** (depende de D.4 ter `questions.difficulty` — se D.4 ainda não rodou,
   adiar esta tool):
   - `student_difficulty(student_id, competency_id, level INT)` tabela simples; o pool servido em
     `/question/ova` filtra por `difficulty <= level+1` (zona proximal);
   - teto: 1 mudança/dia por competência (validado na tool, não no prompt).
2. **`alertar_tutor`**: severidade `baixa|media` → cria `Alerts` direto (fluxo atual);
   `alta` → cria com `status='aguardando_aprovacao'` (nova coluna) e **não** notifica o aluno.
3. **Fila de aprovação** (`TutorPanel.tsx`): seção "Ações propostas pelo EduBot" — cada item
   mostra a proposta + justificativa (`agent_decisions.input_digest` linkado) + botões
   Aprovar/Editar/Rejeitar. Aprovação executa a ação; tudo vira `outcome` na decisão.
4. **`propor_mensagem_do_tutor`**: o agente redige uma mensagem que *o tutor* enviaria ao aluno;
   entra na fila; ao aprovar, vira intervenção assinada "do seu tutor". **Nunca** sai sem
   aprovação (tier queue — política, validada na tool).

**Teste**: tool tier queue nunca cria efeito visível ao aluno sem aprovação; aprovação executa 1
vez (idempotência).

---

## U.5 — Onboarding (P/M) e U.7 — Acessibilidade (M)

*(entram nesta etapa porque o onboarding usa o agente/coach já ligado)*

**U.5**: no primeiro login (`learning_events` sem `logged_in` anterior — ou flag no localStorage):
1. O EduBot se apresenta (coach/avatar) com 3 passos: "seus módulos estão aqui" → "o quiz libera
   depois da leitura" → "eu aviso você por aqui" (aponta o sino).
2. Estado vazio do dashboard com CTA "Abrir meu primeiro módulo".

**U.7** (varredura com axe-devtools + teclado):
- foco programático ao abrir/fechar `TutorChat`, popovers da topbar e modal de consentimento
  (D.5); `Esc` fecha; foco retorna ao gatilho;
- `aria-live="polite"` no feedback de correção do quiz e nos toasts (`ui/Toast.tsx`);
- navegação por teclado no `Carousel.tsx` (setas) e `Accordion.tsx` (já é button?  conferir);
- contraste: `text-muted` sobre `bg-slate-50` ≥ 4.5:1 (ajustar token se falhar);
- `prefers-reduced-motion`: desligar respiração/blink do avatar e transições longas.

**Gate de saída da Etapa 4**: errar quiz de propósito → intervenção **específica do caso** (cita a
competência e, se houver, a dúvida perguntada ao tutor) aparece sem clique; revisão agendada e
cobrada no vencimento; ação de tier alto esperando aprovação no painel; tudo em
`agent_decisions` com custo.

---

# ETAPA 5 — Voz e presença (Polly + avatar onde importa)

**Objetivo**: dar ao EduBot voz de qualidade com lip-sync real e colocá-lo nos momentos de fala
que agora são relevantes (intervenções da Etapa 4).
**Depende de**: Etapa 4 (B.4 — o avatar precisa ter algo relevante a dizer).
**Duração estimada**: 2 semanas + D.4/D.6 em paralelo.

---

## V.1 — AWS Polly neural + visemas com cache (M)

1. IAM: adicionar `polly:SynthesizeSpeech` à role/credencial existente (mesma conta do Bedrock).
2. Backend `edubot/services/speech.py` + rota `POST /edubot/speak`:

```python
# body: {text, lang}  →  {audio_url, visemes: [{time_ms, viseme}], cached: bool}
VOICES = {"pt": "Camila", "en": "Joanna"}          # neurais; env-overridable
def synthesize(text, lang):
    key = hashlib.sha256(f"{lang}|{text}".encode()).hexdigest()
    if _cache_hit(key): return _cached(key)         # FS local ./speech_cache (v1) ou S3
    polly = boto3.client("polly", region_name=AWS_REGION)
    audio = polly.synthesize_speech(Text=text, VoiceId=VOICES[lang],
                                    Engine="neural", OutputFormat="mp3")
    marks = polly.synthesize_speech(Text=text, VoiceId=VOICES[lang], Engine="neural",
                                    OutputFormat="json", SpeechMarkTypes=["viseme"])
    ...
```

   Cache por hash do texto (intervenções/coach repetem muito) → custo tende a centavos.
   Servir o mp3 via rota autenticada (`GET /edubot/speech/<key>.mp3`) ou volume estático do Apache.
3. Front — `useSpeech.ts` ganha modo Polly mantendo a interface (`speak/stop/speaking`):
   - `speak(text, lang)`: chama `/edubot/speak`, toca o mp3 (`<audio>`), agenda a timeline de
     visemas com `requestAnimationFrame` contra `audio.currentTime`;
   - expõe `visemeRef.current` (viseme atual) além de `speaking`;
   - **fallback**: Polly falhou/sem consentimento (`imagem_voz` não se aplica aqui — voz do bot,
     não do aluno; sem consentimento novo) → Web Speech como hoje.
4. `Avatar3D.tsx`: `mouthRef` passa a mapear visemas (o arquivo já anuncia isso —
   `Avatar3D.tsx:9-12`). Mapa mínimo Polly→abertura/forma: `p/b/m`→fechada, `a/E`→aberta,
   `o/u/@`→arredondada (escala X), `f/v`→lábio, `sil`→neutra. Interpolar com `MathUtils.damp`
   (já usado).
5. `EduBotAvatar.tsx` (2D): mesma timeline com 3–4 sprites de boca — o fallback também ganha
   lip-sync.

**Métricas (decidem o V.3)**: contagem de cliques em "Ouvir o EduBot" (evento `played` sobre
`object_type=speech`), % de intervenções ouvidas vs. lidas.

---

## V.2 — Avatar nos momentos de fala (P/M)

1. `EduBotInbox` (dashboard): botão ▶ por intervenção — o avatar (mini, canto do card) fala o
   texto via V.1.
2. Onboarding (U.5) apresentado pelo avatar falante.
3. Persistir a persona escolhida em localStorage (hoje o seletor de `PerformanceCoach.tsx:74`
   reseta a cada visita) e usá-la em todos os pontos de fala.
4. Medir por 2–4 semanas antes de qualquer investimento do V.3 (ver métricas acima + taxa de
   dispensa de intervenção com/sem áudio).

---

## D.4 — Dificuldade por questão + pool adaptativo (M)

1. `migration_010_difficulty.sql`: `ALTER TABLE questions ADD COLUMN difficulty TINYINT NOT NULL
   DEFAULT 2` (1 fácil · 2 média · 3 difícil). Seed inicial: à mão para as 32 questões OU
   calibração automática = proporção global de erro em `attempts` (job one-off:
   `<25%` erro→1, `25–60%`→2, `>60%`→3; recalibrar mensalmente no scheduler).
2. `/question/ova` ordena/filtra o pool por `difficulty` vs. mastery da competência (D.2):
   mastery `<0.4` → começa nas fáceis; `≥0.8` → inclui difíceis. Zona proximal, determinístico.
3. Tool `ajustar_dificuldade` (B.5) passa a ter efeito real.

## D.6 — Painéis de mastery (M)

1. Aluno (`Evolution.tsx`): barra por competência com `p_mastery` + seta de tendência (comparar
   com snapshot de 7 dias — guardar `p_mastery` diário em `student_mastery_history` ou derivar de
   `learning_events`); agenda de revisões (D.3).
2. Tutor (`TutorPanel.tsx`): heatmap turma × competência — 1 query de `student_mastery` agregada
   (AVG por competência + distribuição), grid colorido simples (sem lib nova; células div com
   escala de cor).

**Gate de saída da Etapa 5**: EduBot fala com voz neural e boca sincronizada em qualquer
dispositivo (fallback web speech ok); intervenções audíveis; quiz servindo pool por nível;
heatmap do tutor no ar; métricas de uso de voz sendo coletadas.

---

# ETAPA 6 — Fechamento de loop e visão de avatares

**Objetivo**: o agente aprende com o resultado das próprias ações; pipeline de personagens com
consentimento formal.
**Depende de**: Etapas 4 e 5 (e das métricas do V.2 para decidir o investimento do V.3).

---

## B.6 — `outcome`: o agente observa o efeito do que fez (M)

1. Job diário no scheduler (`edubot/services/outcomes.py`): para cada `agent_decisions` com
   `outcome IS NULL` e `created_at` entre 2 e 14 dias atrás:
   - intervenção dispensada sem ação (`dismissed` sem `opened` do módulo alvo) → `dispensada`;
   - módulo/quiz alvo aberto em ≤ 7 dias → `aceita`;
   - `p_mastery` da competência-alvo subiu ≥ 0.1 em 14 dias → `melhorou`;
   - nada em 14 dias → `expirada`.
2. `historico_intervencoes` (tool e perfil) passa a incluir o outcome; o digest do redator (B.4)
   ganha a linha: *"últimas intervenções: 3 dispensadas, 1 aceita (formato vídeo)"* — o modelo é
   instruído a variar a abordagem quando o histórico mostra rejeição.
3. Painel do tutor: taxa de aceitação por tipo de intervenção (1 GROUP BY em `agent_decisions`) —
   é o KPI do agente.

## V.3 — Pipeline GLB/VRM com blendshapes (G)

*Somente se as métricas do V.2 justificarem.*

1. Loader `GLTFLoader` (three.js já no bundle) com lazy-load do modelo (1–4 MB) apenas quando o
   card/momento de fala abre; `AVATAR_PERSONAS` (`avatars.ts`) ganha variante
   `{kind: "glb", url, visemeMap}` ao lado das procedurais.
2. Mapear visemas Polly → blendshapes ARKit (`jawOpen`, `mouthFunnel`, `mouthPucker`,
   `mouthClose`...) — tabela estática de pesos por viseme, interpolada por damp (mesmo padrão do
   V.1).
3. Fonte dos modelos: Ready Player Me via **export offline** do .glb (evita o bloqueio de rede
   registrado em `AVATAR_3D.md` — o SDK runtime não entra no produto), ou VRoid/VRM, ou artista
   (personagem original da marca). O pipeline é agnóstico: qualquer GLB/VRM com ARKit blendshapes.
4. Fallback em cascata: GLB falhou → procedural → 2D (o `onError` de `PerformanceCoach.tsx:105-114`
   já existe; estender).
5. Orçamento de performance: testar em GPU integrada; teto de ~50k triângulos/persona; `dpr` ≤ 1.5.

## V.4 — Virtualização de personagem com consentimento formal (G)

1. `migration_011_avatar_licenses.sql`:

```sql
CREATE TABLE avatar_licenses (
    avatar_id VARCHAR(40) PRIMARY KEY,          -- casa com AVATAR_PERSONAS.id
    subject_type VARCHAR(20) NOT NULL,          -- original | pessoa_real | historico_estilizado
    display_name VARCHAR(100),
    consent_doc_url TEXT NULL,                  -- termo assinado (pessoa_real: obrigatório)
    granted_by VARCHAR(100) NULL,
    scope TEXT NULL,                            -- usos autorizados
    expires_at DATE NULL,
    revoked_at DATETIME NULL
);
```

2. Regra de sistema (não de processo): o endpoint que lista personas para o front só devolve
   avatares com licença válida (`pessoa_real` exige `consent_doc_url` e não-revogado/na validade).
   Revogação → avatar some do seletor imediatamente; quem o tinha selecionado volta ao mascote.
3. Termo padrão (com o jurídico/DPO da instituição): finalidade (avatar no EduBot), materiais
   cedidos (fotos de referência), prazo, revogabilidade, **sem clonagem de voz na v1** (voz é
   Polly genérica).
4. Piloto: avatar de um professor real voluntário (maior vínculo, testa o workflow inteiro).
5. Política permanente: figuras históricas continuam **estilizadas/evocativas** (Einstein tem
   licenciamento ativo — Hebrew University/Greenlight; não usar semelhança realista sem licença).

## V.5 — Opcional, medido: vídeo generativo pré-renderizado (M)

Apenas para peças fixas (boas-vindas do curso, marcos de conclusão) — nunca fala dinâmica
(custo/latência inviáveis). Reavaliar talking heads 3DGS/NeRF quando houver produto maduro; hoje
(2026) não construir em cima.

**Gate de saída da Etapa 6**: taxa de aceitação de intervenções visível e usada pelo redator;
pelo menos 1 personagem GLB com licença registrada e lip-sync; revogação de licença testada.

---

# Checklist mestre (ordem de execução)

```
ETAPA 1  [x] A.1 perfil agregado (≤8 queries)     [x] A.2 índices (migration_003)
         [x] A.3 auth restante + rate-limit       [x] A.4 ack de alertas
         [x] A.5 visibilidade/idle no ticker      [x] A.6 higiene + upsert atômico
         [x] A.7 testes novos   — ETAPA 1 CONCLUÍDA (67 testes verdes). Ver LOG_EXECUCAO.md
ETAPA 2  [~] U.8 rotas #/modulo/:id (DIFERIDO)    [x] U.1 gate de quiz backend (migration_004) + front gate-aware
         [~] U.2 fundir Atividades (DIFERIDO)     [~] U.3 inbox única (DIFERIDO)
         [x] U.4 continuar de onde parou (backend: last_access)  [~] U.6 "Professor Mediador" (DIFERIDO)
         [x] B.1 Bedrock LIGADO e validado (bearer token + inference profiles)  [x] B.2 agent_decisions (migration_005) + budget
         — Backend Etapa 2 CONCLUÍDO (78 testes). Reestruturação de navegação (U.8/U.2/U.3/U.6)
           projetada e diferida para sessão com build Vite. Ver LOG_EXECUCAO.md.
ETAPA 3  [x] D.1 learning_events (migration_006) + POST /events + ganchos  [x] D.5 consents (migration_007) + Meus dados + enforcement
         [x] D.2 mastery/BKT (migration_008) + backfill + domínio no perfil/teia
         — Etapa 3 CONCLUÍDA (103 testes; build front exit 0; validada em stack real).
           Diferido: eventos de player (played/paused/seeked) e asked_tutor via TutorChat;
           job mensal de retenção/events_archive. Ver LOG_EXECUCAO.md.
ETAPA 4  [x] B.3 loop genérico + catálogo/tiers   [x] B.4 redator Haiku + caching + breaker
         [x] D.3 revisão espaçada (migration_009) [x] B.5 ações novas + fila (migrations 011/012)
         [x] U.5 onboarding (modal 3 passos + estado vazio)  [x] U.7 acessibilidade (aria-live, dialog/foco, reduced-motion, teclado)
         — Etapa 4 CONCLUÍDA (146 testes; build front exit 0; B.4/B.5 validados em stack real;
           U.5/U.7 entregues). Diferido: sweep top-N do redator. Ver LOG_EXECUCAO.md.
ETAPA 5  [x] V.1 Polly + visemas + cache (backend + useSpeech)  [x] V.2 avatar falante nos cards + persona persistida
         [x] D.4 dificuldade (migration_010) + pool adaptativo  [x] D.6 heatmap do tutor
         — Etapa 5 CONCLUÍDA (137 testes; build front exit 0; validado em stack real).
           Diferido: wiring de visema no Avatar3D/EduBotAvatar, tendência de domínio do aluno
           (snapshot 7d), V.3/V.4 (avatares GLB+licenças), e a chamada REAL do Polly (exige
           credencial de voz — a Bedrock key não cobre). Ver LOG.
ETAPA 6  [x] B.6 outcomes (loop de aprendizado do agente)  [~] V.3 pipeline GLB (DIFERIDO — só se V.2 aprovar)
         [~] V.4 avatar_licenses (migration_013) + piloto (DIFERIDO)  [~] V.5 (opcional, diferido)
         — B.6 CONCLUÍDO (155 testes; build front exit 0; loop validado em stack real:
           decisão→engajamento→outcome→KPI). V.3/V.4/V.5 dependem das métricas do V.2 (avatar)
           e de trabalho jurídico (licenças) — diferidos por design. Ver LOG_EXECUCAO.md.
AUDITORIA[x] Revisão de consistência das Etapas 1–6 (2026-07-10): 7 defeitos encontrados e
           CORRIGIDOS — vínculo alerts.decision_id→outcome (B.5/B.6), dedup de proposta na
           fila, fuso do occurred_at (D.1), env do redator/breaker/budget não repassado pelo
           compose (B.4), custo de coach/tutor-chat fora do orçamento (B.2), asked_tutor e
           completed nunca emitidos (D.1). 160 testes verdes. Ver LOG_EXECUCAO.md.
```

# Variáveis de ambiente novas (consolidado)

| Variável | Default | Etapa |
|---|---|---|
| `EDUBOT_CORS_ORIGINS` | `http://localhost:8010` | 1 (A.3) |
| `EDUBOT_DAILY_BUDGET_USD` | `1.00` | 2 (B.2) |
| `EDUBOT_REDACTOR_MODEL` | `claude-haiku-4-5-20251001` | 4 (B.4) |
| `EDUBOT_REDACTOR_MAX_TOKENS` | `250` | 4 (B.4) |
| `EDUBOT_LLM_BREAKER_THRESHOLD` | `3` | 4 (B.4) |
| `EDUBOT_LLM_BREAKER_COOLDOWN` | `600` | 4 (B.4) |
| `EDUBOT_SWEEP_LLM_TOP_N` | `10` | 4 (B.4 — diferido) |
| `EDUBOT_POLLY_VOICE_PT` / `_EN` | `Camila` / `Joanna` | 5 (V.1) |
| `EDUBOT_SPEECH_CACHE_DIR` | `./speech_cache` | 5 (V.1) |
| `EDUBOT_SPEECH` | `auto` (`off` força fallback) | 5 (V.1) |

# Migrations novas (consolidado)

003 índices · 004 quiz_gate · 005 agent_decisions · 006 learning_events · 007 consents ·
008 student_mastery · 009 review_schedule · 010 questions.difficulty · 011 student_difficulty ·
012 alert_approval · 013 avatar_licenses (Etapa 6, futura).
Todas idempotentes, entram no init do Docker (ordem alfabética após `dml_extra.sql`) e rodam em
volume existente via `docker exec` (padrão documentado nas migrations 001/002).

# O que este plano deliberadamente NÃO faz

- Trocar Flask/Peewee/React, tema visual, ou o hash router por react-router.
- Framework de agentes (LangChain etc.), multi-agente, fine-tuning, RAG vetorial no tutor-chat.
- DKT/deep knowledge tracing (volume não justifica; BKT + decaimento cobre).
- LRS xAPI completo, streaming/Kafka, fila de mensagens (1 réplica + APScheduler atende).
- MetaHuman/Pixel Streaming, vídeo generativo dinâmico, clonagem de voz.
- Gamificação por pontos/ranking antes de personalização medida.
  → *Pré-requisito cumprido nas Etapas 3–6: a continuação (preferência de
  aprendizagem no Reforço + gamificação + engajamento) está em
  `PLANO_EXECUCAO_2.md` (Etapas 7–9, decisões de produto de 2026-07-10).*
