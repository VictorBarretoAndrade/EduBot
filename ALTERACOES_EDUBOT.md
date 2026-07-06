# EduBot Track — Relatório completo de alterações e guia de execução

> Data: 2026-06-11/12 · Branch: `feature/edubot-track`
> Análise prévia (stack, bugs, decisão de arquitetura): [ANALISE.md](ANALISE.md)

---

## -1. NOVO: OVA personalizada — agente de tool-use (2026-06-21)

O EduBot passou a ser um **agente** que monta uma **OVA de reforço** para o aluno
a partir do assunto em que ele foi pior. Documentação completa da feature:
[OVA_PERSONALIZADA.md](OVA_PERSONALIZADA.md). Resumo das alterações:

**Arquivos NOVOS**

| Arquivo | O que é |
|---------|---------|
| [Back-End/data/models/personalized_ova.py](Back-End/data/models/personalized_ova.py) | Modelos `PersonalizedOVA` + `PersonalizedOVAItem` (a OVA de reforço e seus itens, que apontam para recursos/questões existentes) |
| [Back-End/edubot_agent/tools.py](Back-End/edubot_agent/tools.py) | 4 tools do agente (JSON-schema Anthropic + funções no banco) + `execute_tool`, com validação de IDs por competência |
| [Back-End/edubot_agent/personalized.py](Back-End/edubot_agent/personalized.py) | Loop de tool-use **real** + `_MockAgentClient` (devolve o envelope de tool-use da Anthropic) + `run_personalized_ova_agent`; esqueleto da LLM real comentado |
| [Back-End/api/routes/personalizedOvaRoute.py](Back-End/api/routes/personalizedOvaRoute.py) | Rotas `POST /edubot/personalized-ova`, `GET /personalized-ova`, `GET /personalized-ova/<id>` |
| [Front-End/files/html/ova_personalizada.html](Front-End/files/html/ova_personalizada.html) + [Front-End/files/js/ova_personalizada.js](Front-End/files/js/ova_personalizada.js) | Página navegável da OVA de reforço (clássico), reaproveitando players + `makeQuestions` |
| [Front-End/react-logic-demo/src/components/Reforco.tsx](Front-End/react-logic-demo/src/components/Reforco.tsx) | Aba **"Reforço"** no app React (gerar + listar + visualizar) |
| [OVA_PERSONALIZADA.md](OVA_PERSONALIZADA.md) · [COMO_ABRIR_FRONTEND_NOVO.md](COMO_ABRIR_FRONTEND_NOVO.md) | Documentação da feature e guia de abertura do frontend novo |

**Arquivos MODIFICADOS**

| Arquivo | O que mudou |
|---------|-------------|
| [Back-End/data/models/resources.py](Back-End/data/models/resources.py) | Novo campo `competency_id` (FK nullable) — classifica o recurso por assunto (banco de remediação) |
| [Back-End/data/models/__init__.py](Back-End/data/models/__init__.py) | Exporta `PersonalizedOVA` e `PersonalizedOVAItem` |
| [Back-End/api/services/student_context.py](Back-End/api/services/student_context.py) | `_competency_statuses` agora traz `tentativas`/`erros`/`taxa_erro` por competência (de `attempts`) — sinal usado para escolher o assunto a remediar |
| [Back-End/edubot_agent/__init__.py](Back-End/edubot_agent/__init__.py) | Exporta `run_personalized_ova_agent` |
| [Back-End/api/api.py](Back-End/api/api.py) | Registra o blueprint `personalized_ova` |
| [Back-End/tools/init_test_db.py](Back-End/tools/init_test_db.py) | Cria as tabelas novas; recursos com `competency_id`; banco de remediação + tentativas que deixam uma competência fraca (dados de teste do agente) |
| [Database/sql/ddl_extra.sql](Database/sql/ddl_extra.sql) | Coluna `resources.competency_id`; tabelas `personalized_ova` e `personalized_ova_item` |
| [Database/sql/dml_extra.sql](Database/sql/dml_extra.sql) | Recursos 1–16 taggeados por competência + banco de remediação (ids 17–28: vídeo + texto por competência) |
| [Front-End/files/js/request.js](Front-End/files/js/request.js) | `createPersonalizedOVA`, `listPersonalizedOVAs`, `getPersonalizedOVA` |
| [Front-End/files/js/painel.js](Front-End/files/js/painel.js) + [painel.html](Front-End/files/html/painel.html) | Botão "Gerar OVA de reforço" + lista das OVAs de reforço |
| [Front-End/react-logic-demo/src/services/api.ts](Front-End/react-logic-demo/src/services/api.ts) | Tipos + funções `createPersonalizedOVA`/`listPersonalizedOVAs`/`getPersonalizedOVA` |
| [Front-End/react-logic-demo/src/App.tsx](Front-End/react-logic-demo/src/App.tsx) + [Sidebar.tsx](Front-End/react-logic-demo/src/components/Sidebar.tsx) | View e item de navegação "Reforço" |
| [README.md](README.md) | Endpoints novos + descrição da feature |

**Endpoints novos**: `POST /edubot/personalized-ova`, `GET /personalized-ova`,
`GET /personalized-ova/<id>` (todos `@require_auth`).

**Verificação**: smoke do agente (identificou a competência fraca, montou a OVA em
5 iterações de tool-use) + smoke HTTP (401/201/conteúdo/sem gabarito/404);
`compileall` OK. React revisado por tipos (build roda no container).

---

## 0. NOVO frontend React integrado (12/06)

O repositório continha um **segundo frontend** em `Front-End/react-logic-demo/`
("Adapta Learn IA", React + Vite + Tailwind, criado no Lovable). Ele só rodava
em máquinas com Node instalado (`npm run dev`) e era um demo isolado: dados
fictícios de "Lógica de Programação" salvos apenas no localStorage, sem login
e sem backend.

O que foi feito:

- **Integração completa com o backend** (mantendo o visual Lovable):
  - `src/services/api.ts` — cliente da API com token Bearer; sessão
    compartilhada com o frontend clássico (mesma origem/localStorage)
  - `src/components/Login.tsx` — login real por RA/senha
  - `Dashboard`/`Evolution` — métricas e competências reais de `GET /student/me`
  - `Contents.tsx` — recursos reais dos OVAs: players de vídeo (YouTube/arquivo)
    e podcast em React (`src/components/players/`), atividades com conclusão, e
    botão que abre o leitor clássico (`iframe.html`) para o texto interativo
  - `Quiz.tsx` — questões reais de `POST /question/ova`, corrigidas pelo
    SERVIDOR via `POST /question/answer` (tentativas alimentam o EduBot)
  - `Report.tsx` (Tutor IA) — recomendação real de `GET /edubot/recommendation`
    + histórico de intervenções
  - Removidos os arquivos do demo (learningData, storage, analytics, report)
- **Build sem Node na máquina**: novo serviço `ova_react_build` no
  `compose.yaml` (container `node:20-alpine` roda `npm install && vite build`
  e emite em `Front-End/files/app/`, servido pelo Apache). O `docker compose up`
  já faz tudo.
- **Bugs corrigidos nessa rodada**: `vite.config.ts` registrava o plugin sem
  invocá-lo (`plugins: [react]` → `react()`); modelos `OVAProgress`/
  `ResourceProgress` apontavam para nomes de tabela errados no MySQL
  (`ovaprogress` vs `ova_progress`) — só funcionava no fallback SQLite.

**Acesso:** `http://localhost:8010/app/` (link "✨ Nova interface" na tela de
login clássica). O frontend antigo continua em `/html/login.html`.

---

## 1. Passo a passo para abrir o projeto

### Opção A — Docker (fluxo completo, recomendado)

**Pré-requisito:** Docker Desktop instalado e rodando.

```powershell
cd OVA-Rastreamento
docker compose up --build
```

1. Aguarde os 3 containers subirem (`ova_db`, `ova_back_end`, `ova_front_end`).
2. Acesse **http://localhost:8010/html/login.html**
3. Faça login:

| Perfil | RA | Senha |
|--------|----|-------|
| Aluno  | 1  | 1     |
| Admin  | 4  | 4     |

4. Como **aluno**: escolha um OVA → leia/role a página, assista aos vídeos, ouça o
   podcast, marque a atividade prática, responda o quiz (tudo é rastreado).
5. Acesse o **painel do aluno**: http://localhost:8010/html/painel.html
   (também pelo botão verde na tela de escolha de OVA ou pelo menu ☰ → "Painel"
   dentro do OVA). Clique em **"Pedir nova recomendação"** para acionar o EduBot.
6. Dashboards antigos (plots): http://localhost:8010/html/plots.html

Para parar: `docker compose down`

> ⚠️ **Se você já tinha um volume MySQL antigo** (rodou `docker compose up` antes
> destas mudanças), as tabelas novas não existem nele. Aplique as migrações:
>
> ```powershell
> docker compose exec -T ova_mysql sh -c "mysql -uroot -pPassword-1 ova_db < /docker-entrypoint-initdb.d/ddl_extra.sql"
> docker compose exec -T ova_mysql sh -c "mysql -uroot -pPassword-1 ova_db < /docker-entrypoint-initdb.d/dml_extra.sql"
> docker compose restart ova_flask
> ```
>
> Em um volume **novo** (primeira execução ou após `docker compose down -v`),
> os scripts rodam automaticamente na inicialização do MySQL — nada a fazer.

### Opção B — Backend local sem Docker (teste rápido da API)

```powershell
cd Back-End
pip install -r requirements.txt
python tools/init_test_db.py     # cria dev_ova.db (SQLite) com dados de exemplo
python api/api.py                # API em http://127.0.0.1:8090
```

Login de teste: RA `1` / senha `1`. Exemplo de chamada:

```powershell
# 1. Login (devolve o token)
Invoke-RestMethod -Uri http://127.0.0.1:8090/login -Method POST -ContentType "application/json" -Body '[{"ra":"1","password":"1"}]'

# 2. Use o token nas rotas protegidas
Invoke-RestMethod -Uri http://127.0.0.1:8090/student/me -Headers @{ Authorization = "Bearer <TOKEN>" }
Invoke-RestMethod -Uri http://127.0.0.1:8090/edubot/recommendation -Headers @{ Authorization = "Bearer <TOKEN>" }
```

### Variável de ambiente

| Variável | Default | Uso |
|----------|---------|-----|
| `EDUBOT_SECRET` | `dev-secret-change-me` | Segredo que assina o token de sessão (`api/auth.py`). **Defina em produção.** |

---

## 2. Arquivos NOVOS

| Arquivo | O que é |
|---------|---------|
| [ANALISE.md](ANALISE.md) | Passo 1 e 2: mapeamento da stack, bugs B1–B10 e justificativa da abordagem |
| [Back-End/api/auth.py](Back-End/api/auth.py) | (4.2) Token HMAC assinado, `verify_token`, decorator `require_auth` (aluno logado em `g.student`) |
| [Back-End/api/services/student_context.py](Back-End/api/services/student_context.py) | (4.2) Monta o perfil completo do aluno: consumo por OVA/tipo, competências, inatividade, taxa de erro, formato preferido |
| [Back-End/api/routes/progressRoute.py](Back-End/api/routes/progressRoute.py) | (4.1) `GET /ova/<id>/resources`, `POST /progress/ova`, `POST /progress/resource` — persistência do rastreamento |
| [Back-End/api/routes/edubotRoute.py](Back-End/api/routes/edubotRoute.py) | (4.3) `GET /edubot/recommendation` — perfil → agente → grava em `interventions` |
| [Back-End/edubot_agent/](Back-End/edubot_agent/) (`__init__.py`, `prompt.py`, `agent.py`) | (4.3) Agente isolado: prompt do Claude Sonnet/Bedrock **já escrito e parametrizado** com as 6 regras; cliente Bedrock **mockado** no formato real da API (trocar pelo boto3 quando for conectar — exemplo comentado em `agent.py`) |
| [Back-End/data/models/resource_progress.py](Back-End/data/models/resource_progress.py) | (4.1) Consumo por aluno×recurso: `perc_consumed`, `seconds_consumed`, `completed` |
| [Database/sql/dml_extra.sql](Database/sql/dml_extra.sql) | (4.1) Seed dos 16 recursos dos 3 OVAs (texto, vídeo, podcast, quiz, atividade) |
| [Front-End/files/js/components/video-player.js](Front-End/files/js/components/video-player.js) | (4.1) Player de vídeo separado: recebe qualquer URL (YouTube ou arquivo), rastreia % assistido em checkpoints de 10% |
| [Front-End/files/js/components/audio-player.js](Front-End/files/js/components/audio-player.js) | (4.1) Player de áudio/podcast separado: rastreia tempo real de escuta e conclusão |
| [Front-End/files/html/painel.html](Front-End/files/html/painel.html) + [Front-End/files/js/painel.js](Front-End/files/js/painel.js) | (4.4) Painel do aluno: recursos consumidos por OVA, status das competências, última recomendação do EduBot + botão de nova recomendação |

## 3. Arquivos MODIFICADOS

| Arquivo | O que mudou |
|---------|-------------|
| [Back-End/api/api.py](Back-End/api/api.py) | Registro dos blueprints `progress` e `edubot` |
| [Back-End/api/routes/loginRoute.py](Back-End/api/routes/loginRoute.py) | (4.2) `/login` passa a devolver o campo `token` |
| [Back-End/api/routes/studentRoute.py](Back-End/api/routes/studentRoute.py) | (4.2) Novo `GET /student/me` (perfil completo, autenticado) |
| [Back-End/api/routes/questionRoute.py](Back-End/api/routes/questionRoute.py) | (B5/B9) Correção do quiz movida para o servidor: gabarito não é mais enviado ao navegador; toda tentativa (certa/errada) é gravada em `attempts`; tolera JSONField como string no SQLite |
| [Back-End/api/routes/plotRoute.py](Back-End/api/routes/plotRoute.py) | (B1) `and` → `&` no filtro Peewee (o filtro de aluno era ignorado); (B7) imports movidos para depois do setup de `sys.path` |
| [Back-End/api/routes/interactionRoute.py](Back-End/api/routes/interactionRoute.py) | (B8) Valida `student`/`ova` antes de criar (evita FK nula); data em ISO 8601 |
| [Back-End/plots/data_analysis.py](Back-End/plots/data_analysis.py) | (B2) IDs coagidos a `int` antes da interpolação — elimina SQL injection |
| [Back-End/data/models/resources.py](Back-End/data/models/resources.py) | (4.1) Novos campos `resource_url`, `media_type`, `duration_seconds` |
| [Back-End/data/models/__init__.py](Back-End/data/models/__init__.py) | Exporta `ResourceProgress` |
| [Back-End/tools/init_test_db.py](Back-End/tools/init_test_db.py) | Seed local atualizado (offerings, recursos com URL, resource_progress) |
| [Database/sql/ddl_extra.sql](Database/sql/ddl_extra.sql) | Colunas novas em `resources`, tabela `resource_progress`, uniques de upsert |
| [Front-End/files/js/request.js](Front-End/files/js/request.js) | (4.2) Header `Authorization: Bearer` automático; novas funções `getOVAResources`, `saveOVAProgress`, `saveResourceProgress`, `getMe`, `getEdubotRecommendation` |
| [Front-End/files/js/login.js](Front-End/files/js/login.js) | (4.2) Guarda o token no localStorage |
| [Front-End/files/js/ova.js](Front-End/files/js/ova.js) | (B4) Chaves de progresso por OVA (`read_time_<id>`); sincroniza `ova_progress` a cada 15s; renderiza vídeos/podcasts/atividades do banco com os novos players |
| [Front-End/files/js/make.js](Front-End/files/js/make.js) | (B5) Envia a alternativa escolhida ao backend e usa o `is_correct` da resposta (gabarito fora do DOM) |
| [Front-End/files/js/iframe.js](Front-End/files/js/iframe.js) | (B3) Removida injeção do player legado e código morto |
| [Front-End/files/html/login.html](Front-End/files/html/login.html) | (B6) Aspa sobrando removida; botão de acesso ao painel |
| [Front-End/files/html/iframe.html](Front-End/files/html/iframe.html) | Link "Painel" no menu ☰ |
| [Front-End/files/html/ovas/*.html](Front-End/files/html/ovas/) (3 arquivos) | Iframes de YouTube hardcoded removidos (nos OVAs de Cálculo eram os vídeos de Computação Quântica copiados por engano); a seção "Recursos Adicionais" agora é preenchida pelo banco |
| [README.md](README.md) | Instruções de execução, endpoints novos e teste local |

## 4. Arquivo REMOVIDO

| Arquivo | Motivo |
|---------|--------|
| `Front-End/files/js/video-player.js` | (B3) Misturava segundos com percentual nos checkpoints e só suportava iframes YouTube hardcoded. Substituído pelos componentes em `js/components/` |

## 5. Endpoints novos da API

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| GET  | `/ova/<id>/resources`    | ✔ | Recursos do OVA + progresso do aluno logado |
| POST | `/progress/ova`          | ✔ | Upsert de `read_time`/`perc_scrolled`/`completed` |
| POST | `/progress/resource`     | ✔ | Upsert de consumo de um recurso (vídeo %, podcast s, atividade) |
| GET  | `/student/me`            | ✔ | Perfil completo do aluno logado (contexto p/ o EduBot) |
| GET  | `/edubot/recommendation` | ✔ | Recomendação do agente (mock Bedrock) + persistência em `interventions` |

Mudança de contrato em rota existente: `POST /question/answer` agora recebe
`{student_id, question_id, selected}` e responde `{"is_correct": bool}`
(antes o cliente enviava `is_correct` calculado no navegador).

## 6. O que foi verificado

- `python -m py_compile` em todo o backend: OK.
- Smoke test end-to-end com SQLite local: login com token → `401` sem token →
  gravação de progresso de OVA e de recurso → quiz corrigido no servidor sem expor
  gabarito → tentativa de SQL injection bloqueada → `/student/me` com perfil completo →
  `/edubot/recommendation` aplicou corretamente a regra 3 (taxa de erro > 50%) e
  gravou no histórico de intervenções.

## 7. Pendências conhecidas (decisões de projeto, não defeitos)

- **Bedrock real não conectado** — trocar `BedrockClientMock` por boto3
  (`bedrock-runtime.invoke_model`); exemplo pronto comentado em
  [Back-End/edubot_agent/agent.py](Back-End/edubot_agent/agent.py).
- **Hospedagem de mídia em aberto** — URLs de podcast no seed são placeholders
  (SoundHelix); basta atualizar `resources.resource_url`/`media_type` quando definir
  S3/local/Spotify.
- Senhas seguem em texto puro no banco (herdado do seed original de 500 alunos);
  hashing exigiria migrar o `dml.sql`.
