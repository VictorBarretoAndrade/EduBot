# Plano de Execução 5 — Visibilidade de Métricas (Aluno · Professor · Gestor)

> **Objetivo do usuário:** melhorar a visibilidade das métricas em três frentes:
> 1. **Aluno** — "Minha Performance" mais clara: acertos/erros por competência **e por assunto**.
> 2. **Professor** — poder **escolher um aluno** (clicando na linha da turma) e ver as métricas dele de forma bem visual (gráficos + números brutos), com acertos/erros **por competência e por assunto**.
> 3. **Gestor** — um **dashboard novo** que mostra *tudo que o sistema consegue rastrear*, com números reais agregados.
>
> **Decisões travadas com o usuário (AskUserQuestion):**
> - Entrega: **escrever este plano e depois implementar** (rodando no Opus).
> - **Backend liberado** (endpoint novo por aluno + vínculo competência→disciplina).
> - Professor **clica na linha da turma** → página de detalhe do aluno.
> - **Dashboard novo de gestor** com todas as métricas rastreáveis.

## Princípios (herdados dos Planos 2–4)

- Documentação e commits em **português**.
- **Acessibilidade (WCAG)** mantida: linhas clicáveis viram elementos focáveis com teclado; nada depende só de cor (número + ícone + palavra); textos ≥ 12px; `aria-*` corretos.
- **Comportamento visual preservado** onde já existe; adições seguem o design system (Tailwind `rounded-[8px]`, `text-ink`/`text-muted`/`text-brand`, `shadow-soft`).
- **IA em modo mock nunca quebra** — nada aqui depende de LLM.
- **Degradação segura**: campos novos são **opcionais** no contrato; telas antigas seguem funcionando se o backend não os enviar.
- Cada etapa registrada em `LOG_EXECUCAO.md`.
- Auditoria ao final: releitura crítica → verificação ao vivo → correção → smoke → documentação.

---

## Semântica dos números (já validada no backend)

De `services/student_context.py::_competency_rows`:
- `acertos` = questões **distintas** que o aluno já acertou (tabela `answers`, 1ª correta por questão).
- `erros` = **tentativas** erradas (tabela `attempts`).
- Vale `acertos + erros === tentativas` → a barra proporcional acertos×erros fecha 100% e o aproveitamento é honesto.
- `total_questoes` = todas as questões da competência (inclui não tentadas) → **cobertura**, mostrada à parte.
- `dominio_estimado` (0..1) vem do BKT (`student_mastery`), com degradação para `acertos/total`.
- **Assunto (disciplina):** cada `Competencies` tem `subject_id` → `course_subjects` (`Subjects`). A query de competências **já faz esse JOIN**; só falta expor `subject_id`/`subject_name` na saída. Uma disciplina (assunto) agrega várias competências, então **acertos/erros por assunto = soma** dos das suas competências.

> ⚠️ `Subjects` (`course_subjects`) só tem `subject_name` (PT) — **sem coluna `_en`**. A quebra "por assunto" usa o nome direto (sem tradução), como já acontece no heatmap do tutor.

---

## Etapa 17 — Backend: assunto no perfil + endpoints do tutor/gestor

### 17.1 — Expor o assunto por competência (`student_context._competency_rows`)
- **Arquivo:** `Back-End/edubot/services/student_context.py`.
- No `select` de `_competency_rows`, adicionar `fn.MAX(Subjects.subject_id)` e `fn.MAX(Subjects.subject_name)` (via `MAX` por causa do `ONLY_FULL_GROUP_BY` — mesmo padrão do `p_mastery`; `subject_id` é funcionalmente dependente da competência, então `MAX` é seguro e determinístico).
- Incluir no dict de cada competência: `"subject_id"` e `"subject_nome"`.
- **Custo:** 0 query nova (o JOIN com `Subjects`/`Offerings` já existe). Contrato do perfil ganha 2 campos **opcionais**.

### 17.2 — Atualizar o teste de contrato
- **Arquivo:** `Back-End/tests/test_profile_contract.py` (e afins).
- Garantir que cada item de `competencias` tem as chaves `subject_id` e `subject_nome`. Rodar `python -m pytest` (42 testes em SQLite) — tudo verde.

### 17.3 — Endpoint `GET /tutor/student/<int:student_id>` (detalhe individual)
- **Arquivo:** `Back-End/edubot/api/routes/tutorRoute.py`.
- Fluxo: `@require_auth` → `_is_tutor()` (senão 403) → carrega `Students.get_or_none(student_id)`.
- **Segurança (escopo):** só devolve se o aluno for do **mesmo curso** do tutor (`student.course_id == g.student.course_id`) **e** `role == "aluno"`. Senão `404` (não vaza existência de aluno de outro curso).
- Retorna `build_student_profile(student, lang=get_lang())` — **mesmo shape** de `/student/me`. Reuso total, 0 duplicação de lógica de métrica.

### 17.4 — Endpoint `GET /tutor/overview` (rollup da turma p/ gestor)
- **Arquivo:** `tutorRoute.py`.
- Agrega, sobre os alunos ativos da turma (reusa `_turma_students()` / `active_student_ids()`):
  - **Totais de quiz da turma:** `acertos` (COUNT distinct answers), `erros` (SUM attempts errados), `tentativas`, `taxa_erro` média.
  - **Por assunto (disciplina):** para cada `Subjects` do curso → acertos/erros/tentativas somados + domínio médio (`AVG(student_mastery.p_mastery)`).
  - **Consumo:** média de `perc_scrolled`, total de recursos consumidos por tipo (reaproveita agregações existentes onde der).
  - **Cobertura de rastreamento:** contagem do que existe hoje (interações, progresso de OVA, tentativas, eventos de aprendizado, consentimentos) — alimenta o bloco "o que rastreamos".
  - **Turma:** nº de alunos ativos, em risco (taxa_erro > 0.5 ou alertas), alertas abertos, distribuição de status por competência.
- Tudo em **agregações SQL** (sem N+1); proteger com `MAX_TURMA`.

> **Nota:** parte do dashboard do gestor pode reusar endpoints existentes (`/tutor/turma`, `/tutor/engagement`, `/tutor/mastery`, `/tutor/agent-kpi`). O `/tutor/overview` cobre só o que falta (rollup de acertos/erros **por assunto** no nível da turma).

---

## Etapa 18 — Frontend Aluno: acertos/erros por assunto

### 18.1 — Tipos de API
- **Arquivo:** `Front-End/react-logic-demo/src/services/api.ts`.
- `CompetencyState` ganha `subject_id?: number` e `subject_nome?: string` (opcionais → retrocompatível).

### 18.2 — Componente `SubjectScores`
- **Arquivo novo:** `src/components/SubjectScores.tsx`.
- Recebe `competencias: CompetencyState[]`, **agrupa por `subject_id`** e soma acertos/erros/tentativas por assunto.
- Renderiza, por assunto: nome + total de acertos (✓) e erros (✗) com ícones e palavras + barra proporcional (`aria-hidden`, decorativa) + % de aproveitamento + linha de cobertura ("X de N questões do assunto"). Estado vazio honesto quando o assunto não tem tentativas.
- A11y: ícones+palavras (não só cor), textos ≥ 12px, PT/EN com singular/plural — igual ao `CompetencyScores`.
- Fallback: se nenhuma competência tiver `subject_nome` (backend antigo), o componente **não renderiza** (retorna `null`) — a tela do aluno continua idêntica.

### 18.3 — Integrar no "Meu Desempenho"
- **Arquivo:** `src/components/Evolution.tsx`.
- Renderizar `<SubjectScores competencias={profile.competencias} />` logo acima do `CompetencyScores` (visão macro → micro: primeiro por assunto, depois por competência).

---

## Etapa 19 — Frontend Professor: escolher aluno e ver o detalhe

### 19.1 — API do detalhe
- **Arquivo:** `api.ts`.
- `getTutorStudent(studentId: number)` → `GET /tutor/student/<id>` retornando `StudentProfile`.

### 19.2 — Rota `#/aluno/:id` no App
- **Arquivo:** `src/App.tsx`.
- `parseHash` reconhece `#/aluno/(\d+)` (espelha o padrão de `#/modulo/:id`) → `{ view: "aluno", studentId }`.
- Estado `tutorStudentId`; quando presente **e** o usuário é staff, `renderView` dá precedência a `<TutorStudentDetail studentId onBack={() => history.back()} />`.
- `onBack` volta para `#/tutor` (a turma).

### 19.3 — Componente `TutorStudentDetail`
- **Arquivo novo:** `src/components/TutorStudentDetail.tsx`.
- Busca o perfil via `getTutorStudent(id)` (loading + erro tratados; sr-only "Carregando").
- Cabeçalho: nome + RA + curso + botão "← Voltar para a turma".
- Corpo (visão do professor, **gráficos + números brutos**):
  - **Cards KPI:** dias sem acesso, consumo %, taxa de erro do quiz, atividades pendentes.
  - `<SubjectScores>` (acertos/erros por **assunto**) — reuso da Etapa 18.
  - `<CompetencyScores>` (acertos/erros por **competência**) — reuso da feature já existente.
  - Gráficos: teia de competências + leitura por OVA + consumo por tipo (reuso da lógica do `Evolution`; extrair um bloco de gráficos compartilhável **ou** reusar o `Evolution` passando o perfil do aluno — decidir na implementação sem duplicar Recharts).
- A11y: título com foco ao montar; região `role="status"` para o carregamento.

### 19.4 — Linha da turma clicável
- **Arquivo:** `src/components/TutorPanel.tsx`.
- Cada `<tr>` de aluno vira **clicável** (navega para `#/aluno/:id`). Implementar de forma acessível: a célula do nome é um `<button>`/link com `aria-label="Ver detalhes de {nome}"`; a linha inteira ganha `cursor-pointer` e `hover`. Suporte a teclado (Enter/Espaço) e foco visível.
- Manter a ordenação e os dados atuais intactos.

---

## Etapa 20 — Frontend Gestor: dashboard "tudo que rastreamos"

### 20.1 — API do overview
- **Arquivo:** `api.ts`.
- `getTutorOverview()` → `GET /tutor/overview` + tipos (`TutorOverview`, `SubjectRollup`, etc.).

### 20.2 — Item na Sidebar (staff)
- **Arquivo:** `src/components/Sidebar.tsx`.
- Adicionar `gestorItem = { id: "gestor", pt: "Visão do Gestor", en: "Manager View", icon: BarChart3 }`.
- `itemsFor(role)` inclui `gestorItem` para `tutor`/`admin` (junto do `tutorItem`).
- Incluir `"gestor"` em `KNOWN_VIEWS` no `App.tsx`; `renderView` monta `<ManagerDashboard />` (só staff).

### 20.3 — Componente `ManagerDashboard`
- **Arquivo novo:** `src/components/ManagerDashboard.tsx`.
- Seções:
  1. **KPIs da turma:** alunos ativos, em risco, alertas abertos, consumo médio, taxa de erro média, domínio médio.
  2. **Acertos × erros por assunto (turma):** barras + números brutos (do `/tutor/overview`).
  3. **Distribuição de domínio** por competência/status (reusa `/tutor/mastery` ou os dados do overview).
  4. **Engajamento** (reusa `/tutor/engagement`: DAU/WAU, antes×depois).
  5. **"O que o sistema rastreia":** painel-catálogo listando cada dimensão rastreada (interações, tempo/scroll de OVA, consumo por tipo, tentativas/erros, eventos de aprendizado, consentimentos LGPD, domínio BKT), com o **número real** de registros e se **persiste** — dá aos gerentes a visão do que dá para medir hoje.
- A11y: cada card é uma região com heading; gráficos Recharts com `<Tooltip>`; números sempre em texto (não só no gráfico).

---

## Riscos e mitigação

| Risco | Mitigação |
|------|-----------|
| `ONLY_FULL_GROUP_BY` reclamar de `subject_name` no GROUP BY | Usar `fn.MAX(Subjects.subject_name)` (padrão já usado para `p_mastery`). |
| Tutor acessar aluno de outro curso via `#/aluno/:id` | Endpoint valida `course_id` + `role`; devolve 404 fora de escopo. Front só mostra o link para staff, mas a **segurança é no backend**. |
| Perfil pesado por aluno no overview da turma (500 alunos) | `MAX_TURMA` + agregações SQL puras no `/tutor/overview` (não chama `build_student_profile` por aluno). |
| Quebra de contrato do perfil | Campos novos **opcionais**; teste de contrato atualizado; telas antigas degradam para o comportamento atual. |
| Duplicação de Recharts no detalhe do aluno | Reusar `Evolution`/bloco de gráficos; não copiar componentes. |

## Fora de escopo (decisão futura)
- Tradução EN dos nomes de assunto (exigiria migration `course_subjects.subject_name_en`).
- Exportar relatório do aluno em PDF para o professor.
- Persistir % de vídeo consumido e atividades práticas (ainda não rastreados — aparecem no catálogo como "não rastreado hoje").

---

## Checklist de execução

- [x] **17.1** assunto em `_competency_rows`
- [x] **17.2** teste de contrato atualizado (pytest verde)
- [x] **17.3** `GET /tutor/student/<id>`
- [x] **17.4** `GET /tutor/overview`
- [x] **18.1** `subject_*` em `CompetencyState`
- [x] **18.2** componente `SubjectScores`
- [x] **18.3** `SubjectScores` no `Evolution`
- [x] **19.1** `getTutorStudent`
- [x] **19.2** rota `#/aluno/:id`
- [x] **19.3** `TutorStudentDetail`
- [x] **19.4** linha da turma clicável (acessível)
- [x] **20.1** `getTutorOverview`
- [x] **20.2** `gestorItem` na Sidebar + `KNOWN_VIEWS`
- [x] **20.3** `ManagerDashboard`
- [x] **Auditoria + smoke** (backend curl + Playwright) + documentação no `LOG_EXECUCAO.md`
