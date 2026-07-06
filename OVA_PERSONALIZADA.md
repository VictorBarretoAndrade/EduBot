# OVA Personalizada — Agente EduBot de tool-use

> Documenta a feature que transforma o EduBot em um **agente**: ele diagnostica
> a competência em que o aluno foi pior, consulta um banco de conteúdo
> classificado por assunto e **monta uma OVA de reforço** (vídeos, textos e
> questões) personalizada para aquele aluno.
>
> Complementa: [ANALISE.md](ANALISE.md) (stack/arquitetura),
> [ALTERACOES_EDUBOT.md](ALTERACOES_EDUBOT.md) (lista de arquivos + execução),
> [DADOS_E_AGENTE.md](DADOS_E_AGENTE.md) (dados do aluno e o agente de recomendação).

---

## 1. O que a feature faz

1. O aluno consome OVAs e responde quizzes — cada tentativa (certa/errada) é
   gravada em `attempts`, agora com **erro por competência** no perfil.
2. O EduBot (agente) identifica a **competência mais fraca** (maior taxa de erro
   / menor domínio).
3. Consulta o **banco de conteúdo classificado por competência** (`resources` com
   `competency_id` + `questions` com `competency_id`).
4. **Monta uma OVA de reforço** persistida (`personalized_ova` +
   `personalized_ova_item`), com mensagem ao aluno e justificativa ao professor.
5. O aluno abre essa OVA e a consome como uma normal — reaproveitando os mesmos
   players (vídeo/podcast) e o quiz corrigido no servidor. O consumo realimenta o
   perfil e o próprio EduBot.

---

## 2. Arquitetura — agente de tool-use com cliente mockado

O ponto central: **o loop de tool-use é real e definitivo**; só o "cérebro" (o
modelo) está mockado.

```
POST /edubot/personalized-ova (autenticado)
  └─ build_student_profile(aluno)            # perfil (student_context.py)
       └─ run_personalized_ova_agent(aluno, perfil)   # personalized.py
            ┌─ loop de tool-use (REAL):
            │    cliente.invoke(system, messages, tools)
            │      ├─ stop_reason "tool_use" -> executa a tool no banco
            │      │                            e devolve tool_result
            │      └─ stop_reason "end_turn"  -> fim
            │  cliente HOJE: _MockAgentClient (decide as tools de forma
            │  determinística e devolve o MESMO envelope da Anthropic
            │  Messages API). FUTURO: boto3/anthropic — só troca o cliente.
            └─ criar_ova_personalizada(...)   # tool terminal: grava a OVA
  └─ Interventions.create(type="ova_personalizada", ...)   # histórico
```

As **tools** (em [Back-End/edubot_agent/tools.py](Back-End/edubot_agent/tools.py),
com JSON-schema no formato da Anthropic):

| Tool | O que faz |
|------|-----------|
| `listar_competencias_fracas` | Competências do curso ordenadas da mais fraca para a mais forte (status + taxa de erro por competência) |
| `listar_recursos_remediacao` | Recursos (`resources`) de uma competência — opcionalmente por tipo |
| `listar_questoes_reforco` | Questões de uma competência (sem gabarito) |
| `criar_ova_personalizada` | **Persiste** a OVA (valida que os IDs pertencem à competência-alvo) e retorna o id |

> **Validação de segurança**: `criar_ova_personalizada` só grava recursos/questões
> que existem **e** têm `competency_id` igual à competência-alvo — o modelo não
> consegue inventar IDs nem misturar assuntos. O aluno vem sempre de `g.student`
> (token), nunca do payload.

### Ligar a LLM real (swap-ready)

Em [personalized.py](Back-End/edubot_agent/personalized.py), troque `_client`
(`_MockAgentClient`) por um cliente cujo `.invoke(...)` devolva o envelope da
Messages API com tools (esqueleto comentado no fim do arquivo: Anthropic SDK ou
Bedrock `converse`). O loop, as tools e o parsing **já são os definitivos**.

---

## 3. Modelo de dados

### Mudança: `resources.competency_id`
[Back-End/data/models/resources.py](Back-End/data/models/resources.py) ganhou
`competency_id` (FK nullable). **É o que torna `resources` um banco consultável
por assunto.** Recursos genéricos do OVA (quiz/atividade) ficam com `NULL`.

### Tabelas novas
[Back-End/data/models/personalized_ova.py](Back-End/data/models/personalized_ova.py)

| Tabela | Campos | Descrição |
|--------|--------|-----------|
| `personalized_ova` | `personalized_ova_id`, `student_id`, `target_competency_id`, `title`, `message`, `rationale`, `status`, `created_at` | A OVA de reforço de um aluno |
| `personalized_ova_item` | `item_id`, `personalized_ova_id`, `item_kind` (`resource`/`question`), `resource_id`, `question_id`, `position` | Itens selecionados (apontam para o conteúdo existente, sem duplicar) |

DDL em [Database/sql/ddl_extra.sql](Database/sql/ddl_extra.sql); seed (tag dos
recursos + banco de remediação ids 17–28) em
[Database/sql/dml_extra.sql](Database/sql/dml_extra.sql); espelho dev (SQLite) em
[Back-End/tools/init_test_db.py](Back-End/tools/init_test_db.py).

---

## 4. Endpoints (todos autenticados — `Authorization: Bearer`)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/edubot/personalized-ova` | Roda o agente para o aluno logado; cria a OVA de reforço e a registra em `interventions`. `201` com resumo, ou `422` se não há conteúdo de reforço |
| GET | `/personalized-ova` | Lista as OVAs de reforço do aluno logado |
| GET | `/personalized-ova/<id>` | Conteúdo de uma OVA (recursos com progresso + questões sem gabarito). `404` se não existe ou é de outro aluno |

Rota em
[Back-End/api/routes/personalizedOvaRoute.py](Back-End/api/routes/personalizedOvaRoute.py).
O `GET /personalized-ova/<id>` devolve os recursos no mesmo formato de
`/ova/<id>/resources` e as questões no mesmo formato de `/question/ova`, para o
frontend reaproveitar players e quiz sem adaptação.

---

## 5. Frontend (nos dois)

### React / Lovable (`/app/`)
- Aba **"Reforço"** na barra lateral —
  [src/components/Reforco.tsx](Front-End/react-logic-demo/src/components/Reforco.tsx):
  botão gerar + lista + visualizador (reaproveita `players/VideoPlayer`,
  `players/AudioPlayer` e o padrão de quiz do `Quiz.tsx`).
- Ligações: [App.tsx](Front-End/react-logic-demo/src/App.tsx) (`activeView "reforco"`),
  [Sidebar.tsx](Front-End/react-logic-demo/src/components/Sidebar.tsx) (item novo),
  [api.ts](Front-End/react-logic-demo/src/services/api.ts) (tipos + 3 funções).

### Clássico (`/html/`)
- Botão **"Gerar OVA de reforço"** + lista no
  [painel.html](Front-End/files/html/painel.html) /
  [painel.js](Front-End/files/js/painel.js).
- Página navegável
  [ova_personalizada.html](Front-End/files/html/ova_personalizada.html) +
  [ova_personalizada.js](Front-End/files/js/ova_personalizada.js) (`?id=<id>`),
  reaproveitando os players vanilla e `makeQuestions`.
- Funções novas em [request.js](Front-End/files/js/request.js).

Como abrir o app novo: [COMO_ABRIR_FRONTEND_NOVO.md](COMO_ABRIR_FRONTEND_NOVO.md).

---

## 6. Como cadastrar o conteúdo de remediação

O agente busca **por competência** — todo conteúdo precisa do `competency_id`
do assunto, senão ele não é encontrado. Competências do seed: **1–3 = Quântica**,
**4–6 = Cálculo**.

**Vídeo/texto/podcast** → `resources` (em `dml_extra.sql`):
```sql
insert into resources
(resource_id, ova_id, resource_type, resource_title, resource_url, media_type, duration_seconds, competency_id)
values
(29, 2, "video", "Reforço: regra da cadeia", "https://youtu.be/XXXX", "youtube", NULL, 4);
```
`resource_type`: `video` | `texto` | `podcast` · `media_type`: `youtube` | `upload` | `link`.

**Questão** → `questions` (em `dml.sql`):
```sql
(27, "Qual a derivada de x²?", '{ "alternatives": ["x","2x","x³/3","2"] }', "b", 2, 4);
--                                                                          ^gab ^ova ^competency_id
```

Aplicar em volume MySQL existente: reaplicar `dml_extra.sql`/`dml.sql` via
`docker compose exec` (ver [README.md](README.md)). Em volume novo, roda no init.

> Dica: para o agente ter um assunto fraco para tratar, o aluno precisa de
> desempenho ruim em alguma competência (errar questões daquele `competency_id`).

---

## 7. Verificação realizada

Smoke tests no SQLite de dev (sem alterar o backend de produção):

- **Agente**: identificou a competência fraca ("Conceitos de treino e teste",
  taxa de erro 1.0), buscou os recursos/questões dela e montou a OVA em 5
  iterações de tool-use.
- **HTTP** (Flask test client): `401` sem token · `201` na criação · lista e
  conteúdo corretos · **gabarito não vaza** nas questões · `404` para OVA
  inexistente/de outro aluno.
- `compileall` OK em todo o backend; o app Flask carrega com as 3 rotas
  registradas.

> O React não foi compilado localmente (máquina sem Node — o build roda no
> container `ova_react_build`); foi feita revisão de tipos manual contra `api.ts`.

---

## 8. Limitações / próximos passos

- **LLM real não conectada** (mock determinístico) — por decisão de projeto;
  ponto de troca pronto em `personalized.py`.
- **Cold start**: aluno sem desempenho/recursos taggeados → `422` ("sem conteúdo
  de reforço"). Um fallback (ex.: remediar a competência menos desenvolvida)
  poderia ser adicionado.
- **Sem limite diário** por aluno×competência (sugerido em
  [DADOS_E_AGENTE.md](DADOS_E_AGENTE.md)) — o histórico em `personalized_ova`/
  `interventions` já permite implementar.
- **Cadastro por SQL**: ainda não há tela de admin para cadastrar conteúdo por
  competência pela interface (candidato a próxima iteração).
