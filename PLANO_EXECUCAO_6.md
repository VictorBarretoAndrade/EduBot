# Plano de Execução 6 — Auditoria de UX e reestruturação para a apresentação na Holanda

> **Objetivo:** deixar a plataforma simples de navegar, organizada como no Canvas
> (matéria → módulos), 100% em inglês nativo quando o idioma for EN, e com a IA do
> EduBot fácil de entender, no lugar do confuso "Professor Mediador".
>
> **Entregáveis:** (A) Diagnóstico de UX · (B) Nova arquitetura de páginas e fluxos ·
> (C) EduBot no lugar do Professor Mediador · (D) Matriz de tradução do conteúdo.
> Seguem a ordem de execução e as decisões que dependem de você.

## Como ler este plano

**Método.** A auditoria foi feita lendo o código do front (React), o HTML dos OVAs e os
seeds SQL, com citação `arquivo:linha`. **Não** foi feita navegando na plataforma: o
Docker estava desligado. A Fase 0 abre com uma rodada de screenshots PT/EN (skill `run`)
para confirmar o diagnóstico visual antes de mexer no código.

**Quem executa cada tarefa** (para economizar tokens do Claude):

| Marca | Quem | Para quê |
|---|---|---|
| 🤖 | **Claude** (Claude Code) | Decide, escreve código, integra, revisa e testa. |
| ♊ | **Gemini** (Antigravity `agy`, cota do Google AI Pro) | Volume: traduções, varreduras, rascunhos de texto. O Claude confere por amostragem. |
| 👤 | **Pessoa** (você / falante nativo) | Decisões de produto e validação final do inglês. |

**Prioridade:** 🔴 bloqueia a apresentação · 🟠 importante · ⚪ desejável.
**Esforço:** P (até meio dia) · M (1–2 dias) · G (3+ dias).

**Anexos gerados pelo Gemini** (conferidos por amostragem):
[Anexo 1 — i18n da interface](docs/auditoria-ux-holanda/anexo1-i18n-interface.md) ·
[Anexo 2 — i18n do conteúdo e do backend](docs/auditoria-ux-holanda/anexo2-i18n-conteudo.md).

---

## Resumo executivo — os 6 problemas que mais pesam na apresentação

| # | Problema | Onde | Prioridade |
|---|---|---|---|
| 1 | **Os OVAs "Cálculo" e "Cálculo 2" mostram o texto de Computação Quântica** (só o título do topo muda), mas o quiz deles cobra limites e derivadas. | `Front-End/files/html/ovas/calculus.html` difere de `quantum_computing.html` em 4 linhas; `calculus2.html` difere de `calculus.html` em 2 | 🔴 |
| 2 | **Em EN, o texto dos módulos continua em português.** O leitor já procura `<ova>.en.html`, mas só existe a versão EN de Computação em Nuvem. O banco está quase todo traduzido (questões, alternativas, competências, recursos: 100%); o que fica em PT são os nomes das matérias, os avisos gerados pelo EduBot e os painéis do professor. | `services/ovaContent.ts:143-158`; Anexos 1 e 2 | 🔴 |
| 3 | **Texto de desenvolvedor na tela do aluno:** "Bedrock ainda não conectado", "corrigidas pelo servidor", "dados rastreados no backend", "a API está no ar?". Em modo mock (o padrão da demo) o selo de "resposta simulada" aparece. | ver A.2 | 🔴 |
| 4 | **Sete abas para o aluno, três delas repetem o que já existe dentro do módulo** (Atividades, Quiz, Professor Mediador). Após o login o aluno cai num painel de números, não no que estudar. | `Sidebar.tsx:26-34`, `App.tsx:60` | 🟠 |
| 5 | **"Professor Mediador" nomeia duas coisas diferentes** (uma página de recomendação e o chat dentro do módulo) e a mesma IA aparece com 7 nomes. | ver C.1 | 🟠 |
| 6 | **Jargão brasileiro sem sentido em inglês:** OVA, RA, LGPD, "consumido", "Mediating Professor", "Reinforcement OVA". | Anexo 1, seção 2 | 🔴 |

---

# (A) Diagnóstico de UX

## A.1 Navegação, páginas e elementos

| # | Página / elemento | Problema (o que o usuário sente) | Evidência | Pri. | Ação |
|---|---|---|---|---|---|
| A1 | Abertura após o login | O aluno cai no "Dashboard" de métricas; o que estudar fica a 1 clique e sem contexto de matéria. | `App.tsx:60` (fallback `dashboard`), `App.tsx:144-145` (logout volta ao dashboard) | 🟠 | Home = **Minhas matérias** (B.1) |
| A2 | Conteúdos | Lista plana de OVAs, **sem matéria**. "Cálculo" e "Cálculo 2" aparecem soltos ao lado de "Computação Quântica". | `Contents.tsx:89-106` | 🟠 | Agrupar por matéria (B.1) |
| A3 | Conteúdos × leitor | Vídeos, podcasts e atividades aparecem **fora** do módulo (na lista) **e dentro** dele (em "Recursos adicionais"). O aluno não sabe onde está "o certo". | `Contents.tsx:134-214` × `OvaReader.tsx:563-610` | 🟠 | Recursos só dentro do módulo |
| A4 | Card do OVA em Conteúdos | Explica o rastreamento ("o tempo de leitura e o scroll continuam sendo rastreados") em vez do que o aluno vai aprender. | `Contents.tsx:117-120` | 🔴 | Trocar por resumo do módulo |
| A5 | Aba **Atividades** | As mesmas atividades do leitor, sem contexto, com um "marcar como concluída" solto. Já tinha fusão planejada (U.2 do Plano 1, adiada). | `Exercises.tsx` | 🟠 | Fundir no módulo (passo "Atividades") |
| A6 | Aba **Quiz** | Repete o quiz que já está no fim do módulo e tem o próprio seletor de OVA. Fora do módulo, o aluno que ainda não leu esbarra em "Quiz bloqueado" sem um caminho para o conteúdo. O feedback manda o aluno para outra aba ("visite o Professor Mediador"). | `Quiz.tsx:162`, `:305-307` × `OvaReader.tsx:551` | 🟠 | Quiz só no módulo (passo "Quiz") |
| A7 | Aba **Professor Mediador** | Junta três coisas sem relação (recomendação sob demanda, histórico de avisos, privacidade LGPD) numa página com nome de pessoa. | `Report.tsx:52`, `:125`, `:143` | 🟠 | Desmontar (seção C) |
| A8 | Dashboard × Meu Desempenho | Os dois mostram progresso e competências. "Meu Desempenho" empilha 7 blocos (gamificação, coach, revisões, assunto, competência, gráficos, tendência): página longa, sem hierarquia. | `Dashboard.tsx:271`, `:304`; `Evolution.tsx:39-94` | 🟠 | Fundir em **Meu progresso** com 3 abas internas |
| A9 | Avisos do EduBot | A mesma entidade (intervenção) aparece em **4 lugares**: caixa "O EduBot tem recomendações", card "Avisos do EduBot" (no mesmo Dashboard, com outra fonte), sino do topo e histórico do Professor Mediador. | `Dashboard.tsx:105` (não lidas) e `:328-340` (histórico) na mesma tela; `Sidebar.tsx:407-431`; `Report.tsx:125` | 🟠 | Um lugar para agir (coluna "Para fazer"), um para consultar (histórico em Meu progresso) |
| A10 | Reforço | "OVA de reforço" e "Gerar OVA de reforço" são jargão; a trilha não aparece ligada à matéria de onde veio. | `Reforco.tsx:255`, `:270` | 🟠 | Renomear; mostrar no card da matéria |
| A11 | Chip "47% consumido" no topo | "Consumido" é métrica interna; para o aluno, é progresso. | `Sidebar.tsx:383-386` | ⚪ | "47% concluído" / "47% complete" |
| A12 | Marca | A barra lateral diz **"Adapta · LEARN · IA"**; o resto do produto diz **EduBot**. "IA" não vira "AI" em EN. | `Sidebar.tsx:95-96`, `:171-172`; `Login.tsx:51` | 🔴 | Uma marca só (decisão 👤) |
| A13 | Busca do topo | Achar um OVA leva para a aba Conteúdos, não para o módulo; mistura seções, OVAs e competências. | `Sidebar.tsx:261` | ⚪ | Resultado abre o item (matéria/módulo) |
| A14 | Menu do professor | "Conteúdos" do professor é a tela do aluno, com métricas de leitura do próprio professor (sempre 0%). | `Sidebar.tsx:45-49` | ⚪ | Modo "pré-visualização" sem métricas |
| A15 | Dois avisos em sequência no 1º acesso | Consentimento → onboarding de 3 passos que descreve a navegação atual ("Seus módulos estão aqui", "O quiz libera após a leitura"). | `OnboardingModal.tsx:38-54` | 🟠 | Reescrever junto com B |

## A.2 Linguagem e microcopy

**Texto técnico exposto ao aluno (remover ou reescrever — 🔴 para a demo):**

| Onde | Hoje | Proposta PT | Proposta EN |
|---|---|---|---|
| `Report.tsx:82-86` | "resposta simulada — Bedrock ainda não conectado" | (não exibir ao aluno; só com `EDUBOT_DEBUG=1`) | — |
| `Quiz.tsx:163` | "Questões corrigidas pelo servidor — cada tentativa alimenta o EduBot." | "Cada resposta ajuda o EduBot a montar seu próximo passo." | "Every answer helps EduBot plan your next step." |
| `Quiz.tsx:269` | "Corrigindo no servidor..." | "Corrigindo..." | "Checking your answers…" |
| `Evolution.tsx:35` | "Gráficos gerados a partir dos dados rastreados no backend." | "Como você está indo em cada matéria." | "How you're doing in each course." |
| `Login.tsx:37`, `App.tsx:235` | "verifique se a API está no ar" | "Não conseguimos conectar. Tente de novo em instantes." | "We couldn't connect. Please try again in a moment." |
| `PerformanceCoach.tsx:93` | "IA indisponível agora — usando a versão local." | (silencioso: mostrar o texto local sem aviso) | — |
| `Report.tsx:107` | "Justificativa (para o professor)" exibida ao aluno | (mover para a fila do professor, onde já existe) | — |
| `Contents.tsx:117-120` | descrição do rastreamento | resumo do módulo (vem do HTML do OVA) | module summary |

**Jargão** (ver glossário em D.1): OVA → *módulo* / *module*; RA → *matrícula* / *student ID*;
LGPD → *privacidade e dados* / *privacy & data (GDPR)*; consumido → *concluído* / *complete*.

**Voz:** a interface fala com o aluno na 2ª pessoa ("Abra seu módulo"); o EduBot, quando
fala, usa a 1ª pessoa ("Separei 3 exercícios para você"). Hoje os dois se misturam.

## A.3 Conteúdo

| # | Problema | Evidência | Pri. |
|---|---|---|---|
| C1 | Cálculo e Cálculo 2 usam o HTML de Computação Quântica; as competências 4–6 e as questões de Cálculo são reais. Resultado: o aluno lê sobre superposição e é cobrado em derivadas. | `diff` dos HTML; `Database/sql/dml.sql:527-529`, questões com `ova_id` 2 e 3 | 🔴 |
| C2 | O comentário do i18n assume que "o conteúdo dos OVAs permanece no idioma original". Ou seja, a tradução do conteúdo nunca foi parte do escopo do seletor. | `i18n.tsx:7-8` | 🔴 |
| C3 | Imagens dos OVAs podem ter texto em PT embutido (`criptografia-quântica.jpg`, `entrelaçamento.jpg`…). | `Front-End/files/imagens/` | ⚪ (verificar nos screenshots) |
| C4 | Acervo pequeno: 9 competências, 32 questões, 39 recursos; 3 competências não passam no próprio teste de cobertura. | `ARQUITETURA_EDUBOT.md` §16 | ⚪ |

## A.4 Internacionalização técnica (resumo dos anexos)

- **Interface:** 35 textos ficam em PT mesmo em EN, 40 traduções soam traduzidas ao pé da
  letra e 17 formatações são fixas em pt-BR (datas cruas, `toLocaleString("pt-BR")`,
  plurais "dia(s)", ordinal "1º"). Detalhe em [Anexo 1](docs/auditoria-ux-holanda/anexo1-i18n-interface.md).
- **Chamadas sem idioma:** avisos (`api.ts:263`), alertas, visão geral e mapa de domínio do
  professor (`api.ts:461`, `:513`, `:539`) não mandam `?lang=`.
- **Banco:** questões (38), alternativas (38), competências (9), recursos (39) e nomes de OVA
  (4) já têm EN preenchido (`migration_001_i18n.sql`). Faltam colunas EN para o nome do curso
  e das 3 matérias, e 7 links de leitura apontam para páginas em PT (`dml_extra.sql:46` etc.).
- **Textos gerados pelo backend:** a intervenção é gravada **já escrita** numa coluna só
  (`interventions.description`), no idioma de quem disparou. A varredura agendada roda sem
  idioma, portanto em PT (`proactivity.py:365`). Revisão espaçada e meta semanal têm frase fixa em PT
  (`proactivity.py:273-279`, `:320-323`); a "justificativa" é sempre PT (`agent/prompt.py:53`).
  Conquistas e metas já estão certas (catálogo `(pt, en)` em código). Detalhe em
  [Anexo 2](docs/auditoria-ux-holanda/anexo2-i18n-conteudo.md).
- **Saudação do tutor** é calculada uma vez e não troca se o idioma mudar com o OVA aberto
  (`hooks/useTutorChat.ts:24`).

---

# (B) Nova arquitetura de páginas e fluxos

## B.1 Mapa do site — antes e depois

**Aluno — antes (7 abas):** Dashboard · Conteúdos · Atividades · Quiz · Reforço · Meu Desempenho · Professor Mediador

**Aluno — depois (3 abas + menu da conta):**

| Aba | PT | EN | Rota |
|---|---|---|---|
| 1 (home) | **Minhas matérias** | **My courses** | `#/materias` |
| 2 | **Prática personalizada** | **Personalized practice** | `#/pratica` |
| 3 | **Meu progresso** | **My progress** | `#/progresso` |
| menu da conta (avatar no topo) | Privacidade e dados · Idioma · Sair | Privacy & data · Language · Sign out | — |

**Professor/coordenação — depois:** **Minha turma** (home) · **Visão do curso** · **Matérias** (pré-visualização).

**Hierarquia no modelo Canvas** (o banco já tem: `courses → offerings → course_subjects → ovas`):

```
Minhas matérias  #/materias                                ┌──────────────────────┐
 ├─ Continuar de onde parou  (1 cartão, U.4 já existe)      │ PARA FAZER           │
 └─ Cartões de MATÉRIA, com % e próximo passo               │ · sugestões EduBot   │
     Computação Quântica · Cálculo · Computação em Nuvem    │ · revisões vencidas  │
       │                                                    │ · quiz liberado      │
       ▼                                                    └──────────────────────┘
     Matéria  #/materia/:id
      ├─ Módulos (OVAs) em ordem, com estado:
      │    não iniciado · 45% lido · quiz liberado · concluído
      ├─ Resultados de aprendizagem da matéria (domínio por competência)
      └─ Prática recomendada nesta matéria (trilha de reforço, se houver)
            │
            ▼
          Módulo  #/modulo/:id/:passo        passo = conteudo | atividades | quiz
           [1 Conteúdo] → [2 Atividades] → [3 Quiz]   + painel "Perguntar ao EduBot"
```

A coluna **Para fazer** imita a "To Do" do Canvas: é o único lugar onde o aluno **age**
sobre o que o EduBot sugeriu.

## B.2 Destino de cada página atual

| Hoje | Vai para | Como | Quem | Esf. |
|---|---|---|---|---|
| Dashboard | **Minhas matérias** | "Continuar", boas-vindas e sugestões sobem para a home; métricas (tempo, acerto, consumo) vão para Meu progresso | 🤖 | M |
| Conteúdos | Minhas matérias → Matéria → Módulo | lista agrupada por `subject_id`; recursos saem da lista e ficam só no módulo | 🤖 | M |
| Atividades | passo 2 do módulo | U.2 do Plano 1; `Exercises.tsx` aposentado | 🤖 | P |
| Quiz | passo 3 do módulo | U.1 (front) do Plano 1; o modo desafio vai junto; `Quiz.tsx` vira componente interno ou sai (o `OvaQuiz` cobre) | 🤖 | M |
| Reforço | **Prática personalizada** | renomear; atalho no cartão da matéria e no "Para fazer" | 🤖 | P |
| Meu Desempenho | **Meu progresso** | 3 abas internas: *Resumo* (coach + KPIs + revisões) · *Por matéria* (assunto → competência + gráficos) · *Conquistas* (gamificação) + histórico de sugestões | 🤖 | M |
| Professor Mediador | (some) | seção C | 🤖 | M |
| Meus dados (LGPD) | menu da conta → Privacidade e dados | mover `MyDataPanel` | 🤖 | P |

**Redirecionamentos** (nenhum link antigo quebra): `#/dashboard`, `#/contents`,
`#/exercises` → `#/materias`; `#/quiz` → `#/modulo/<último OVA>/quiz` ou `#/materias`;
`#/report`, `#/evolution` → `#/progresso`; `#/reforco` → `#/pratica`; `#/modulo/:id` continua
valendo (passo padrão = conteúdo).

## B.3 Fluxos principais

1. **Primeiro acesso:** login → consentimento → onboarding (3 passos reescritos: "Suas
   matérias", "Cada módulo tem conteúdo, atividades e quiz", "O EduBot sugere o próximo passo
   em Para fazer") → **Minhas matérias**.
2. **Estudar:** Minhas matérias → Matéria → Módulo → Conteúdo → Atividades → Quiz (liberado
   a 70% de leitura, regra do backend que já existe) → tela de resultado com **o próximo passo
   ali mesmo** (sem mandar o aluno para outra aba).
3. **Recuperar:** sugestão no "Para fazer" → "Praticar agora" → trilha personalizada → quiz de
   fixação → volta para a matéria com o domínio atualizado.
4. **Professor:** Minha turma → aluno em risco → "Aguardando sua aprovação" → aprovar/rejeitar a
   ação proposta pelo EduBot.

## B.4 Mudanças técnicas

**Backend (🤖, P):**
- `services/student_context.py`: expor `subject_id` e `subject_nome` (traduzido) em cada item
  de `ovas` — o JOIN com `Subjects` já existe em `student_context.py:262-269`; incluir
  `ORDER BY` por matéria e por `ova_id`.
- `migration_024_i18n_conteudo.sql`: cria `courses.course_name_en`,
  `course_subjects.subject_name_en` e `resources.resource_url_en` e popula as traduções
  (pacote ♊ G2); `tr()` nos nomes de matéria e curso.
- Campos novos **opcionais** no contrato (regra do projeto); atualizar `test_profile_contract.py`.

**Frontend (🤖):**
- Router (`App.tsx`): rotas `#/materias`, `#/materia/:id`, `#/modulo/:id/:passo`, `#/pratica`,
  `#/progresso` + redirecionamentos (completa a U.8 do Plano 1). Home padrão = `materias`.
- Novos: `CoursesHome.tsx` (cartões + "Continuar" + "Para fazer"), `SubjectPage.tsx`.
- `OvaReader.tsx` ganha o stepper Conteúdo → Atividades → Quiz (as três partes já existem
  no leitor; muda a apresentação e a URL).
- `Sidebar.tsx`: `navItems` com 3 itens; menu da conta no `Topbar`.
- Aposentar `Exercises.tsx`, `Report.tsx` e a view `Quiz.tsx`.
- "Para fazer" reaproveita `useInterventions()` + `getReviews()`.

---

# (C) EduBot no lugar do "Professor Mediador"

## C.1 O que existe hoje e por que confunde

1. **Dois recursos diferentes com o mesmo nome.** A aba `#/report` (`Report.tsx:52`) é uma
   página de recomendação sob demanda; o chat dentro do módulo usa o mesmo título no
   cabeçalho (`ova/TutorChat.tsx:33`). O aluno não sabe se é uma pessoa, um chat ou um relatório.
2. **Uma IA, sete nomes.** EduBot, Professor Mediador, tutor ("Explique esta seção com o
   tutor", `OvaReader.tsx:514`), assistente ("Assistente do conteúdo", `:650`), IA ("Tirar
   dúvidas com a IA", `:438`; "Pergunte à IA", `:634`), companheiro de estudo
   (`StudyCompanion.tsx:204`) e "EduBot fala com você" (`PerformanceCoach.tsx:141`).
3. **A página mistura três funções:** pedir recomendação, histórico de avisos e privacidade
   LGPD (`Report.tsx:61`, `:125`, `:143`).
4. **Compete com o diferencial do produto.** O EduBot já é proativo (as sugestões aparecem
   sozinhas no Dashboard); um botão "Pedir recomendação" escondido numa aba passa a
   mensagem contrária.
5. **Mostra bastidores:** selo de "resposta simulada — Bedrock" e "Justificativa (para o
   professor)" na tela do aluno (`Report.tsx:82-86`, `:107`).
6. **"Mediating Professor" não existe em inglês.** E "professor" sugere uma pessoa real.

## C.2 Proposta: um nome, três momentos

**Regra:** a IA se chama sempre **EduBot** (com o avatar da persona que o aluno escolheu).
"Professor" fica reservado à **pessoa** — e é ela quem de fato faz a mediação: aprova o que
o EduBot propõe antes de chegar ao aluno (a fila de aprovação já existe).

| Momento | Pergunta do aluno | Onde aparece | Nome PT | Nome EN | Vem de |
|---|---|---|---|---|---|
| Durante o estudo | "Não entendi isto." | painel lateral do módulo + botão "Explicar" em cada seção | **Perguntar ao EduBot** · **Explicar esta seção** | **Ask EduBot** · **Explain this section** | `TutorChat` + `StudyCompanion` (o menu do companheiro abre o mesmo chat) |
| Depois do estudo | "O que faço agora?" | coluna **Para fazer** da home + tela de resultado do quiz | **Próximos passos** | **Next steps** | caixa de sugestões do `Dashboard` + `GET /edubot/recommendation` |
| Olhando para trás | "Como estou indo?" | Meu progresso → Resumo | **Recado do EduBot** · **Histórico de sugestões** | **A note from EduBot** · **Suggestion history** | `PerformanceCoach` + histórico do `Report` |
| (professor) | "O que o EduBot quer fazer com meus alunos?" | Minha turma | **Aguardando sua aprovação** | **Awaiting your approval** | `ApprovalQueue` (hoje "Ações propostas pelo EduBot", `ApprovalQueue.tsx:46`) |

## C.3 Mudanças concretas

| # | Mudança | Arquivo | Quem | Esf. |
|---|---|---|---|---|
| C3.1 | Remover a aba `report` e redirecionar para `#/progresso` | `Sidebar.tsx:33`, `App.tsx:52`, `:275` | 🤖 | P |
| C3.2 | Card **Próximos passos** no "Para fazer": título, **um motivo escrito para o aluno** (não a justificativa técnica), botão principal com link direto (`#/modulo/:id/quiz`, `#/pratica?comp=`), "Dispensar". Estado vazio: "Você está em dia. Quando houver algo novo, aparece aqui." + ação secundária "Pedir uma sugestão agora" | `Dashboard.tsx:105-170` → `CoursesHome.tsx` | 🤖 | M |
| C3.3 | Esconder o selo "simulada" e a justificativa do aluno (selo só com `EDUBOT_DEBUG=1` ou para staff) | `Report.tsx:82-86`, `:107` | 🤖 | P |
| C3.4 | Cabeçalho do chat = nome da persona ou "EduBot"; nunca "Professor Mediador" | `TutorChat.tsx:33` | 🤖 | P |
| C3.5 | Unificar os rótulos do leitor: "Tirar dúvidas com a IA" / "Pergunte à IA" / "Assistente do conteúdo" / "Explique esta seção com o tutor" → **Perguntar ao EduBot** / **Explicar esta seção** | `OvaReader.tsx:438`, `:514`, `:634`, `:650`; `StudyCompanion.tsx:98`, `:204` | 🤖 | P |
| C3.6 | Resultado do quiz mostra o próximo passo no lugar ("Visite o Professor Mediador" sai) | `Quiz.tsx:305-307` → passo Quiz do módulo | 🤖 | P |
| C3.7 | Privacidade (LGPD/GDPR) vai para o menu da conta | `MyDataPanel.tsx` | 🤖 | P |
| C3.8 | Renomear a fila do professor e mostrar ali a justificativa | `ApprovalQueue.tsx:46-50` | 🤖 | P |

**Aceite:** `grep -ri "mediador\|mediating" Front-End/react-logic-demo/src` sem resultado; após
o login, o aluno vê as sugestões do EduBot sem clicar em nada; o chat do módulo e a home usam
o mesmo nome e o mesmo avatar.

---

# (D) Matriz de tradução do conteúdo

## D.1 Glossário (vale para todo o EN — PT → EN)

Inglês **americano** (decisão de 22/10/2026: *personalized*, *program*);
todos os pacotes ♊ seguem este glossário. A IA e o produto se chamam **Engage-Agent**.

| PT | EN | Evitar |
|---|---|---|
| OVA / Objeto Virtual de Aprendizagem | **module** | OVA, virtual learning object |
| Matéria / disciplina | **course** | subject (ok só em gráficos) |
| Curso (Eng. de Computação) | **program** | course |
| Competência | **learning outcome** (padrão europeu) | competency (ok em painéis do professor) — decisão 👤 |
| Domínio (BKT) | **mastery** | domain |
| Reforço / trilha de reforço | **practice** / **personalized practice path** | reinforcement (track/OVA) |
| Atividade prática | **hands-on activity** | practical activity |
| Professor Mediador | **EduBot** (seção C) | Mediating Professor |
| Professor / tutor (pessoa) | **teacher** | tutor (confunde com a IA) |
| Turma | **class** | — |
| Gestor / coordenação | **program coordinator** | manager |
| RA | **student ID** | RA |
| LGPD | **privacy & data (GDPR)** | LGPD sozinho |
| Consumido / consumo | **complete / progress** | consumed |
| Avisos | **notifications** | notices |
| Revisão espaçada | **spaced review** | — |
| Sequência (dias) | **streak** | sequence |
| Conquista | **achievement** | conquest |
| Em risco · sumiu · errando · esquecendo | **at risk · inactive · struggling · forgetting** | erring, low study |

## D.2 Matriz

| # | Item | Onde vive | Volume | Estado EN hoje | Como traduzir | Quem | Pri. |
|---|---|---|---|---|---|---|---|
| T1 | Texto dos OVAs (seções, acordeões, carrosséis, `alt`) | `Front-End/files/html/ovas/*.html` | 4 OVAs, ~270 linhas cada | só `cloud_computing.en.html` | criar `<ova>.en.html` com a **mesma estrutura** (o leitor já busca esse arquivo) | ♊ G1 → 🤖 confere → 👤 lê | 🔴 |
| T2 | Conteúdo real de Cálculo e Cálculo 2 | idem | 2 OVAs | não existe nem em PT | decisão 👤: esconder na demo **ou** ♊ rascunha PT+EN a partir das competências 4–6 e um professor valida | ♊ G0 / 👤 | 🔴 |
| T3a | Questões, alternativas, competências, recursos, nomes de OVA | `migration_001_i18n.sql`, `migration_023…sql` | 38 + 38 + 9 + 39 + 4 | **100% com EN** | só revisão de naturalidade e glossário (G5) | ♊ G5 → 🤖 | 🟠 |
| T3b | Nome do curso e das 3 matérias | `courses`, `course_subjects` | 1 + 3 | **sem coluna EN** | colunas `_en` + `UPDATE` na `migration_024` | 🤖 (4 linhas, não vale delegar) | 🔴 |
| T3c | Links de leitura externos em PT | `resources.resource_url` (`dml_extra.sql:46,55,58,61,119,121,123`) | 7 | sem coluna EN | ♊ G2 sugere páginas equivalentes em inglês (IBM, AWS, Khan Academy…); 🤖 confere se o link abre | ♊ G2 → 🤖 | 🟠 |
| T3d | Conquistas e metas semanais | catálogo `(pt, en)` em `gamification.py`, `goals.py` | 8 + 5 + 3 | **com EN** | só G5 | ♊ G5 | ⚪ |
| T4 | Avisos e alertas gerados pelo EduBot (recomendação, intervenção, revisão, meta, alerta ao professor, justificativa) | `agent/agent.py`, `agent/prompt.py`, `services/proactivity.py` | ~10 templates | gravados **já escritos** em PT; varredura sem idioma | 🤖 grava o **tipo + parâmetros** e renderiza no idioma da leitura (ou grava `description_en` junto); corrige revisão/meta/justificativa; ♊ G4 escreve as frases EN dos templates | 🤖 + ♊ G4 | 🔴 |
| T5 | Interface — textos sem tradução | componentes React | 35 itens (Anexo 1 §1) | PT fixo ou dado vindo sem `?lang=` | 🤖 passa `lang` nas chamadas (`api.ts:263`, `:461`, `:513`, `:539`) e mapeia enums (status, prioridade, tipo); ♊ G3 traduz o que for texto | 🤖 + ♊ G3 | 🔴 |
| T6 | Interface — inglês pouco natural | `t("…", "…")` e `en:` | 40 itens (Anexo 1 §2) + tudo que o glossário mudar | traduzido ao pé da letra | ♊ G3 reescreve só o 2º argumento de `t()` seguindo D.1 | ♊ G3 → 🤖 revisa diff | 🔴 |
| T7 | Datas, números, plurais, ordinais | componentes | 17 itens (Anexo 1 §3) | fixos em pt-BR | 🤖 cria um helper com `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.PluralRules` | 🤖 | 🟠 |
| T8 | Respostas da IA (tutor, coach, redator) com LLM real | `agent/tutor.py`, `coach.py`, `redactor.py` | — | recebem `lang` (Anexo 2 confirma onde) | 🤖 garante que o prompt manda responder em inglês britânico | 🤖 | 🟠 |
| T9 | Imagens com texto | `Front-End/files/imagens/` | 16 arquivos | desconhecido | verificar nos screenshots; trocar só as que tiverem texto em PT | 👤 | ⚪ |
| T10 | Voz | Polly (`EDUBOT_POLLY_VOICE_EN=Joanna`) | — | voz americana | trocar para voz britânica (ex.: Amy) se a decisão for BrE | 🤖 | ⚪ |

## D.3 Pacotes para o Gemini (♊) — prontos para rodar

Todos seguem a skill `antigravity`: pedido fechado num arquivo, glossário D.1 colado no
pedido, rodado da raiz do repo. **Exceção à regra "só o Claude escreve"** (registrada no
`AGENTS.md`): G0, G1 e G3 rodam com `--edit` numa **branch própria**, só nos arquivos que o
pedido listar; os demais só devolvem texto. O Claude revisa o `git diff` antes de qualquer merge. Modelo: o padrão (Gemini 4
Argon) para G1/G2/G4, que exigem inglês de qualidade; Flash basta para G3.

| Pacote | Entrada | Saída | Regras do pedido | Como o Claude confere (barato) |
|---|---|---|---|---|
| **G0** (se decidido) | competências 4–6 + questões de Cálculo (`dml.sql`) + `cloud_computing.html` como modelo de estrutura | `calculus.html`, `calculus2.html` com conteúdo de Cálculo | mesma estrutura de seções/acordeões/carrosséis do modelo; nível de graduação; cobrir as competências 4–6 | script compara a árvore de tags; Claude lê 1 seção; **professor valida** |
| **G1** | `quantum_computing.html` (+ `calculus*.html` depois do G0) | `<ova>.en.html` | traduzir só nós de texto e `alt`/`title`; não mexer em tags, classes, ids, `src`; inglês britânico; glossário D.1 | script: mesma sequência de tags PT×EN; Claude lê intro + 1 acordeão; nenhuma palavra PT restante (lista de stopwords PT) |
| **G2** | as 7 linhas de `resources` com link em PT (`dml_extra.sql`) | tabela `resource_id | URL PT | URL EN sugerida | por que é equivalente` | não editar arquivos; só fontes estáveis e abertas (sem paywall) | 🤖 abre cada URL e escreve o `UPDATE` na `migration_024` |
| **G3** | lista do Anexo 1 + glossário | edição dos arquivos `.tsx` listados | **alterar só o 2º argumento de `t()` e campos `en:`**; nada de lógica | `git diff --stat` + leitura do diff; `npx tsc --noEmit` |
| **G4** | templates PT do backend (Anexo 2 §2) | arquivo de rascunho com os pares PT→EN | não editar código: devolve tabela `chave | PT | EN` | Claude integra os pares no código que ele mesmo escreve |
| **G5** | todo o EN pronto | relatório de revisão | revisão de consistência com o glossário e naturalidade (como um revisor nativo) | Claude aplica o que se confirmar; 👤 nativo faz a leitura final |

## D.4 Aceite da tradução

- Navegar por todas as telas em EN (aluno, professor, coordenação), com screenshot via
  skill `run`: **nenhuma palavra em português** na tela, incluindo avisos e painéis.
- `grep` por "OVA", "RA ", "LGPD", "Mediating", "consumed" nos textos EN: zero ocorrências.
- Leitura final por um falante nativo (👤) de: home, um módulo inteiro, quiz, Meu progresso,
  painel do professor.

---

# Ordem de execução

| Fase | O quê | Quem | Esf. | Pri. |
|---|---|---|---|---|
| **0 — Higiene da demo** | screenshots PT/EN do estado atual; decisões 👤 abaixo; remover texto técnico (A.2); uma marca só (A12); esconder ou substituir Cálculo (T2) | 🤖 + 👤 | P | 🔴 |
| **1 — Conteúdo em inglês** | G1, G2 (+ G0 se decidido); revisão do Claude | ♊ → 🤖 | M | 🔴 |
| **2 — Navegação estilo Canvas** | B.4 backend + router + Minhas matérias + Matéria + stepper do módulo + redirecionamentos (roda em paralelo com a Fase 1) | 🤖 | G | 🟠 |
| **3 — EduBot no lugar do Professor Mediador** | C3.1–C3.8 | 🤖 | M | 🟠 |
| **4 — Interface em inglês nativo** | T5 (código) + G3 + T7 + G4/T4 | 🤖 + ♊ | M | 🔴 |
| **5 — Validação** | screenshots EN de todas as telas; `pytest`; `tsc`; G5; leitura nativa 👤; registro no `LOG_EXECUCAO.md` | 🤖 + ♊ + 👤 | P | 🔴 |

**Se o tempo apertar, o mínimo para a Holanda:** Fase 0 + Fase 1 + Fase 4 + C3.1/C3.3/C3.4/C3.5
(renomear e esconder bastidores, sem reestruturar a navegação).

## Decisões (registradas em 22/10/2026)

1. **Cálculo e Cálculo 2:** conteúdo real produzido pelo Gemini (G0), em PT e EN, a partir das
   competências 4–6 e das questões dos OVAs 2 e 3. Exemplos conferidos pelo Claude; **falta a
   validação de um professor de Cálculo** (👤).
2. **Inglês:** **americano** (o glossário D.1 vale com grafia americana: *personalized*, *program*).
3. **Nome do produto:** **Engage-Agent** — nome do produto e da IA (substitui EduBot e Adapta
   na interface e nos prompts; nomes internos de código e do repositório não mudam).
4. **"Competência" em EN:** **learning outcome**.
5. **Home do professor:** **Minha turma**.

## Checklist (execução de 22/10/2026)

- [~] F0 screenshots do estado atual — **não feitos**: o Docker Desktop não subiu nesta máquina
  (socket `dockerInference` travado); a validação visual foi feita depois, na versão nova, com
  Flask + SQLite carregado com os seeds reais + Vite
- [x] F0 decisões 1–5
- [x] F0 texto técnico removido (A.2) · marca única (Engage-Agent) · Cálculo com conteúdo real
- [x] F1 G1 `quantum_computing.en.html`, `calculus.en.html`, `calculus2.en.html` (G0 + G1)
- [x] F1 `migration_024_i18n_conteudo.sql` (curso, matérias, links, colunas EN de runtime) + teste de contrato
- [x] F2 perfil com `subject_*` nos OVAs · router novo · redirecionamentos
- [x] F2 Minhas matérias · Matéria · stepper do módulo · Para fazer
- [x] F2 Atividades, Quiz, Conteúdos e Dashboard aposentados · Meu progresso com 3 abas
- [x] F3 C3.1–C3.8 · `grep` sem "Mediador" fora de comentários
- [x] F4 chamadas com `?lang=` · enums traduzidos · G3 · helper `Intl` · G4/T4
- [x] F5 `pytest` · `tsc` · `vite build` · navegação EN (aluno, professor, coordenação) · `LOG_EXECUCAO.md`
- [ ] F5 `migration_024` num MySQL real (Docker) · leitura por falante nativo · professor de Cálculo valida G0
