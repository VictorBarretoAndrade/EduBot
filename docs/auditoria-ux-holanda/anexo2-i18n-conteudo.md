# Anexo 2 — Inventário de i18n do conteúdo e do backend

> Gerado pelo Gemini (Antigravity `agy`, Gemini 4 Argon) em 22/10/2026 a partir dos seeds SQL e de `Back-End/edubot/`.
> Conferido por amostragem pelo Claude (6 citações abertas, 6 confirmadas). Usado pelo [PLANO_EXECUCAO_6.md](../../PLANO_EXECUCAO_6.md), seção D.

## 1. Conteúdo do banco e cobertura EN

| tabela.coluna PT | coluna EN (nome ou "não existe") | linhas com PT | linhas com EN preenchido | onde o EN é populado (caminho:linha) |
| --- | --- | --- | --- | --- |
| `courses.course_name` | não existe (`Database/sql/ddl.sql:3`) | 1 (`Database/sql/dml.sql:5`) | 0 | — |
| `course_subjects.subject_name` | não existe (`Database/sql/ddl.sql:8`) | 3 (`Database/sql/dml.sql:9-10`, `Database/sql/dml_extra.sql:69`) | 0 | — |
| `ovas.ova_name` | `ova_name_en` (`Database/sql/migration_001_i18n.sql:22`) | 4 (`Database/sql/dml.sql:533-535`, `Database/sql/dml_extra.sql:75`) | 4 | `Database/sql/migration_001_i18n.sql:54-57` |
| `competencies.competency_description` | `competency_description_en` (`Database/sql/migration_001_i18n.sql:28`) | 9 (`Database/sql/dml.sql:524-529`, `Database/sql/dml_extra.sql:78-80`) | 9 | `Database/sql/migration_001_i18n.sql:62-70` |
| `questions.statement` | `statement_en` (`Database/sql/migration_001_i18n.sql:40`) | 38 (`Database/sql/dml.sql:539-773`, `Database/sql/dml_extra.sql:83-106`, `Database/sql/migration_023_competencies_7_8_9_questions.sql:19-119`) | 38 | `Database/sql/migration_001_i18n.sql:119-307`, `Database/sql/migration_023_competencies_7_8_9_questions.sql:19-119` |
| `questions.alternatives` | `alternatives_en` (`Database/sql/migration_001_i18n.sql:46`) | 38 (`Database/sql/dml.sql:540-773`, `Database/sql/dml_extra.sql:84-106`, `Database/sql/migration_023_competencies_7_8_9_questions.sql:19-119`) | 38 | `Database/sql/migration_001_i18n.sql:119-307`, `Database/sql/migration_023_competencies_7_8_9_questions.sql:19-119` |
| `resources.resource_title` | `resource_title_en` (`Database/sql/migration_001_i18n.sql:34`) | 39 (`Database/sql/dml_extra.sql:18-35`, `Database/sql/dml_extra.sql:45-61`, `Database/sql/dml_extra.sql:112-123`) | 39 | `Database/sql/migration_001_i18n.sql:75-113` |
| `resources.resource_url` | não existe (`Database/sql/ddl_extra.sql:45`) | 7 URLs em PT de 26 não nulas (`Database/sql/dml_extra.sql:46,55,58,61,119,121,123`) | 0 | — |
| `interventions.description` | não existe (`Database/sql/ddl_extra.sql:31`) | 0 no seed (gerado em runtime) | 0 no seed | `Back-End/edubot/services/proactivity.py:142-161` (grava na mesma coluna conforme `lang`) |
| `alerts.message` | não existe (`Database/sql/ddl_extra.sql:95`) | 0 no seed (gerado em runtime) | 0 no seed | `Back-End/edubot/services/proactivity.py:178` (usa `rec['titulo']` do disparo) |
| `personalized_ova.title` / `message` / `rationale` | não existe (`Database/sql/ddl_extra.sql:77-79`) | 0 no seed (gerado em runtime) | 0 no seed | — |
| `student_achievements.achievement_id` (catálogo em código) | tupla `(pt, en)` em código (`Database/sql/migration_015_gamification.sql:51`) | 8 conquistas + 5 títulos | 8 conquistas + 5 títulos | `Back-End/edubot/services/gamification.py:51-57`, `Back-End/edubot/services/gamification.py:309-326` |
| `weekly_goals.kind` (catálogo em código) | tupla `(pt, en)` em código (`Database/sql/migration_017_weekly_goals.sql:20`) | 3 tipos | 3 tipos | `Back-End/edubot/services/goals.py:20-24` |

## 2. Textos gerados pelo backend

| texto | onde é gerado (caminho:linha) | respeita o idioma pedido? (sim/não/parcial) | como sabe (até 10 palavras) |
| --- | --- | --- | --- |
| Título da recomendação (`titulo`) | `Back-End/edubot/agent/agent.py:48,75,103,131,160,185`, `Back-End/edubot/agent/prompt.py:49,56,77` | sim | Usa `T(pt, en)` no mock e `{response_language}` no prompt. |
| Mensagem da recomendação (`mensagem_aluno`) | `Back-End/edubot/agent/agent.py:49,77,105,133,161,187`, `Back-End/edubot/agent/prompt.py:50,56,77` | parcial | Traduz via `T(pt, en)`, mas Regra 6 injeta `formato` PT. |
| Ações da recomendação (`acoes`) | `Back-End/edubot/agent/agent.py:56,84,112,140,166,194`, `Back-End/edubot/agent/prompt.py:51,56,77` | parcial | Traduz via `T(pt, en)`, mas Regra 6 injeta `formato` PT. |
| Justificativa da recomendação (`justificativa`) | `Back-End/edubot/agent/agent.py:65,93,121,149,175,201`, `Back-End/edubot/agent/prompt.py:53,57` | não | Texto fixo em português no mock e no system prompt. |
| Descrição de intervenção da avaliação (`interventions.description`) | `Back-End/edubot/services/proactivity.py:142-161`, `Back-End/edubot/services/proactivity.py:365` | parcial | Respeita `lang` no evento, mas sweep usa default `"pt"`. |
| Descrição de intervenção de revisão (`revisao_espacada`) | `Back-End/edubot/services/proactivity.py:273-279` | não | String fixa em PT e busca apenas `competency_description`. |
| Descrição de intervenção de meta (`meta_semanal`) | `Back-End/edubot/services/proactivity.py:320-323` | não | Texto literal fixo em português na criação da intervenção. |
| Mensagem de alerta ao professor (`alerts.message`) | `Back-End/edubot/services/proactivity.py:178` | parcial | Concatena `rec['titulo']` no `lang` da avaliação que o disparou. |
| Nome de conquista (`achievements[].nome`) | `Back-End/edubot/services/gamification.py:309-326,355-364` | sim | Seleciona `en if lang == "en" else pt` no catálogo. |
| Título de conquista do aluno (`available_titles` / `title`) | `Back-End/edubot/services/gamification.py:51-57,440-448,493-498` | sim | Resolve ID via `_title_id_from_label` e retorna rótulo por `lang`. |
| Título de meta semanal (`goals_state[].titulo`) | `Back-End/edubot/services/goals.py:20-24,112-125` | sim | Formata template `(pt, en)` de `GOAL_KINDS` conforme `lang`. |

## 3. Lacunas

1. Nome do curso (`courses.course_name`) não tem coluna `course_name_en` (`Database/sql/ddl.sql:3`, `Database/sql/dml.sql:5`).
2. Nomes das 3 disciplinas (`course_subjects.subject_name`) não têm coluna `subject_name_en` (`Database/sql/ddl.sql:8`, `Database/sql/dml.sql:9-10`, `Database/sql/dml_extra.sql:69`).
3. Intervenção `revisao_espacada` é gravada com frase fixa em PT e usa `competency_description` em vez de `competency_description_en` (`Back-End/edubot/services/proactivity.py:273-279`).
4. Intervenção `meta_semanal` (nudge de quinta-feira) tem descrição fixa em PT (`Back-End/edubot/services/proactivity.py:320-323`).
5. A varredura da turma (`run_class_evaluation`) chama `evaluate_student(student)` sem `lang`, gerando intervenções em PT por padrão (`Back-End/edubot/services/proactivity.py:91`, `Back-End/edubot/services/proactivity.py:365`).
6. A tabela `interventions` guarda o texto já renderizado em `description` (sem coluna `description_en`), mantendo em PT intervenções criadas antes da troca de idioma (`Database/sql/ddl_extra.sql:31`, `Back-End/edubot/services/proactivity.py:159-161`).
7. Na Regra 6 do mock, o valor bruto de `formato` (ex.: `"texto"`) entra sem tradução nas frases em inglês de `mensagem_aluno` e `acoes` (`Back-End/edubot/agent/agent.py:181,192,196`).
8. O campo `justificativa` da recomendação é gerado sempre em português tanto no prompt quanto no mock (`Back-End/edubot/agent/prompt.py:53,57`, `Back-End/edubot/agent/agent.py:65,93,121,149,175,201`).
9. A tabela `alerts` não possui coluna EN para `message` e grava o título no idioma da requisição do aluno ou do sweep (`Database/sql/ddl_extra.sql:95`, `Back-End/edubot/services/proactivity.py:176-180`).
10. Recursos externos de leitura (`resources.resource_url`) apontam para páginas em português sem coluna `resource_url_en` (`Database/sql/ddl_extra.sql:45`, `Database/sql/dml_extra.sql:46,55,58,61,119,121,123`).
