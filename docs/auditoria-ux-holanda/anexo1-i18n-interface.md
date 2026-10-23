# Anexo 1 — Inventário de i18n da interface (front)

> Gerado pelo Gemini (Antigravity `agy`, Gemini 4 Argon) em 22/10/2026 a partir de `Front-End/react-logic-demo/src/`.
> Conferido por amostragem pelo Claude (7 citações abertas, 7 confirmadas). Usado pelo [PLANO_EXECUCAO_6.md](../../PLANO_EXECUCAO_6.md), seção D.
> As sugestões de EN aqui são **rascunho**: o glossário da seção D.1 do plano prevalece.

## 1. Texto visível em português SEM tradução

| caminho:linha | texto PT (até 60 caracteres) |
| --- | --- |
| Front-End/react-logic-demo/src/components/ErrorBoundary.tsx:36 | Algo deu errado na interface |
| Front-End/react-logic-demo/src/components/ErrorBoundary.tsx:38 | Ocorreu um erro inesperado ao exibir esta tela. Recarregue… |
| Front-End/react-logic-demo/src/components/ErrorBoundary.tsx:44 | Recarregar |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:96 | LEARN · IA |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:172 | LEARN · IA |
| Front-End/react-logic-demo/src/components/Login.tsx:51 | LEARN · IA |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:417 | `{item.tipo}` (intervenção buscada sem `?lang=`) |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:426 | `{item.descricao}` (intervenção buscada sem `?lang=`) |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:117 | `{item.tipo}` (intervenção buscada sem `?lang=`) |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:121 | `{stripCompetencyMarker(item.descricao)}` (sem `?lang=`) |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:312 | `{item.status}` (não iniciada / em desenvolvimento / desenv.) |
| Front-End/react-logic-demo/src/components/PerformanceCharts.tsx:56 | `tipo` no eixo X (texto, video, podcast, atividade) |
| Front-End/react-logic-demo/src/components/PerformanceCharts.tsx:86 | `(${item.status})` no tooltip do gráfico radar |
| Front-End/react-logic-demo/src/components/PerformanceCharts.tsx:143 | `(${item.status})` no tooltip do gráfico de barras |
| Front-End/react-logic-demo/src/components/Report.tsx:80 | `{recommendation.prioridade}` (alta / media / baixa) |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:201 | `· RA {a.ra}` (sigla RA fixa sem `t("RA", "ID")`) |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:276 | `{al.type.replace(/_/g, " ")}` (tipo de alerta em PT) |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:277 | `{al.severity}` (alta / media / baixa) |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:279 | `{al.message}` (`/tutor/alerts` chamado sem `?lang=`) |
| Front-End/react-logic-demo/src/components/TutorStudentDetail.tsx:118 | `RA {est.ra}` (sigla RA fixa sem `t("RA", "ID")`) |
| Front-End/react-logic-demo/src/components/ManagerDashboard.tsx:88 | `s.subject_nome` (`/tutor/overview` chamado sem `?lang=`) |
| Front-End/react-logic-demo/src/components/ManagerDashboard.tsx:257 | `s.ova_nome` (`/tutor/overview` chamado sem `?lang=`) |
| Front-End/react-logic-demo/src/components/ManagerDashboard.tsx:291 | `c.nome` e `c.assunto` (`/tutor/overview` sem `?lang=`) |
| Front-End/react-logic-demo/src/components/ManagerDashboard.tsx:297 | `c.formatos.join(", ")` (video, texto, podcast) |
| Front-End/react-logic-demo/src/components/MasteryHeatmap.tsx:77 | `{sg.nome}` (`/tutor/mastery` chamado sem `?lang=`) |
| Front-End/react-logic-demo/src/components/MasteryHeatmap.tsx:89 | `{c.nome}` (`/tutor/mastery` chamado sem `?lang=`) |
| Front-End/react-logic-demo/src/components/MasteryHeatmap.tsx:106 | `title={cell.status ?? ...}` (status em PT no tooltip) |
| Front-End/react-logic-demo/src/components/ApprovalQueue.tsx:62 | `{item.type}` (tipo de alerta em PT no badge) |
| Front-End/react-logic-demo/src/components/ApprovalQueue.tsx:66 | `{item.proposed_action.mensagem_aluno}` (sem `?lang=`) |
| Front-End/react-logic-demo/src/components/ApprovalQueue.tsx:73 | `{item.proposed_action.justificativa}` (sem `?lang=`) |
| Front-End/react-logic-demo/src/components/AgentKpi.tsx:19 | `🎬 vídeo`, `📖 texto`, `🎧 podcast` (exibidos na linha 78) |
| Front-End/react-logic-demo/src/components/AgentKpi.tsx:55 | `{k.tipo}` (tipo de intervenção em PT) |
| Front-End/react-logic-demo/src/components/Gamification.tsx:266 | `body?.error` (erro 409 do backend vem em PT) |
| Front-End/react-logic-demo/src/hooks/useTutorChat.ts:24 | Saudação inicial fica em PT se trocar idioma após abrir OVA |
| Front-End/react-logic-demo/src/services/api.ts:76 | Sessão expirada — faça login novamente. |

## 2. Inglês pouco natural dentro de t(...)/en:

| caminho:linha | EN atual | EN nativo sugerido | motivo (até 8 palavras) |
| --- | --- | --- | --- |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:28 | Contents | Course Content | "Contents" no plural significa sumário ou recheio |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:31 | Reinforcement | Review & Practice | "Reinforcement" isolado soa a psicologia comportamental |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:33 | Mediating Professor | AI Advisor | Tradução literal de cargo institucional brasileiro |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:39 | Manager View | Coordinator Overview | "Manager" soa corporativo, pouco natural em educação |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:261 | OVA · Contents | Module · Content | Sigla "OVA" não existe em inglês |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:323 | Search OVAs, competencies, sections | Search modules, competencies, sections | "OVAs" é sigla em português |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:385 | consumed | completed | "Consumed" para estudo soa a cota/insumo |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:400 | EduBot notices | EduBot notifications | "Notices" soa a edital ou aviso formal |
| Front-End/react-logic-demo/src/components/ConsentModal.tsx:79 | Pedagogical tracking | Learning progress tracking | "Pedagogical tracking" soa jargão literal traduzido |
| Front-End/react-logic-demo/src/components/ConsentModal.tsx:87 | guide your track | guide your learning path | "Track" isolado para trilha é decalque |
| Front-End/react-logic-demo/src/components/ConsentModal.tsx:95 | AI over your data | AI-powered personalization | "Over your data" traduz "sobre" literalmente |
| Front-End/react-logic-demo/src/components/ConsentModal.tsx:112 |Allow character virtualization with your image/voice in the future. Optional. | Allow creating a custom avatar with your image/voice in the future. Optional. | "Character virtualization" não é expressão idiomática |
| Front-End/react-logic-demo/src/components/OnboardingModal.tsx:49 | consume the module's content | complete the module's content | "Consume content" soa mecânico ao aluno |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:147 | Generate my reinforcement track | Build my practice path | "Reinforcement track" é decalque do português |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:262 | Practical activities | Hands-on activities | "Practical activities" é tradução literal |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:264 | Resources consumed | Completed resources | "Resources consumed" parece uso de memória/servidor |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:304 | Developed competencies | Mastered competencies | "Developed" não expressa domínio já atingido |
| Front-End/react-logic-demo/src/components/Contents.tsx:88 | Content Area | Course Content | "Content Area" é decalque de "Área de Conteúdo" |
| Front-End/react-logic-demo/src/components/Contents.tsx:119 | with the Mediating Professor built in | with the AI Tutor built in | "Mediating Professor" não faz sentido internacionalmente |
| Front-End/react-logic-demo/src/components/Contents.tsx:152 | Open reading | Read article | "Open reading" não é natural em botões |
| Front-End/react-logic-demo/src/components/Exercises.tsx:80 | No practical activities registered for your course's OVAs. | No hands-on activities available for your course modules. | "Registered" para "cadastrada" e sigla "OVAs" |
| Front-End/react-logic-demo/src/components/Quiz.tsx:163 | Server-graded questions — each attempt feeds EduBot. | Server-graded questions — each attempt helps EduBot adapt to you. | "Feeds EduBot" traduz "alimenta" ao pé da letra |
| Front-End/react-logic-demo/src/components/Quiz.tsx:258 | No questions registered for this OVA. | No questions available for this module. | "Registered" e "OVA" soam traduzidos literalmente |
| Front-End/react-logic-demo/src/components/Reforco.tsx:142 | In your format: | Preferred format: | "In your format" é decalque do português |
| Front-End/react-logic-demo/src/components/Reforco.tsx:255 | Reinforcement OVA | Personalized Practice | Combina decalque com sigla em português |
| Front-End/react-logic-demo/src/components/Reforco.tsx:270 | Generate reinforcement OVA | Build practice path | Rótulo de CTA pouco natural para nativos |
| Front-End/react-logic-demo/src/components/Report.tsx:52 | Mediating Professor | AI Learning Advisor | Título principal da tela traduzido literalmente |
| Front-End/react-logic-demo/src/components/PerformanceCoach.tsx:141 | EduBot speaks to you | Feedback from EduBot | "Speaks to you" em título soa artificial |
| Front-End/react-logic-demo/src/components/PerformanceCoach.tsx:179 | EduBot version (AI) | Generate with AI | "EduBot version (AI)" não explica a ação |
| Front-End/react-logic-demo/src/components/PerformanceCharts.tsx:74 | Competency web | Competency radar | Gráfico tipo "teia" chama-se "radar/spider chart" |
| Front-End/react-logic-demo/src/components/CompetencyScores.tsx:82 | How many questions you have got right | Questions answered correctly | "Have got right" é coloquial e prolixo |
| Front-End/react-logic-demo/src/components/SubjectScores.tsx:86 | View per subject — each subject gathers its competencies. | Breakdown by subject — grouping related competencies. | "Gathers its competencies" traduz "reúne" literalmente |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:30 | erring | high error rate | "Erring" é arcaico/poético em inglês moderno |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:33 | low study | low engagement | "Low study" não é colocação idiomática |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:174 | Quiz error | Error rate | Cabeçalho de tabela truncado literalmente |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:175 | No access | Inactive | "No access" sugere bloqueio de permissão |
| Front-End/react-logic-demo/src/components/TutorStudentDetail.tsx:127 | No access | Days inactive | "No access" parece falta de acesso/permissão |
| Front-End/react-logic-demo/src/components/ManagerDashboard.tsx:117 | Class quiz | Class quiz performance | "Class quiz" parece um único teste |
| Front-End/react-logic-demo/src/components/ManagerDashboard.tsx:205 | Video — real consumption | Video — actual watch time | "Real consumption" traduz "consumo real" literalmente |
| Front-End/react-logic-demo/src/components/EngagementPanel.tsx:104 | lines heard/wk | voice clips played/wk | "Lines heard" soa a falas de teatro |

## 3. Formatação dependente de idioma

| caminho:linha | problema (até 12 palavras) |
| --- | --- |
| Front-End/react-logic-demo/src/components/ManagerDashboard.tsx:321 | `toLocaleString("pt-BR")` fixo formata milhar com ponto mesmo em inglês |
| Front-End/react-logic-demo/src/components/Gamification.tsx:304 | Ordinal `{i + 1}º` fixo em português em vez de `1st/2nd/3rd` |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:33 | Plural `t("dias", "days")` fixo mesmo quando `current_days` é 1 |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:253 | Usa `dia(s)` / `day(s)` fixo em vez de pluralizar por número |
| Front-End/react-logic-demo/src/components/Dashboard.tsx:335 | Exibe `item.data` cru sem formatar data conforme o idioma ativo |
| Front-End/react-logic-demo/src/components/Report.tsx:131 | Exibe `item.data` cru no histórico sem formatação de data local |
| Front-End/react-logic-demo/src/components/ReviewsPanel.tsx:60 | Exibe `r.due_date` (`YYYY-MM-DD`) cru sem `toLocaleDateString` por idioma |
| Front-End/react-logic-demo/src/components/Gamification.tsx:189 | `Sequência de ${streak} dias` sem singular quando `streak` vale 1 |
| Front-End/react-logic-demo/src/components/Gamification.tsx:193 | `dias seguidos` fixo no plural em português para `streak === 1` |
| Front-End/react-logic-demo/src/components/TutorStudentDetail.tsx:128 | `${dias} dias` / `${dias} days` no plural fixo para 1 dia |
| Front-End/react-logic-demo/src/components/Quiz.tsx:280 | `result.score.toFixed(1)` usa ponto decimal fixo mesmo em português |
| Front-End/react-logic-demo/src/components/Quiz.tsx:316 | Usa `tentativa(s)` / `attempt(s)` em vez de plural condicional |
| Front-End/react-logic-demo/src/components/TutorPanel.tsx:75 | Usa `novo(s) alerta(s) gerado(s)` / `alert(s)` com `(s)` fixo |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:333 | `${results.length} resultados` / `results` no plural fixo para 1 item |
| Front-End/react-logic-demo/src/components/Sidebar.tsx:400 | `${notifCount} não lidos` no plural fixo quando há 1 aviso |
| Front-End/react-logic-demo/src/components/CompetencyScores.tsx:186 | `${c.total_questoes} questões` / `questions` no plural fixo para 1 questão |
| Front-End/react-logic-demo/src/components/SubjectScores.tsx:139 | `${s.total_questoes} questões` / `questions` no plural fixo para 1 questão |
