# EduBot Track — Passo 1: Mapeamento do código e Passo 2: Decisão de abordagem

> Documento gerado antes de qualquer alteração, conforme solicitado.
> Data: 2026-06-11

---

## 1. Stack utilizada

| Camada | Tecnologia | Observações |
|--------|-----------|-------------|
| Frontend | HTML5 estático + Bootstrap 5.3 + jQuery 3.7 + Plotly 2.31, servido por Apache (porta 8010) | Sem framework SPA. Páginas: `login.html`, `iframe.html` (player de OVA), `plots.html` |
| Backend | Python 3.10 + Flask + Flask-CORS + Peewee ORM (porta 5010→8090) | Blueprints por domínio em `Back-End/api/routes/` |
| Banco | MySQL 8.4 (porta 3310) com fallback SQLite (`dev_ova.db`) para dev local | DDL/DML em `Database/sql/`, executados no init do container |
| Infra | Docker Compose, 3 containers em rede bridge | `compose.yaml` |
| Extra | `Front-End/react-logic-demo/` — protótipo React/Vite/Tailwind **isolado** (não integrado; usa só localStorage) | Serve apenas como referência de UX de dashboard |

## 2. Como os OVAs estão estruturados hoje

- Cada OVA é um **HTML estático** em `Front-End/files/html/ovas/` (3 ativos: quantum_computing, calculus, calculus2), carregado dentro de um `<iframe>` por `iframe.html`.
- `iframe.js` injeta dinamicamente `ova.js` (rastreamento) e `video-player.js` (YouTube API) dentro do iframe.
- A tabela `ovas` guarda `ova_name`, `link` (nome do arquivo HTML), `num_interactions`, `subject_id`.
- A tabela `resources` (criada numa iteração anterior) tem apenas `resource_type` e `resource_title` — **sem URL nem tipo de mídia**, e **nunca é populada nem consultada** por nenhuma rota.
- Recursos dentro do OVA hoje: texto (seções com scroll), acordeões, carrosséis, quiz (questões vindas da API) e 2 vídeos **YouTube hardcoded** no HTML. **Não existe suporte a podcast/áudio nem a atividade prática.**
- Há ~80 OVAs gerados por template em `ovas-generation/` (não usados pela aplicação).

## 3. Como o rastreamento está implementado

| Dado | Rastreado? | Persistido? | Onde |
|------|-----------|-------------|------|
| Acesso/cliques (acordeão, carrossel, quiz, checkpoints de scroll) | Sim | Sim | `interactions` (texto livre em `student_action`) |
| Tempo de leitura (`read_time`) | Sim (JS) | **Não** — fica só no localStorage | `ova.js` |
| % de scroll (`perc_scrolled`) | Sim (JS) | **Não** — fica só no localStorage | `ova.js` |
| % de vídeo assistido | Parcial (checkpoints viram texto em `interactions`) | Não estruturado | `video-player.js` |
| Tempo de escuta de podcast | **Inexistente** | — | — |
| Respostas corretas | Sim | Sim | `answers` |
| Tentativas erradas | **Não** | Não — tabela `attempts` existe mas nenhuma rota grava nela | — |
| Progresso por OVA | Não | Tabela `ova_progress` existe mas **nenhuma rota grava/lê** | — |

Conclusão: as tabelas novas (`ova_progress`, `attempts`, `resources`, `interventions`) foram criadas numa iteração anterior, mas **o pipeline frontend → backend → banco nunca foi ligado**.

## 4. Como a autenticação está feita (incompleta)

- `POST /login` compara RA + senha **em texto puro** e devolve `student_id`, `course_id`, `is_admin`.
- O frontend guarda tudo em `localStorage` (`logged`, `student_id`, ...). **Não há token nem sessão**: qualquer requisição subsequente é anônima e os endpoints confiam no `student_id` enviado pelo cliente.
- Nenhum endpoint é protegido — qualquer um pode consultar dados de qualquer aluno.

## 5. Onde a IA é chamada hoje

- **Em lugar nenhum.** Não há módulo de agente, nem chamada a Bedrock/Claude. Existe apenas a visão descrita em `PROJETO.md` e a tabela `interventions` (vazia, sem rotas).
- `test/aws/main.py` é só um teste de conexão MySQL num EC2 (credenciais hardcoded — não relacionado a IA).

## 6. Bugs e inconsistências identificados

| # | Arquivo | Problema |
|---|---------|----------|
| B1 | `Back-End/api/routes/plotRoute.py` | `where(A and B)` usa `and` do Python em vez de `&` do Peewee → o filtro de `student_id` é **ignorado** na contagem de interações (conta interações de todos os alunos no OVA). |
| B2 | `Back-End/plots/data_analysis.py` | SQL montado com f-string interpolando valores vindos da requisição → **SQL injection**. |
| B3 | `Front-End/files/js/video-player.js` | `generatePoints` compara checkpoints em **percentual** com `_viewed` salvo em **segundos** (`ct`) → checkpoints re-disparam/erram após recarregar. |
| B4 | `Front-End/files/js/ova.js` | `read_time` e `perc_scrolled` salvos em chaves **globais** do localStorage → o progresso de um OVA "vaza" para outro OVA. Além disso `read_time` é sobrescrito com o tempo do checkpoint, não com o tempo real. |
| B5 | `Front-End/files/js/make.js` + `questionRoute.py` | A correção do quiz é feita **no cliente** (`data-correct` no DOM, `is_correct` enviado pelo navegador) → resposta certa exposta no HTML e gravação falsificável. Tentativas erradas nunca são gravadas. |
| B6 | `Front-End/files/html/login.html` linha 9 | Aspa simples sobrando após a tag `<script>` (renderizada na página). |
| B7 | `Back-End/api/routes/plotRoute.py` | Imports de models **antes** do ajuste de `sys.path` — só funciona porque outros routes são importados antes em `api.py` (frágil). |
| B8 | `Back-End/api/routes/interactionRoute.py` | Não valida se `student`/`ova` existem (cria interação com FK nula) e usa data `"%Y/%m/%d"` não-ISO. Exceções não-Peewee (KeyError etc.) viram 500 sem tratamento. |
| B9 | `Back-End/api/routes/questionRoute.py` | `/question/all` e `/question/ova` retornam o gabarito (`answer`) para o cliente. |
| B10 | Geral | Senhas em texto puro no banco; sem sessão/token (tratado no item 4.2 como "autenticação incompleta"). |

## 7. Passo 2 — Decisão de abordagem

**A base atual é aproveitável.** A arquitetura (Flask + Peewee + Compose + frontend estático) é simples, funcional e já tem o esqueleto certo (blueprints por domínio, tabelas de rastreamento criadas). Os problemas são pontuais (bugs acima) e lacunas de integração — não estruturais. Reescrever traria risco e jogaria fora os OVAs/DML existentes.

Decisão: **refatorar em cima da base existente, mantendo o frontend atual como base visual**, com as adições:

1. **Correções** dos bugs B1–B9 (comentadas no código).
2. **Recursos de mídia** (4.1): tabela `resources` ganha `resource_url` + `media_type` + `duration_seconds` (abstração URL — serve para upload próprio ou embed externo); nova tabela `resource_progress` (% assistido / segundos ouvidos / concluído por aluno×recurso); players de vídeo e áudio como **componentes JS separados** que recebem qualquer URL; seção "Recursos Adicionais" dos OVAs passa a ser renderizada a partir do banco.
3. **Autenticação/contexto** (4.2): token HMAC assinado emitido no login (sem dependências novas), decorator `require_auth`, serviço `student_context` que monta o perfil completo do aluno (consumo, competências, inatividade, preferência de formato) e endpoint `GET /student/me`.
4. **Agente** (4.3): pacote `Back-End/edubot_agent/` com prompt parametrizado (6 regras de decisão) e cliente Bedrock **mockado** que devolve a resposta no formato real da API (Claude Sonnet via Bedrock). Recomendações persistidas em `interventions`.
5. **Painel** (4.4): nova página `painel.html` (mesmo visual Bootstrap) com recursos consumidos por OVA, status das competências e última recomendação do EduBot.

O protótipo `react-logic-demo` permanece intocado como referência de UX.
