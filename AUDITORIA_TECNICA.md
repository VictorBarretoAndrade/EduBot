# Auditoria Técnica e Plano de Refatoração — Ecossistema EduBot (OVA-IA)

> Documento gerado a partir de leitura completa do código do zero: 13 rotas Flask, 17 modelos Peewee,
> os 7 módulos do `edubot_agent`, os ~25 componentes React, o leitor legado (jQuery), o SQL, o compose
> e o histórico git. Data da auditoria: 2026-07-03.

## Mapa da arquitetura (como está hoje)

```
Aluno ──► React SPA (/app, porta 8010 via Apache)          Aluno/Tutor ──► HTML legado (jQuery, /html)
              │  api.ts (fetch, payload [data], Bearer)          │  request.js ($.ajax, mesmo contrato)
              ▼                                                  ▼
        Flask (porta 5010) ── api.py registra 12 blueprints (rotas com sys.path.append)
              │
   ┌──────────┼───────────────────────────────────────────────┐
   │ auth.py (HMAC token) │ services/student_context.py       │ edubot_agent/
   │ só cobre progress/   │ (perfil completo do aluno,        │  agent.py (6 regras mock)
   │ edubot/tutor/pova    │ N+1 pesado, chamado em todo lugar) │  tutor.py (RAG por overlap, mock)
   └──────────┬───────────┴───────────────────────────────────┤  personalized.py (loop tool-use REAL)
              ▼                                               │  coach.py (Bedrock real via boto3)
        Peewee ──► MySQL (docker) ou SQLite silencioso        │  llm.py (mock|bedrock|anthropic — correto)
                                                              └─ tools.py (4 tools validadas)

Fluxos: login → token+ids no localStorage │ tracking: OvaReader (scroll/tempo) + players → /progress/*
quiz: /question/ova (sem gabarito) → /question/answer (corrige server-side, grava attempts)
agente: TUDO sob clique (Report.tsx, TutorPanel.tsx) — zero proatividade
i18n: t(pt,en) inline + contentDict.ts (dicionário manual PT→EN) + .en.html opcional por OVA
build: compose sobe MySQL + Flask + container Node que compila o React para files/app + Apache
```

---

## A. Relatório de auditoria (achados priorizados)

### CRÍTICOS — errado por construção, precisa sair já

**A1. `read_time` mede a maior sessão, não o tempo total de leitura.**
Evidência: `Front-End/react-logic-demo/src/components/ova/OvaReader.tsx:87-99` zera o cronômetro a cada
abertura do OVA (`timeRef = { current: 0 }`) e envia o valor absoluto; o backend faz
`max(progress.read_time, read_time)` em `Back-End/api/routes/progressRoute.py:90`.
Cenário: aluno lê 10 min hoje e 10 min amanhã → banco registra **10 min**, não 20. É a causa direta do
"tempo de leitura inconsistente". (No legado, `Front-End/files/js/ova.js:33` acumulava em localStorage —
por navegador, não por aluno, outro defeito.)
Impacto: a métrica central do rastreamento é estruturalmente errada; tudo que deriva dela (dashboard,
regras do agente) herda o erro.

**A2. `dias_sem_acesso` deriva só de `interactions`, que o front novo quase não alimenta.**
Evidência: `Back-End/api/services/student_context.py:42-53` calcula inatividade pelo MAX de
`interaction_date`; no React, `registerInteraction` só é chamado ao abrir o assistente, clicar em
carrossel ou acordeão (`OvaReader.tsx:129`). Login, abertura de OVA, quiz e players **não geram
interação**.
Cenário: aluno estuda todo dia (lê, assiste, responde quiz) sem tocar num carrossel → a Regra 1 do
agente (maior prioridade, `edubot_agent/agent.py:39`) dispara "você está há N dias sem acessar" — falso.
Impacto: a regra de mais alta prioridade do EduBot decide sobre um sinal quebrado.

**A3. Escrita e leitura sem autenticação + IDOR.**
Evidência: `/interaction/register` aceita `student_id` do payload sem token
(`Back-End/api/routes/interactionRoute.py:32-35`); `/question/answer` grava `attempts` em nome de
qualquer aluno (`Back-End/api/routes/questionRoute.py:110-131`); `/student/report/<id>` devolve nome,
desempenho e histórico de **qualquer** aluno sem login (`Back-End/api/routes/reportRoute.py:29`). O
`@require_auth` existe e é bom (`Back-End/api/auth.py`), mas só cobre progress/edubot/tutor/personalized.
Cenário: `curl POST /question/answer` com `student_id=5` forja tentativas erradas → `taxa_erro` do aluno
5 sobe → agente recomenda remediação indevida. Dados que alimentam decisões pedagógicas são forjáveis
anonimamente.

**A4. Fallback silencioso para SQLite vazio.**
Evidência: `Back-End/data/models/base.py:6-18` — se o DNS `ova_mysql` não resolver *no momento do
import*, a API sobe apontando para `dev_ova.db` local, sem log, com credenciais MySQL hardcoded; a env
`DB_HOST` definida no compose é **ignorada**.
Cenário: MySQL demora a subir ou hiccup de rede no boot → API "funciona" com banco vazio; progresso do
aluno é gravado no SQLite do container e se perde. Erro invisível.

**A5. Senhas em texto plano.**
Evidência: `student_password varchar(30)` (`Database/sql/ddl.sql:50`), comparação direta em
`Back-End/api/routes/loginRoute.py:39`, seed com senha = RA. Aceitável num seed de demo, mas o
*mecanismo* (comparação de texto plano) não pode sobreviver à refatoração.

### ALTOS — frágil, distorce dados ou não escala

**A6. `perc_scrolled` mede scroll da janela, não leitura do conteúdo.**
`OvaReader.tsx:101-109`: se o conteúdo cabe na viewport (`scrollHeight ≤ clientHeight`), perc fica 0 para
sempre → OVA curto **nunca** completa (`completed` exige ≥90%). Mede altura de tela, não consumo por
seção.

**A7. Attempts duplicáveis inflam a taxa de erro.**
`verify()` reenvia **todas** as questões a cada clique em "Verificar"
(`Front-End/react-logic-demo/src/components/ova/OvaQuiz.tsx:40-58`,
`Front-End/react-logic-demo/src/components/Quiz.tsx:56-86`) e o backend grava um `Attempt` novo sempre
(`Back-End/api/routes/questionRoute.py:127`). Dois cliques = tentativas em dobro → `taxa_erro`
distorcida → Regra 3 do agente dispara errado.

**A8. `GET /edubot/recommendation` cria uma `Intervention` a cada clique.**
`Back-End/api/routes/edubotRoute.py:51-57` — um GET com efeito colateral, sem dedup. Cinco cliques =
cinco intervenções "pendente" poluindo o histórico exibido no dashboard e o próprio perfil que o agente
lê.

**A9. Perfil completo (N+1 pesado) recalculado a cada checkpoint de mídia.**
Cada 10% de vídeo assistido dispara `saveResourceProgress → onTracked → refreshProfile → GET
/student/me`, e `build_student_profile` faz dezenas de queries em loop (por OVA × recurso × competência,
`Back-End/api/services/student_context.py:154-271`). `/tutor/evaluate` repete isso para até 60 alunos
(`Back-End/api/routes/tutorRoute.py:156-189`). Funciona na demo; degrada rápido.

**A10. Tratamento de erro sistematicamente errado.**
Todas as rotas: `except PeeweeException → 501` (501 = *Not Implemented*; o correto seria 500) e nada mais
é capturado — payload malformado (`request.get_json()[0]`) vira 500 sem corpo. Padrão copiado/colado em
13 arquivos, `json.dumps` manual em vez de `jsonify`.

**A11. 88% do repositório git é um virtualenv commitado.**
1.779 dos 2.027 arquivos rastreados são `venv/` (Linux) — o `.gitignore` só cobre `.venv/`. Além de
`.docx`, PNGs de roteiro e `ovas-generation/` (76 OVAs gerados, nunca semeados) na raiz.

**A12. i18n mista — confirmado, com 4 causas distintas.**
1. Enunciados/alternativas do quiz vêm do banco só em PT e não passam por tradução
   (`Front-End/react-logic-demo/src/components/Quiz.tsx:122`);
2. Todas as respostas geradas pelo "cérebro" (recomendação, tutor mock, OVA personalizada) são PT fixo,
   ignorando o idioma da UI (`Back-End/edubot_agent/agent.py:44`, `Back-End/edubot_agent/tutor.py:137`) —
   só o coach recebe `lang`;
3. Strings PT hardcoded fora do `t()` ("% assistido" em
   `Front-End/react-logic-demo/src/components/players/VideoPlayer.tsx:129`, "Tempo de escuta" em
   `Front-End/react-logic-demo/src/components/players/AudioPlayer.tsx:95`);
4. `contentDict.ts` é um dicionário manual acoplado ao seed — qualquer conteúdo novo cai silenciosamente
   em PT, e só 1 dos 4 OVAs tem `.en.html`.

**A13. O agente não age — confirmado.**
`/edubot/recommendation` só roda no clique do aluno
(`Front-End/react-logic-demo/src/components/Report.tsx:31`); `/tutor/evaluate` só no clique do tutor.
Não existe scheduler, job, nem gatilho por evento (ex.: errou o quiz → nada acontece automaticamente). E
as respostas são templates fixos das 6 regras (`Back-End/edubot_agent/agent.py:27-161`) — "genéricas"
como descrito pelo dono do projeto.

### MÉDIOS — dívida estrutural

**A14. Não há pacote Python.**
Todo arquivo abre com `sys.path.append(os.getcwd()...)` e usa imports planos (`from students import
Students`). O funcionamento depende da *ordem* de import (o BUGFIX B7 em plotRoute é sintoma). Isso
inviabiliza testes unitários limpos e é a maior fonte de acoplamento do backend.

**A15. Lógica de domínio triplicada e divergente.**
Status de competência computado em 3 lugares com **limiares diferentes**:
`Back-End/api/services/student_context.py:94-100` e `Back-End/edubot_agent/tools.py:141-147` (0.8,
binário) vs `Back-End/api/routes/reportRoute.py:83-91` (0.8/0.4, com "parcialmente desenvolvida").
`_days_without_access` existe em 3 cópias — a do reportRoute (linha 42) quebra com o SQLite (string −
date = TypeError). `_alternatives_list` duplicada em 2 rotas.

**A16. Convenção `[data]` no payload.**
`request.get_json()[0]` em toda rota POST — envelope sem função, herdado do front jQuery, que obriga o
cliente novo a embrulhar tudo (`Front-End/react-logic-demo/src/services/api.ts:60`) e gera IndexError não
tratado.

**A17. Dois front-ends mantidos em paralelo.**
`files/js` + `files/html` (legado) duplicam login, leitura, quiz, painel e OVA personalizada do app
React. Cada correção precisa ser feita duas vezes (e não está sendo — os leitores já divergem no
tracking).

**A18. Infra frágil no compose.**
Subnet fixa `172.168.30.0/29` está em **espaço público** (RFC1918 vai até 172.31.x.x); IPs fixos numa /29
de 6 endereços; `depends_on` sem healthcheck do MySQL (Flask sobe antes do banco pronto e cai no A4);
`SECRET` default `dev-secret-change-me` (`Back-End/api/auth.py:32`).

**A19. Zero testes.**
Nenhum pytest/vitest; `test/` contém só protótipos manuais; `tools/init_test_db.py` é um seed, não um
teste.

### BAIXOS

- SQL cru com f-strings em `Back-End/plots/data_analysis.py` (mitigado por coerção a int, mas padrão
  perigoso).
- `Courses.course_id < 100` como regra mágica de "curso de admin" (`Back-End/api/routes/courseRoute.py:31`).
- Sync final de leitura via cleanup do React — fechar a aba perde até 15s (falta `sendBeacon`).
- `/question/ova` revela quais questões qualquer `student_id` já acertou (leitura sem auth).

### O que verifiquei e está CERTO (vale registrar)

A correção server-side do quiz sem vazar gabarito (B5/B9), o token HMAC do `auth.py`, o loop de tool-use
do `personalized.py` (formato Messages API correto, IDs validados contra a competência-alvo em
`Back-End/edubot_agent/tools.py:197-213`, aluno vem do token e não do payload), e o `llm.py` — conferido
contra a referência atual do SDK da Anthropic e a classe `AnthropicBedrockMantle`, o prefixo `anthropic.`
para Bedrock e o id `claude-sonnet-4-6` estão corretos. Ligar a IA real é de fato só configurar env.

---

## B. Mapa de reúso

| Módulo | Veredito | Por quê |
|---|---|---|
| `Database/sql` (modelo de dados) | **MANTER** (ajustes) | O schema cobre bem o domínio: progress por OVA e por recurso, attempts, competências, recursos classificados por competência, OVA personalizada. Ajustes: hash de senha, coluna de idioma/tradução de conteúdo, índices. |
| `data/models/*` (Peewee) | **MANTER** (mover p/ pacote) | Modelos corretos e enxutos; só precisam viver num pacote de verdade e o `base.py` ser reescrito (config por env, sem fallback silencioso). |
| `api/auth.py` | **MANTER** | HMAC stdlib simples e correto; exigir `EDUBOT_SECRET` em produção e aplicar em *todas* as rotas. |
| `api/services/student_context.py` | **REFATORAR** | O conceito (perfil único centralizado) é o ativo mais valioso do backend; a implementação N+1 e as cópias divergentes precisam virar agregações SQL numa camada de serviço única. |
| Rotas (`api/routes/*`) | **REFATORAR pesado** | A lógica de negócio embutida é recuperável, mas o esqueleto (sys.path, `[data]`, 501, if-method) deve ser reescrito: rotas finas → serviços. `reportRoute.py` especificamente: **RECONSTRUIR** em cima do student_context (é uma cópia divergente dele). |
| `edubot_agent/llm.py` | **MANTER** | Pequeno, correto, verificado contra o SDK atual. |
| `edubot_agent/personalized.py` + `tools.py` | **MANTER** (refino leve) | O loop de tool-use e a validação das tools são bons; só deduplicar a lógica de competência com o serviço central. |
| `edubot_agent/agent.py` (6 regras) | **REFATORAR** | As regras viram o *motor de gatilhos* da proatividade (avaliação barata e determinística); a *redação* da mensagem migra para a LLM com idioma do aluno. Não jogar fora: regras determinísticas são o que roda em background sem custo. |
| `edubot_agent/tutor.py` | **MANTER** mock como fallback | Grounding via system prompt já é o desenho certo para a LLM real; o retrieval por overlap fica como fallback offline. |
| `edubot_agent/coach.py` | **REFATORAR leve** | Funciona, mas usa o caminho legado boto3/invoke_model paralelo ao llm.py — unificar no llm.py. |
| `plots/data_analysis.py` + plotRoute + plots.js | **RECONSTRUIR ou APOSENTAR** | SQL cru frágil, servindo só o painel legado. O Evolution.tsx (Recharts sobre /student/me) já cobre o aluno; visão de turma nasce do tutorRoute. |
| Front React `services/api.ts` | **MANTER** (limpar `[data]` junto com o back) | Cliente tipado e completo. |
| Front React componentes (Dashboard, Contents, Quiz, Reforco, TutorPanel, players, TutorChat) | **MANTER/REFATORAR leve** | Qualidade boa, visual pronto. Refatorar: tracking do OvaReader (novo contrato), router de verdade, i18n dos pontos do A12. |
| `services/contentDict.ts` | **RECONSTRUIR** | Dicionário manual não escala; tradução de conteúdo deve vir do banco. |
| `ovaContent.ts` (HTML→modelo) | **MANTER curto prazo** | Engenhoso, mas acoplado à estrutura dos HTMLs legados; médio prazo o conteúdo vira estruturado no banco. |
| Front legado (`files/js`, `files/html`) | **APOSENTAR** | Duplica o app React com tracking pior. Manter só os HTMLs de OVA como *fonte de conteúdo* até a migração do conteúdo para o banco. |
| `compose.yaml` / Dockerfiles / httpd.conf | **REFATORAR** | Estrutura ok; corrigir subnet, healthcheck, env do DB, e simplificar o Apache. |
| `venv/`, docx, pngs, `ovas-generation/` no git | **REMOVER do versionamento** | Higiene. |

---

## C. Arquitetura-alvo

```
┌────────────────────────── Front-End (único: React SPA) ──────────────────────────┐
│ views (Dashboard, Contents, OvaReader, Quiz, Reforco, TutorPanel)                 │
│ hooks: useReadingTracker (sessão de leitura: start/heartbeat delta/end+sendBeacon)│
│        useMediaTracker (checkpoints)                                              │
│ services: api.ts (JSON puro, sem [data]) · i18n: t(pt,en) p/ UI + conteúdo do BD  │
└──────────────────────────────┬────────────────────────────────────────────────────┘
                               ▼  (todas as rotas autenticadas; aluno = token)
┌────────────────────────────── Back-End (pacote Python `edubot/`) ─────────────────┐
│ edubot/api/        rotas FINAS: parse+valida payload → chama serviço → jsonify    │
│                    error handler global (400/401/403/404/500 coerentes)           │
│ edubot/services/   student_profile (agregações SQL, fonte única de métricas)      │
│                    tracking (upsert progresso: read_time += delta; eventos)       │
│                    quiz (correção + attempts idempotente por submissão)           │
│                    interventions (criação deduplicada, ciclo de vida)             │
│ edubot/agent/      rules.py (6 regras = gatilhos determinísticos, grátis)         │
│                    llm.py (mantido) · tutor/coach/personalized (mantidos)         │
│                    scheduler: avaliação periódica da turma + gatilhos por evento  │
│                    (quiz ruim ⇒ intervenção; inatividade ⇒ plano; tudo no idioma  │
│                     do aluno; LLM real quando configurada, regra como fallback)   │
│ edubot/data/       models Peewee (mantidos) · db.py (env DB_HOST, sem fallback    │
│                    silencioso; SQLite só com EDUBOT_DB=sqlite explícito)          │
│ tests/             pytest (SQLite memória): serviços, regras, rotas               │
└──────────────────────────────┬────────────────────────────────────────────────────┘
                               ▼
                    MySQL (healthcheck no compose; conteúdo com tradução no banco)
```

### Decisões-chave (e o que NÃO mudar)

1. **Manter Flask + Peewee + React.** O problema não é o stack, é organização. Trocar framework agora só
   adicionaria risco.
2. **Tracking por delta, não por absoluto**: o cliente envia `seconds_delta` desde o último sync; o
   servidor acumula. Elimina o A1 por construção. `completed` = scroll ≥ X **ou** conteúdo sem scroll +
   tempo mínimo (resolve A6). Toda ação relevante (login, abrir OVA, quiz, mídia) grava evento em
   `interactions` com tipo enumerado (resolve A2).
3. **Proatividade em duas camadas**: (a) *gatilho por evento* — ao gravar quiz/progresso, o serviço
   avalia as regras do aluno e cria intervenção/alerta na hora, sem custo de LLM; (b) *varredura agendada*
   (APScheduler in-process ou serviço cron no compose) rodando a avaliação da turma. O dashboard do aluno
   passa a exibir intervenções não lidas — o EduBot "fala primeiro". A LLM entra para *redigir* a mensagem
   (no idioma do aluno), a regra decide *quando*.
4. **i18n em dois trilhos**: UI continua `t(pt,en)` (funciona e é à prova de chave órfã); **conteúdo**
   ganha coluna de tradução no banco (`statement_en`, `alternatives_en`, `*_title_en`...) servida pela API
   conforme `lang` — `contentDict.ts` morre. Agente/tutor recebem `lang` e respondem no idioma do aluno.
5. **Um front só.** O legado é aposentado após paridade; os HTMLs de OVA permanecem como formato de
   conteúdo até (fase posterior, opcional) migrar conteúdo para estrutura no banco.

---

## D. Plano de refatoração em fases

### Fase 0 — Quick wins (1 dia, sem mudança de arquitetura)

1. Tirar `venv/`, docx, pngs de roteiro do git; corrigir `.gitignore`.
2. `base.py`: ler `DB_HOST`/credenciais de env; fallback SQLite só com opt-in explícito + log alto (A4).
3. Trocar 501→500 e adicionar error handler global mínimo (A10).
4. Dedup de `Interventions` no `/edubot/recommendation` (não criar se existir pendente igual do dia) (A8).
5. Registrar interação de "login" e "abriu OVA" no front React (mitiga A2 sem tocar no schema).
6. Corrigir strings PT hardcoded dos players (parte do A12).
7. compose: subnet privada (ex. `172.28.0.0/24`), healthcheck no MySQL, `EDUBOT_SECRET` via env.

*Validação: `docker compose up`, fluxo completo aluno (login→ler→quiz→recomendação) manual.*

### Fase 1 — Tracking confiável (o coração do sistema)

1. Novo contrato `/progress/ova`: `seconds_delta` acumulado no servidor; front manda delta a cada 15s +
   `sendBeacon` no unload (A1).
2. Scroll por conteúdo (elemento do artigo, não window) + regra de `completed` para páginas curtas (A6).
3. Auth em TODAS as rotas restantes; `student_id` sempre do token; `/student/report` protegido por
   dono/tutor (A3).
4. Attempts idempotentes por submissão (uma submissão = um conjunto de attempts; reenvio não duplica) (A7).
5. Tipos de interação enumerados (`login`, `ova_opened`, `quiz_submitted`, `media_progress`...)
   alimentando `dias_sem_acesso` de verdade (A2).

*Validação: roteiro de teste manual + primeiros testes pytest dos serviços de tracking (a Fase 2
formaliza).*

### Fase 2 — Pacote Python + testes (destrava tudo que vem depois)

1. Reorganizar `Back-End` como pacote `edubot/` com imports absolutos; eliminar todos os
   `sys.path.append` (A14).
2. Rotas finas → `services/`; deduplicar competência/inatividade/alternativas na fonte única (A15); matar
   o envelope `[data]` (A16, mudando api.ts junto); validação de payload nas bordas.
3. pytest com SQLite em memória: student_profile, regras do agente, tracking, quiz (A19). Aposentar
   `reportRoute` (substituído por student_context).

*Validação: suíte de testes verde + fluxo manual completo.*

### Fase 3 — IA proativa

1. Gatilhos por evento: pós-quiz e pós-progresso avaliam regras e criam intervenção/alerta
   automaticamente.
2. Scheduler (APScheduler) rodando `/tutor/evaluate` internamente 1×/dia + varredura de inatividade.
3. Dashboard do aluno exibe intervenções não lidas com ação ("Gerar minha trilha de reforço" já liga no
   agente de tool-use existente).
4. LLM real via `llm.py` (já pronto) para redigir mensagens — com fallback determinístico e `lang` do
   aluno; unificar `coach.py` no `llm.py`.

*Validação: teste E2E — errar quiz de propósito → alerta e recomendação aparecem sem clique.*

### Fase 4 — i18n coerente

1. Colunas de tradução no banco (questões, títulos de recursos, competências, nomes de OVA) + API
   servindo por `lang`; remover `contentDict.ts`.
2. Prompts do agente/tutor parametrizados por idioma (mock incluído).
3. Completar `.en.html` dos OVAs restantes (ou antecipar conteúdo estruturado no banco).

*Validação: alternar EN e navegar tudo — zero PT residual fora do conteúdo não traduzido intencionalmente.*

### Fase 5 — Aposentar o legado

1. Remover `files/js` e HTMLs de app (login/painel/iframe/plots/ova_personalizada); manter só
   `html/ovas/*` como conteúdo.
2. Router no React (URLs navegáveis), limpeza de chaves duplicadas de localStorage.

*Validação: build + smoke test completo dos dois papéis (aluno e tutor).*

---

## E. Riscos e trade-offs

| Risco / Trade-off | Mitigação / Decisão |
|---|---|
| **Mudar o contrato de tracking (delta) quebra o leitor legado**, que envia valor absoluto | Sequenciar: Fase 1 muda o contrato e a Fase 5 mata o legado; até lá o legado fica atrás de flag/rota antiga deprecada, ou é aposentado antes (recomendado aposentar cedo). |
| **Refatorar imports (Fase 2) toca todos os arquivos de uma vez** — maior chance de quebra grande | É por isso que a Fase 2 traz os testes junto e vem *depois* do tracking estar certo; migração mecânica + suíte verde antes de mexer em lógica. |
| **Dados históricos de `read_time` ficam ambíguos** (max antigo vs soma nova) | Aceitar reset/nota de corte na demo; se precisar preservar, tratar valor existente como saldo inicial. |
| **LLM real = custo, latência e indisponibilidade** | O desenho já é degradável: regra determinística é o fallback em todos os caminhos (padrão que o código atual acerta). Gatilhos usam regras (grátis); LLM só redige. |
| **Scheduler in-process (APScheduler) vs container separado** | In-process é suficiente para 1 réplica de protótipo; documentar que multi-réplica exigirá mover para worker/cron. |
| **Manter Flask+Peewee vs migrar para FastAPI/SQLAlchemy** | Manter. O ganho de migrar não paga o risco agora; a separação em serviços deixa uma migração futura barata se um dia precisar. |
| **i18n de conteúdo no banco exige retrabalho do seed** | Escopo controlado: 4 OVAs, 32 questões, ~40 recursos. Alternativa (traduzir via LLM em runtime) foi descartada: custo/latência e inconsistência. |
| **Volume MySQL existente não roda migrações novas** (limitação atual do init do Docker) | Cada fase que tocar schema entrega um `migration_NNN.sql` idempotente + instrução no README (padrão que o projeto já usa). |
| **Remover venv/ do git reescreve conveniência local de alguém** | Só remove do índice (`git rm -r --cached`), não do disco. |

---

## Índice de achados por severidade

| ID | Severidade | Resumo |
|---|---|---|
| A1 | Crítico | `read_time` mede a maior sessão, não o total (front zera cronômetro + backend usa `max`) |
| A2 | Crítico | `dias_sem_acesso` só conta eventos de `interactions`, quase não alimentados pelo front novo |
| A3 | Crítico | Rotas sem auth + IDOR (`interaction/register`, `question/answer`, `student/report/<id>`) |
| A4 | Crítico | Fallback silencioso para SQLite vazio quando MySQL não resolve no boot |
| A5 | Crítico | Senhas em texto plano (schema + comparação) |
| A6 | Alto | `perc_scrolled` mede scroll da janela; OVA curto nunca completa |
| A7 | Alto | Attempts duplicáveis por reenvio de quiz, inflando taxa de erro |
| A8 | Alto | GET com efeito colateral cria `Intervention` a cada clique, sem dedup |
| A9 | Alto | Perfil completo (N+1) recalculado a cada checkpoint de mídia |
| A10 | Alto | Tratamento de erro sistemático incorreto (501 em vez de 500, sem captura ampla) |
| A11 | Alto | `venv/` (88% do repo) e outros artefatos indevidos versionados no git |
| A12 | Alto | i18n mista: quiz, respostas da IA, strings hardcoded, dicionário manual de conteúdo |
| A13 | Alto | Agente 100% reativo (sob clique), sem scheduler nem gatilho por evento |
| A14 | Médio | Ausência de pacote Python; imports via `sys.path.append` |
| A15 | Médio | Lógica de domínio triplicada com limiares divergentes |
| A16 | Médio | Convenção de payload `[data]` sem função, herdada do front legado |
| A17 | Médio | Dois front-ends mantidos em paralelo (React + legado jQuery) |
| A18 | Médio | Infra frágil no compose (subnet pública, sem healthcheck, secret default) |
| A19 | Médio | Zero testes automatizados |
| B1 (baixo) | Baixo | SQL cru com f-strings em `data_analysis.py` |
| B2 (baixo) | Baixo | `course_id < 100` como regra mágica de admin |
| B3 (baixo) | Baixo | Sync final de leitura perde até 15s ao fechar aba (falta `sendBeacon`) |
| B4 (baixo) | Baixo | `/question/ova` vaza quais questões qualquer aluno já acertou (sem auth) |
