# PLANO DE EXECUÇÃO 3 — O Personagem que Estuda com Você (Etapas 10–12)

> **Contexto.** Os Planos 1 e 2 entregaram telemetria, modelo do aluno (BKT), agente
> proativo, revisão espaçada, gamificação de esforço e metas. Este plano nasce de uma
> releitura completa do código (2026-07-14) e de uma mudança de visão do produto:
> **os avatares (EduBot, Prof. Einstein, Dra. Curie) deixam de ser recompensa de
> gamificação e viram FERRAMENTA DE ESTUDO** — um companheiro que acompanha o aluno
> dentro dos módulos (OVAs), reage ao que ele faz, lê o conteúdo em voz alta e o
> conecta ao tutor IA. Em vez de "um chatbot na lateral", o personagem te ajuda a
> estudar.

---

## 1. Decisões de produto (registradas nesta rodada)

| Tema | Decisão | Consequência |
|---|---|---|
| Desbloqueio de personas | **REVOGADA a decisão R.1 do Plano 2** (personas por nível). Personas são **livres para todos, sempre** | `PERSONA_UNLOCK` sai; cadeado sai da UI; recompensas de nível passam a ser só insígnias/títulos e desafios (mantidos) |
| Natureza do avatar | Ferramenta de estudo, não prêmio | Persona **desacopla da gamificação**: continua existindo mesmo com `EDUBOT_GAMIFICATION=off` |
| Onde o personagem vive | Em **todos os pontos de estudo**: leitor de OVA, quiz, reforço, chat do tutor, dashboard | Novo componente unificado `CompanionAvatar` + widget `StudyCompanion` no leitor |
| Como ele ajuda | Saudação contextual, marcos de leitura, reação ao quiz, "explique esta seção", leitura em voz alta, apresenta a trilha de reforço | Gatilhos **determinísticos e locais primeiro** (sem custo); IA sob demanda (mesmo padrão do coach) |
| Anti-irritação | O personagem **nunca bloqueia, nunca repete, pode ser silenciado/ocultado** | Cooldown, teto de falas por sessão, preferência persistida, `prefers-reduced-motion` |

## 2. Princípios (herdados dos Planos 1–2, valem aqui)

1. **Zero dependência nova**: Three.js/@react-three/fiber, Web Speech, Polly e o
   agente já existem. Nada de biblioteca nova, nada de asset externo.
2. **Mock nunca quebra**: todo caminho de LLM tem versão determinística local.
3. **Degradação graciosa**: sem WebGL → mascote 2D; sem Polly → Web Speech; sem
   voz → só balões de texto; `EDUBOT_COMPANION=off` → leitor idêntico ao atual.
4. **LGPD**: gatilhos locais usam apenas dados que já estão no cliente; caminhos
   com LLM sobre dados do aluno continuam atrás do consentimento `ia_sobre_dados`.
5. **Migrations idempotentes** (padrão `information_schema` + PREPARE/EXECUTE);
   perfil continua **≤ 8 queries** (teste golden inalterado).
6. **Áudio só com gesto do usuário**: navegadores bloqueiam autoplay — a fala
   espontânea do companheiro é **balão de texto**; voz toca apenas ao clicar ▶.

---

## 3. Pontos de melhoria encontrados na releitura (2026-07-14)

Numerados para rastreio; cada um é resolvido em uma etapa abaixo (coluna "Etapa").

| # | Ponto | Onde | Etapa |
|---|---|---|---|
| M1 | Personas travadas por nível (decisão revogada) | `gamification.py:46` (`PERSONA_UNLOCK`), `PerformanceCoach.tsx:79-95` (cadeado) | 10 |
| M2 | Persona só em `localStorage` — não segue o aluno entre dispositivos e o backend não sabe qual persona fala | `services/persona.ts` | 10 |
| M3 | Personas atreladas à gamificação: com `EDUBOT_GAMIFICATION=off` o seletor some (`/gamification/me` é a única fonte) | `PerformanceCoach.tsx:81-91` | 10 |
| M4 | Lip-sync não ligado: `useSpeech` já expõe `visemeRef` (timeline do Polly), mas a boca do `Avatar3D` só oscila com o boolean `speaking` | `Avatar3D.tsx:38-49`, `useSpeech.ts:43` | 10 |
| M5 | Voz única para todas as personas (Einstein fala com a voz "Camila") | `speech.py` (`EDUBOT_POLLY_VOICE_PT` único), `useSpeech.ts:18-22` | 10 |
| M6 | `TutorChat` perde TODO o histórico ao fechar/reabrir o painel (unmount no toggle) | `OvaReader.tsx:433-451` | 11 |
| M7 | `TutorChat` sem personagem e sem voz: header genérico, resposta não pode ser ouvida | `TutorChat.tsx:83-110` | 11 |
| M8 | `OvaQuiz` descarta o payload `gamification` de `/question/answer` (o `Quiz.tsx` da aba mostra +XP/conquista; o quiz do OVA, não) | `OvaQuiz.tsx:68-69` | 11 |
| M9 | `OvaQuiz.response_ms` usa a mesma base (`loadedAtRef`) para todas as questões — infla o tempo das últimas | `OvaQuiz.tsx:33,67` | 11 |
| M10 | Prompts do coach e do tutor não sabem a persona (falam sempre como "EduBot") | `coach.py:36-43`, `tutor.py:31-43` | 11 |
| M11 | Não há leitura em voz alta do conteúdo do OVA (o `useSpeech` existe e não é usado no leitor) — perda de acessibilidade e do formato "podcast" | `OvaReader.tsx` | 11 |
| M12 | Dashboard e Onboarding ignoram a persona escolhida (mascote fixo) | `Dashboard.tsx:112`, `OnboardingModal.tsx:97` | 12 |
| M13 | Reforço: `mensagem_aluno` do agente é texto seco — o personagem deveria apresentar a trilha | `Reforco.tsx:73-77` | 12 |
| M14 | Rótulo de interação hardcoded em PT ("Abriu o assistente do OVA") mistura idioma na telemetria | `OvaReader.tsx:269` | 12 |

---

## 4. ETAPA 10 — Personas livres + fundação técnica do companheiro

**Objetivo:** qualquer aluno usa qualquer persona desde o primeiro acesso; a escolha
vive no servidor; um único componente de avatar (com lip-sync real) e uma voz por
persona ficam prontos para as etapas seguintes. **Sem mudança visível no leitor ainda.**

### AV.1 — Remover a trava por nível (M1) `[x]`
- **Backend** `services/gamification.py`:
  - Apagar `PERSONA_UNLOCK`; `personas_state()` passa a devolver
    `[{"id": "einstein", "unlocked": True}, {"id": "curie", "unlocked": True}]`
    (mantém o **shape** com `unlocked` fixo `True` e `unlock_level: 0` por 1 release,
    para não quebrar front antigo em cache).
  - `me_state` continua incluindo `personas` (compat), mas deixa de ser a fonte.
- **Frontend** `PerformanceCoach.tsx`: remover `locks`/`isLocked`/cadeado/`Nv{n}`;
  todos os botões sempre habilitados. Remover import `Lock` se órfão.
- **Testes**: substituir `test_persona_unlock_by_level` por
  `test_personas_always_unlocked` (qualquer nível → tudo `unlocked=True`).
- **Docs**: anotar no `PLANO_EXECUCAO_2.md` (R.1) que a decisão foi revogada aqui.
- **Nota de produto**: recompensas de nível continuam existindo (insígnias, títulos,
  desafios R.3) — só a persona sai do sistema de recompensa.

### AV.2 — Persona persistida no servidor (M2, M3) `[x]`
- **Migration** `Database/sql/migration_018_persona.sql` (013 continua reservada):
  `ALTER TABLE students ADD COLUMN persona VARCHAR(24) NOT NULL DEFAULT 'edubot'`
  — idempotente (padrão `information_schema` + PREPARE/EXECUTE).
- **Model** `students.py`: campo `persona`.
- **API**:
  - `GET /student/me` → inclui `persona` (a linha de `students` já está carregada —
    **0 queries novas**, golden test intacto).
  - `POST /student/persona` `{"persona": "einstein"}` → valida contra o catálogo
    do servidor (`{"edubot", "einstein", "curie"}`), grava, devolve `{persona}`.
    Rota nova `personaRoute.py` OU junto ao `studentRoute.py` (preferir studentRoute:
    é atributo do aluno, não feature nova).
- **Frontend** `services/persona.ts`: vira **server-backed com cache local** —
  `getPersona()` lê do perfil carregado (fallback localStorage p/ tela de login);
  `setPersona(id)` grava local **e** dispara `POST /student/persona` (fire-and-forget,
  erro não bloqueia a UI).
- **Fonte da verdade da UI**: o `App.tsx` já carrega o perfil — persona desce por
  props/contexto; **desacoplada de `/gamification/me`** (funciona com gamificação off).
- **Testes**: set/get da persona; persona inválida → 400; default `edubot`.

### AV.3 — `CompanionAvatar`: um componente, lip-sync de verdade (M4) `[x]`
- **Novo** `components/brand/CompanionAvatar.tsx`: recebe `personaId`, `speaking`,
  `visemeRef?`, `size` e resolve sozinho:
  - `edubot` → `EduBotAvatar` (2D, leve);
  - `einstein`/`curie` → `Avatar3D`; **WebGL falhou → fallback 2D** (lógica que hoje
    está duplicável no PerformanceCoach sobe para cá).
- **Lip-sync**: `Avatar3D` ganha prop `visemeRef` — no `useFrame`, se houver viseme
  atual ≠ `"sil"`, a abertura da boca vem de um **mapa viseme→abertura**
  (`{"a":0.9,"e":0.6,"i":0.35,"o":0.75,"u":0.45,"p":0.05,"f":0.2,"sil":0}` — os
  visemas do Polly `pt-BR`); sem `visemeRef` (Web Speech), mantém a oscilação atual.
  *Custo zero: o `useSpeech` já produz a timeline (V.1); é só consumir.*
- **Refactor**: `PerformanceCoach` passa a usar `CompanionAvatar` (comportamento
  idêntico, menos código).
- **Aceite**: com credencial Polly, a boca acompanha os fonemas; sem, tudo como hoje.

### AV.4 — Voz por persona (M5) `[x]`
- **Backend** `services/speech.py`: `synthesize(text, lang, voice_hint=None)` —
  mapa `PERSONA_VOICE = {"edubot": {"pt": "Camila", "en": "Joanna"}, "einstein":
  {"pt": "Thiago", "en": "Matthew"}, "curie": {"pt": "Vitoria", "en": "Danielle"}}`
  (vozes neurais do Polly; cache de áudio já considera a voz na chave do arquivo).
- **Rota** `/edubot/speak`: aceita `persona` opcional; valida contra o catálogo.
- **Frontend** `useSpeech.speak(text, lang, persona?)`: repassa ao Polly; no fallback
  Web Speech, escolhe voz por heurística de gênero da persona (lista `PREFERRED`
  por persona; se não houver, mantém a atual).
- **Testes**: `test_speech.py` — hint de voz muda a voz pedida; persona inválida cai
  na default; mock nunca quebra.

**Validação da Etapa 10**: suíte verde; build `tsc` exit 0; smoke no MySQL real
(migration 2×; `POST /student/persona` → refletido no `/student/me`); seletor do
coach sem cadeados e funcionando com `EDUBOT_GAMIFICATION=off`.

---

## 5. ETAPA 11 — O companheiro de estudo dentro do OVA (o coração do plano)

**Objetivo:** ao abrir um módulo, o personagem escolhido está lá — saúda, acompanha a
leitura, comemora o quiz, lê o conteúdo em voz alta e faz a ponte com o tutor IA.

### CP.1 — Widget `StudyCompanion` no leitor (novo) `[x]`
- **Novo** `components/ova/StudyCompanion.tsx`, montado pelo `OvaReader`:
  - **Posição**: flutuante no canto inferior-esquerdo (não cobre o botão lateral do
    tutor, que é à direita); `CompanionAvatar` pequeno (~96px) + **balão de fala**.
  - **Estados**: `idle` (respira/pisca) → `talking` (balão visível; boca anima ao
    tocar áudio) → `celebrating` (micro-bounce). Sem loop de animação pesado: o
    canvas 3D já existe; em `idle` prolongado (>60s) o canvas pode congelar frame
    (`frameloop="demand"`) para poupar bateria.
  - **Controles no próprio widget**: ▶ ouvir a fala atual (voz da persona — AV.4),
    🔇 silenciar sessão, ✕ ocultar (persistido em `localStorage`
    `edubot.companion=off` e respeitado em todos os OVAs até religar em Meu Desempenho).
  - **A11y**: balão com `role="status"` `aria-live="polite"`; `prefers-reduced-motion`
    desliga bounce/flutuação (padrão já existente no `EduBotAvatar`).
- **Flag** `EDUBOT_COMPANION=on|off` (compose passthrough + `.env.example`): `off` →
  o `OvaReader` nem monta o widget (leitor idêntico ao de hoje). Exposta ao front
  via `/student/me` (campo `features.companion`) para não criar rota nova.

### CP.2 — Gatilhos determinísticos (fala local, custo zero) `[x]`
Motor de falas **no cliente** (`hooks/useCompanionScript.ts`) com regras claras:

| Gatilho | Fala (exemplos PT; EN espelhado no i18n) | Fonte do dado |
|---|---|---|
| Abrir o módulo | "Vamos estudar **{ova}** juntos! Eu fico por aqui se precisar." / retomada: "Bem-vindo de volta — você parou em {perc}%." | props do leitor + progresso salvo |
| 50% da leitura | "Metade do caminho! O que vem agora costuma cair no quiz…" | `maxScrollRef` existente |
| Leitura completa (90% / página curta) | "Leitura concluída! Que tal testar no quiz aqui embaixo?" | `isCompleted()` existente |
| Quiz: acerto | "Boa! +{xp} XP" (se houver XP — ver CP.3) | payload `gamification` |
| Quiz: erro | "Quase! Quer que eu te explique essa parte?" com **botão** que abre o tutor com pergunta pré-preenchida (CP.4) | correção server-side |
| Conquista desbloqueada | "🏆 Você desbloqueou: {conquista}!" | payload `gamification` |

- **Anti-irritação (regras duras)**: cooldown ≥ 45s entre falas espontâneas; máx.
  6 falas espontâneas por sessão de leitura; reações a clique do aluno (quiz,
  botões) não contam no teto; fila com prioridade (conquista > quiz > marcos);
  fala nova substitui a anterior (nunca empilha); **nenhum áudio automático** (M6
  dos princípios — voz só via ▶).
- **Telemetria**: `track("companion_spoke", "ova", id, {trigger})` e
  `track("companion_dismissed"|"companion_listened", ...)` no schema D.1 existente
  (verbos novos, tabela `learning_events` — sem migration).

### CP.3 — Quiz do OVA em paridade com o quiz da aba (M8, M9) `[x]`
- `OvaQuiz.tsx` passa a **consumir** `graded.gamification` (a API já devolve): expõe
  callback `onGamification(g)` que o `OvaReader` liga ao `StudyCompanion` (reações
  de acerto/erro/XP/conquista de CP.2).
- `response_ms` por questão: base individual — `loadedAtRef` vira
  `Record<question_id, number>` marcado quando a questão **entra na tela** (ou, mais
  simples e suficiente: reset da base após cada submissão).
- **Teste manual de aceite**: responder tudo certo → companheiro comemora com XP;
  errar → oferta de explicação.

### CP.4 — Ponte com o Tutor IA: o personagem é o tutor (M6, M7, M10) `[x]`
- **Histórico não se perde (M6)**: estado do chat (`messages`) sobe do `TutorChat`
  para o `OvaReader` (ou o painel passa a ser ocultado por CSS em vez de
  desmontado). Fechar/reabrir mantém a conversa da sessão.
- **Persona no chat (M7)**: header do `TutorChat` troca o logo genérico pelo
  `CompanionAvatar` (mini, 40px) com `speaking` ligado enquanto a resposta toca;
  nome do header = nome da persona ("Prof. Einstein" / "Dra. Marie Curie" /
  "Professor Mediador" para edubot). Cada resposta ganha botão **▶ ouvir** (voz da
  persona — AV.4).
- **"Explique esta seção"**: botão discreto (ícone ✨) no título de cada `section`
  do `OvaReader` → abre o painel do tutor com a pergunta pré-preenchida
  ("Explique a seção '{heading}' com outras palavras") e o contexto que já vai hoje.
  Reaproveita `tutorChat` **sem endpoint novo**; conta como `pergunta_ao_tutor`
  no XP (regra e teto já existem).
- **Persona no cérebro (M10)**: `POST /tutor-chat` e `GET /edubot/coach-message`
  aceitam `persona` (validada no servidor):
  - `tutor.py`: o `SYSTEM_PROMPT_TEMPLATE` ganha um parágrafo de ESTILO por persona —
    Einstein: analogias físicas do cotidiano, tom curioso ("imagine que…");
    Curie: método, experimento e perseverança ("vamos por partes, como num
    laboratório…"); EduBot: neutro atual. **As regras de grounding não mudam**
    (responder só com o material do OVA).
  - `_MockTutorClient`: prefixo/bordão determinístico por persona (2 variações),
    para a persona ser perceptível **sem LLM real** e testável.
  - `coach.py`: `_SYSTEM` parametrizado do mesmo jeito.
- **Testes**: mock do tutor devolve bordão da persona; persona inválida → ignora
  (cai no edubot); histórico preservado é teste de front (aceite manual + tsc).

### CP.5 — Leitura em voz alta do conteúdo (M11) `[x]`
- Botão **🔊 "Ouvir esta seção"** no título de cada seção do `OvaReader`: envia o
  texto da seção (parágrafos concatenados, limite ~2.500 chars — teto do Polly por
  request com folga) ao `useSpeech.speak(..., persona)`; enquanto toca, o
  `StudyCompanion` anima a boca (visemas — AV.3).
- Estado global simples: uma seção tocando por vez; trocar de seção para a anterior.
- **Acessibilidade real**: aluno com dificuldade de leitura ganha o conteúdo falado
  pelo personagem — é o item que mais materializa "o personagem te ajuda a estudar".
- Telemetria: `track("played", "ova_section", ovaId, {kind: "tts", section})`.

**Validação da Etapa 11**: suíte verde (novos testes de tutor/persona/speech);
build exit 0; smoke real: abrir OVA → saudação; ler até o fim → marco; errar questão
→ oferta de explicação → chat abre pré-preenchido e responde no estilo da persona;
`EDUBOT_COMPANION=off` → leitor idêntico ao atual (screenshot Playwright dos dois).

---

## 6. ETAPA 12 — Personagem em toda a jornada + polimentos da releitura

**Objetivo:** consistência — a persona escolhida aparece em todos os pontos de fala
da plataforma; e fechamos os itens M12–M14.

### EX.1 — Dashboard e Onboarding com a persona (M12) `[x]`
- `Dashboard.tsx` (inbox de intervenções) e `OnboardingModal.tsx`: `EduBotAvatar`
  fixo → `CompanionAvatar` com a persona do perfil (`speaking` já é controlado).
- As intervenções faladas ("ouvir") usam a voz da persona (AV.4).

### EX.2 — Reforço apresentado pelo personagem (M13) `[x]`
- `Reforco.tsx`: o bloco de `feedback` (a `mensagem_aluno` do agente) vira um
  balão do `CompanionAvatar` com ▶ ouvir — o personagem "entrega" a trilha que o
  agente montou ("Preparei esta trilha porque você teve dificuldade em {competência}").
- O leitor da OVA personalizada ganha o mesmo `StudyCompanion` do leitor normal
  (mesmos gatilhos de CP.2 — componente é reutilizado, não duplicado).

### EX.3 — Higiene encontrada na releitura (M14 e cia.) `[x]`
- `OvaReader.tsx:269`: rótulo de interação → constante neutra (`"ova_assistant_opened"`)
  mantendo compat com relatórios (o rótulo antigo continua reconhecido no tutor).
- Remover `preloadAvatar` (no-op morto em `Avatar3D.tsx:290`) e imports órfãos.
- `PerformanceCoach`: após AV.1/AV.2, o fetch de `/gamification/me` fica só para o
  título — simplificar o efeito.

### EX.4 — Medição de impacto (o "antes × depois" do companheiro) `[x]`
- `/tutor/engagement` ganha bloco `companheiro`: % de alunos com companheiro ativo
  (não ocultaram), nº de "ouvir" por semana, nº de "explique esta seção" → tudo de
  `learning_events` (verbos de CP.2/CP.5) — **sem migration nova**.
- `EngagementPanel.tsx`: card com esses números (o tutor enxerga se o personagem
  está sendo usado ou ignorado — critério honesto para manter/ajustar a feature).

### EX.5 — Documentação e encerramento `[x]`
- `LOG_EXECUCAO.md`: bloco por etapa (como nos planos anteriores).
- `.env.example` + `compose.yaml`: `EDUBOT_COMPANION`, vozes por persona.
- `GUIA` de teste rápido: roteiro de 5 min para demonstrar o companheiro.

**Validação da Etapa 12**: suíte completa verde; build exit 0; Playwright:
screenshot do OVA com companheiro + chat com persona; smoke MySQL real.

---

## 7. O que NÃO entra neste plano (e por quê)

| Fora | Motivo |
|---|---|
| Avatares GLB fotorrealistas / novas personas | Migration 013 continua reservada; os procedurais atendem e não dependem de rede. Criar persona nova = 1 item em `avatars.ts` + 1 variante de cabelo |
| Voz em streaming / lip-sync fonema-a-fonema no Web Speech | Web Speech não expõe o áudio; o lip-sync real fica no caminho Polly (AV.3) |
| Companheiro "andando pela página" / apontando elementos | Custo de manutenção alto e risco de irritar; os gatilhos de CP.2 entregam o valor com 10% do risco |
| LLM proativa falando sozinha durante a leitura | Custo + autoplay bloqueado + risco pedagógico (interromper leitura); gatilhos locais primeiro, IA sob clique |

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Canvas 3D pesado em máquina fraca / vários canvases na página | 1 canvas por página no máximo (widget OU chat header — o header usa a versão 2D `EduBotAvatar`-style da persona se o widget já estiver montado); `frameloop="demand"` em idle; fallback 2D já existe |
| Personagem irritar o aluno | Regras duras de CP.2 (cooldown/teto/substituição), ocultar persistente, flag global `off` |
| Fala do mock parecer "burra" com persona | Bordões são curtos e o grounding continua citando o material — o estilo é tempero, não conteúdo |
| Migration em volume existente | Padrão idempotente já validado 17×; aplicar 2× no smoke |
| Regressão no leitor (componente central) | `EDUBOT_COMPANION=off` reproduz o leitor atual byte a byte; screenshot comparativo no aceite |

## 9. Checklist mestre

- [x] **ETAPA 10** (2026-07-14) — AV.1 personas livres · AV.2 persona no servidor (migration 018) · AV.3 CompanionAvatar + visemas · AV.4 voz por persona — **214 testes verdes; build tsc exit 0; smoke no MySQL real OK**
- [x] **ETAPA 11** (2026-07-19) — CP.1 widget no leitor (+flag) · CP.2 gatilhos locais · CP.3 quiz em paridade · CP.4 tutor com persona + histórico + "explique esta seção" · CP.5 ouvir o conteúdo — **221 testes verdes; build exit 0; Playwright confirma o companheiro no leitor**
- [x] **ETAPA 12** (2026-07-19) — EX.1 dashboard/onboarding · EX.2 reforço · EX.3 higiene · EX.4 medição · EX.5 docs — **222 testes verdes; build exit 0 (three.js lazy); Playwright confirma persona Einstein no leitor**
- [x] Auditoria de consistência das Etapas 10–12 (2026-07-19): 1 defeito (reset por módulo via key) + 1 limpeza; 222 testes verdes; verificado ao vivo.
