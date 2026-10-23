# EduBot — instruções para agentes de IA

Lido automaticamente pelo Antigravity (`agy`/IDE) e importado pelo `CLAUDE.md`
(Claude Code). Vale para qualquer agente que trabalhe neste repositório.

## O que é

Plataforma de aprendizagem do SENAI CIMATEC que **mede** o que o aluno faz num OVA
(Objeto Virtual de Aprendizagem), **modela** o domínio por competência (BKT com
esquecimento), **decide** com regras determinísticas e **age** (trilha de reforço,
revisão, alerta ao professor). A LLM, quando ligada, decide só *como dizer* e
*o que selecionar*.

**Referência atual: [ARQUITETURA_EDUBOT.md](ARQUITETURA_EDUBOT.md).** Vários `.md`
da raiz estão desatualizados (citam `Back-End/edubot_agent/` e `api/api.py`, que não
existem mais): `README.md`, `ANALISE.md`, `ALTERACOES_EDUBOT.md`, `AUDITORIA_TECNICA.md`,
`COMO_TESTAR_PLATAFORMA.md`, `DADOS_E_AGENTE.md`, `IA_AWS_SETUP.md`,
`OVA_PERSONALIZADA.md`, `REQUISITOS_E_BACKLOG.md`, `TUTOR_AVATAR_VIRTUAL.md`, `PROJETO.md`.
O `LOG_EXECUCAO.md` guarda o *porquê* de cada decisão: busque nele, não leia inteiro.

## Mapa do código

| Pasta | Conteúdo |
|---|---|
| `Back-End/edubot/api/` | Flask: `app.py` (registra os blueprints), `auth.py` (token Bearer, `require_auth`), `apikey.py`, `routes/*Route.py` |
| `Back-End/edubot/services/` | Regras de negócio: `mastery` (BKT), `quiz`, `risk`, `proactivity`, `reinforcement`, `reviews`, `gamification`, `consents`, `decisions`, `student_context` (perfil do aluno)… |
| `Back-End/edubot/agent/` | Agente: `loop.py` (tool-use), `tools.py`, `llm.py` (providers: mock/azure/openai/bedrock/anthropic), `personalized.py`, `coach.py`, `tutor.py`, `redactor.py` |
| `Back-End/edubot/data/models/` | Modelos Peewee (uma tabela por arquivo) |
| `Back-End/tests/` | pytest em SQLite na memória (`conftest.py`); não precisa de Docker |
| `Back-End/tools/` | Scripts (`seed_perfis_demo.py`, `apikey_tool.py`, `init_test_db.py`…) |
| `Database/sql/` | `ddl.sql`, `dml.sql`, `*_extra.sql` e `migration_NNN_*.sql` (rodam só no 1º init do volume MySQL) |
| `Front-End/react-logic-demo/` | SPA React + TypeScript + Vite + Tailwind; rotas por hash (`#/dashboard`, `#/tutor`…); `src/services/api.ts` é o cliente da API |
| `Front-End/files/` | Servido pelo Apache; o build do React vai para `files/app/` (gerado, no `.gitignore`) |
| `integracoes/` | `edubot-tracker.js` (coleta em sites parceiros) e cliente PHP da API pública `/api/v1` |

## Rodar e testar

```bash
docker compose up -d --build        # MySQL 3310, API 5010, Apache 8010
# app: http://localhost:8010/app/   login de demo: senha = RA (RA 2 = tutor, RA 4 = admin)
cd Back-End && python -m pytest     # suíte do backend (SQLite em memória)
cd Front-End/react-logic-demo && npx tsc --noEmit   # checagem de tipos do front
```

- Volume MySQL antigo não roda migrations novas (sintoma: `/student/me` dá 500).
  Recrie com `docker compose down -v` ou aplique `Database/sql/migration_*.sql` (idempotentes).
- A skill `.claude/skills/run/` tem o passo a passo completo (smoke com curl, Playwright).
- A IA vem em **modo mock** por padrão (`EDUBOT_LLM_PROVIDER=mock`): sem custo, determinística.

## Convenções

- **Português** em docs, comentários, mensagens de commit e textos de UI (com versão EN
  via i18n: colunas `*_en` no banco, `src/i18n.tsx` no front).
- Na interface, o produto e a IA se chamam **Engage-Agent** (o código e o repositório
  seguem com o nome interno EduBot). Inglês da interface: **americano**, com o glossário
  do `PLANO_EXECUCAO_6.md` (D.1): módulo → *module*, matéria → *course*, competência →
  *learning outcome*.
- Commits no padrão `tipo(escopo): descrição` em português (ex.: `feat(coleta): ...`).
- Nada pode quebrar em modo mock. Campos novos no contrato da API são **opcionais**
  (telas antigas degradam para o comportamento atual).
- Mudança de schema = nova `Database/sql/migration_NNN_<nome>.sql` **idempotente**,
  numerada em sequência; não edite migrations já publicadas.
- Segurança no backend: o aluno vem do **token**, nunca do payload; correção do quiz
  é server-side; rotas de tutor validam papel e curso.
- Acessibilidade (WCAG) no front: nada só por cor, foco visível, `aria-*` corretos.
- Decisões relevantes vão para `LOG_EXECUCAO.md`.

## Segredos — nunca leia, copie ou comite

`.env`, `Back-End/.env`, `Front-End/react-logic-demo/.env*`,
`integracoes/php/config.local.php`. Use os `.env.example` como referência.

## Trabalho multiagente (Claude Code + Antigravity)

O Claude Code orquestra e é **o único agente que escreve** nos arquivos. Ele delega ao
Antigravity (`agy`) pedidos fechados, escritos num arquivo e rodados em `--mode=plan`:
varreduras, triagem de docs/logs, rascunhos e segunda opinião sobre diffs.

Exceção: pacotes de tradução em volume (ver `PLANO_EXECUCAO_6.md`, seção D.3) rodam com
`--edit` numa branch própria, só nos arquivos que o pedido listar; o Claude revisa o diff.

Quando o Antigravity receber um pedido desses:
- Leia só o que o pedido mandar; não procure outros arquivos.
- Não rode comandos de terminal; use as ferramentas internas de leitura.
- Cite toda afirmação sobre código como `caminho/relativo:linha`, em texto simples.
- Responda curto e exatamente no formato pedido. Não edite arquivos, a menos que o pedido
  liste explicitamente quais arquivos criar ou alterar.
