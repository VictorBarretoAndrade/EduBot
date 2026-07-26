# PLANO DE EXECUÇÃO 4 — Acessibilidade de verdade (Etapas 13–16)

> **Contexto.** Os Planos 1–3 entregaram telemetria, agente proativo, gamificação de
> esforço e o Companheiro de Estudo. Este plano nasce de uma auditoria de
> acessibilidade do frontend (2026-07-19): o app já tem uma base decente
> (foco visível global, `aria-live` nos toasts e no balão do companheiro,
> `prefers-reduced-motion` no widget, labels no login, teclado no carrossel),
> mas há falhas que hoje **bloqueiam** quem usa leitor de tela ou navega só
> por teclado — inclusive no coração do produto (chat do tutor, menu do
> companheiro, o progresso que destrava o quiz).
>
> **Este documento é um plano — nenhum código foi alterado ao criá-lo.**
> A execução será feita em sessão separada, etapa por etapa.

---

## 1. Princípios (herdados dos Planos 1–3, valem aqui)

1. **Zero dependência nova**: focus trap, live regions e padrões ARIA são
   implementados à mão (são pequenos). Nada de biblioteca de a11y.
2. **Nenhuma mudança de backend**: este plano é 100% frontend
   (`Front-End/react-logic-demo/`). Zero migrations, os 222 testes de backend
   ficam intactos por definição.
3. **Comportamento visual preservado**: quem enxerga e usa mouse não deve
   notar diferença (exceto o foco mais visível e o menu mobile, que são adições).
4. **i18n sempre**: todo texto novo passa por `t(pt, en)` — inclusive
   `aria-label`s (hoje há um hardcoded em PT no Toast).
5. **Validação em cada etapa**: build `tsc` estrito no container
   (`ova_react_build` sai com código 0), passeio só-teclado documentado na
   seção 8, e smoke com Playwright dirigindo teclado (Tab/setas/Esc).

## 2. Referências de padrão

- Modais/diálogos: [WAI-ARIA APG — Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Menu do companheiro: [WAI-ARIA APG — Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- Busca com resultados: [WAI-ARIA APG — Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- Critérios citados: WCAG 2.2 — 1.3.1 (Info e relações), 1.4.11 (Contraste
  não-textual), 2.1.1 (Teclado), 2.1.2 (Sem armadilha), 2.2.1 (Tempo ajustável),
  2.4.1 (Pular blocos), 2.4.7 (Foco visível), 3.1.1/3.1.2 (Idioma), 4.1.2/4.1.3
  (Nome/função/valor e mensagens de status).

---

## 3. Pontos encontrados na auditoria (2026-07-19)

Numerados para rastreio; cada um é resolvido em uma etapa abaixo.

| # | Ponto | Onde | Gravidade | Etapa |
|---|---|---|---|---|
| A1 | Modais não prendem o Tab (o comentário diz "foco preso", mas só há foco inicial); troca de passo do onboarding não é anunciada | `ConsentModal.tsx:29-31`, `OnboardingModal.tsx:63-71` | 🔴 | 13 |
| A2 | Menu do companheiro: `role="menu"` sem teclado — Esc não fecha, setas não navegam, foco não entra/não volta | `StudyCompanion.tsx:74-116` | 🔴 | 13 |
| A3 | Chat do tutor: respostas e "Pensando..." não são anunciados (sem live region); input só com placeholder; painel móvel sem semântica de diálogo/Esc/foco | `TutorChat.tsx:102-199`, `OvaReader.tsx:579-598` | 🔴 | 13 |
| A4 | `<html lang>` fixo em `pt-BR` — alternar para EN não atualiza `document.documentElement.lang` | `index.html:2`, `i18n.tsx:31-34` | 🔴 | 13 |
| A5 | Sem navegação no celular: sidebar é `hidden lg:block` e não existe menu hambúrguer | `Sidebar.tsx:34`, `App.tsx:230-238` | 🔴 | 14 |
| A6 | Busca e sino só com mouse: popovers fecham apenas com `mousedown` fora, sem Esc/setas; sino sem contagem no rótulo (bolinha só por cor) | `Sidebar.tsx:102-110, 150-167, 187-221` | 🟡 | 14 |
| A7 | Sem skip link; aba ativa da sidebar sem `aria-current` | `App.tsx:230-238`, `Sidebar.tsx:48-58` | 🟡 | 14 |
| A8 | Quiz: radios sem `fieldset`/`legend` — alternativas soltas do enunciado no leitor de tela | `OvaQuiz.tsx:119-167` | 🟡 | 15 |
| A9 | Barra de progresso de leitura é só visual (sem `role="progressbar"`) — e é ela que destrava o quiz | `OvaReader.tsx:401-403` | 🟡 | 15 |
| A10 | Erro do login não é anunciado (sem `role="alert"`) | `Login.tsx:81` | 🟡 | 15 |
| A11 | Toasts somem em 4s fixos, sem pausa no hover/foco; `aria-label` do fechar hardcoded em PT | `Toast.tsx:57, 93` | 🟡 | 15 |
| A12 | Foco visível fraco: outline da marca com 28% de opacidade | `styles.css:22-27` | 🟢 | 16 |
| A13 | `prefers-reduced-motion` só no companheiro; scroll `smooth` do chat e animações Tailwind ignoram a preferência | `styles.css`, `TutorChat.tsx:52`, `Avatar3D.tsx` | 🟢 | 16 |
| A14 | Micro-textos de 10–11px (badges/botões) e tooltips só via `title` (invisíveis a teclado/touch) | `PerformanceCoach.tsx:143`, `StudyCompanion.tsx`, `TutorChat.tsx:129-147` | 🟢 | 16 |

**Fora do escopo (backlog, com decisão registrada na seção 7):** legendas/
transcrições de vídeo e podcast (WCAG 1.2 — depende de conteúdo, não de código);
`alt` das imagens vindas do HTML dos OVAs (conteúdo-fonte); auditoria automatizada
com axe-core (dependência nova — princípio 1).

---

## 4. ETAPA 13 — Fundamentos críticos de leitor de tela e teclado

**Objetivo:** os quatro bloqueadores (A1–A4) resolvidos. Depois desta etapa, um
aluno que usa NVDA/teclado consegue: passar pelo consentimento e onboarding sem
escapar do modal, operar o menu do boneco, conversar com o tutor **e ouvir as
respostas serem anunciadas**, tudo com a pronúncia do idioma certo.

### AC.1 — Hook `useFocusTrap` + modais de verdade (A1) `[x]`

- **Novo** `src/hooks/useFocusTrap.ts` — um hook, reutilizado por: os 2 modais,
  o painel móvel do tutor (AC.3) e o drawer mobile (NA.1). Contrato:

  ```ts
  // Prende o Tab dentro de containerRef enquanto active=true.
  // - Tab no último focável -> volta ao primeiro (e Shift+Tab o inverso);
  // - opcional onEscape (Esc) — se ausente, Esc não faz nada (modal bloqueante);
  // - ao ativar: foca initialFocusRef ?? primeiro focável ?? o container;
  // - ao desativar/desmontar: devolve o foco ao elemento que o tinha antes.
  function useFocusTrap(
    containerRef: RefObject<HTMLElement>,
    opts: { active: boolean; onEscape?: () => void; initialFocusRef?: RefObject<HTMLElement> }
  ): void;
  ```

  Implementação: listener de `keydown` no container; focáveis via
  `container.querySelectorAll('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')`
  (consultado **a cada Tab**, não cacheado — o conteúdo do modal muda entre passos);
  guardar `document.activeElement` na ativação e restaurar no cleanup.
- **`ConsentModal.tsx`**: substituir o `useEffect` de foco (linhas 29-31) por
  `useFocusTrap(dialogRef, { active: true })` — **sem** `onEscape` (consentimento
  é bloqueante por design, manter).
- **`OnboardingModal.tsx`**:
  - substituir o `useEffect` (linhas 63-71) por
    `useFocusTrap(dialogRef, { active: true, onEscape: finish })` (o listener de
    Esc atual sai — o hook cobre);
  - **anunciar a troca de passo**: envolver título+texto (linhas 99-103) em um
    container com `aria-live="polite"` e `aria-atomic="true"` — ao avançar, o
    leitor de tela lê o novo passo sem mexer no foco (que permanece no botão
    "Próximo", ótimo para quem tecla Enter repetido);
  - indicador de passos (linha 116): manter `aria-hidden` nas bolinhas e
    adicionar um `<span className="sr-only">` com
    `t(`Passo ${step + 1} de ${steps.length}`, ...)` dentro da região viva.
- **Utilitário `sr-only`**: o Tailwind já fornece a classe `sr-only` — usar
  direto, nada a criar.
- **Aceite**: com o modal aberto, Tab/Shift+Tab circulam apenas dentro dele;
  Esc fecha o onboarding e o foco volta a quem o tinha; NVDA lê cada passo ao
  clicar "Próximo"; fechar devolve o foco. Consentimento continua sem Esc.

### AC.2 — Menu do companheiro operável por teclado (A2) `[x]`

Padrão **Menu Button** do APG em `StudyCompanion.tsx`:

- **Abrir**: clique OU `Enter`/`Espaço`/`ArrowDown` no botão do avatar → menu
  abre e **foca o primeiro item**. Guardar refs dos itens
  (`useRef<Array<HTMLButtonElement | null>>([])`).
- **Dentro do menu**: `ArrowDown`/`ArrowUp` movem o foco circularmente;
  `Home`/`End` vão ao primeiro/último; `Esc` fecha **e devolve o foco ao botão
  do avatar**; `Tab` fecha o menu (comportamento canônico do padrão) e segue o
  fluxo normal. Itens com `tabIndex={-1}` (foco gerenciado só por setas).
- **Fechar por clique fora**: o overlay atual (linha 77) continua; Esc cobre o
  teclado.
- **Nome acessível do botão do avatar** (linha 104-116): hoje vem só do `title`
  (e, na persona 3D, o `<canvas>` não tem nome nenhum). Adicionar
  `aria-label={t("Companheiro de estudo — abrir menu de ações", "Study companion — open actions menu")}`
  no `<button>`. Manter `aria-haspopup="menu"` / `aria-expanded`.
- **`aria-labelledby` no `role="menu"`**: dar `id` ao cabeçalho
  "O que posso fazer por você?" (linha 82) e referenciá-lo.
- **Botão de reabrir quando oculto** (linhas 48-57): já tem `aria-label` — ok.
- **Aceite**: sem mouse, é possível abrir o menu, percorrer os 4 itens com
  setas, ativar "Tirar uma dúvida" com Enter e voltar ao boneco com Esc. NVDA
  anuncia "menu", "item de menu 1 de 4" etc.

### AC.3 — Chat do tutor anunciado + painel móvel como diálogo (A3) `[x]`

**Em `TutorChat.tsx`:**

- **Live region dedicada** (mais confiável com re-renders do React do que
  `aria-live` na lista inteira): um `<div className="sr-only" role="status" aria-live="polite">`
  fixo no componente cujo conteúdo é **só a última fala relevante**:
  - ao entrar `loading=true` → `t("O tutor está pensando...", "The tutor is thinking...")`;
  - ao chegar resposta do assistente → o texto da resposta (a última mensagem
    com `role !== "user"`; derivar com `useMemo` de `messages`/`loading`).
  - *Não* colocar `aria-live` no container de scroll (linha 102): o React
    re-renderiza a lista e o leitor de tela repetiria mensagens antigas.
- **Rótulo do campo** (linha 185-190): `aria-label={t("Pergunte sobre este conteúdo", "Ask about this content")}`
  no `<input>` (placeholder não é rótulo).
- **Semântica da conversa**: no wrapper de cada mensagem, um `<span className="sr-only">`
  com `t("Você:", "You:")` / nome da persona — sem isso o leitor de tela não
  distingue quem falou (os avatares são ícones decorativos; marcar os ícones
  `aria-hidden`).
- **Fontes** (linhas 137-150): chips com `title={source.trecho}` — ver VI.3
  (aqui basta não piorar).

**Em `OvaReader.tsx` (painel lateral, linhas 579-598):**

- No modo **overlay** (viewport `< lg`, mesmo `matchMedia` já usado na linha 81):
  o `<aside>` ganha `role="dialog"`, `aria-modal="true"`,
  `aria-label={t("Assistente do conteúdo", "Content assistant")}` e
  `useFocusTrap(asideRef, { active: isOverlay && showTutor, onEscape: () => setShowTutor(false) })`.
- No modo **desktop** (painel lado a lado): **não** é diálogo — sem trap; mas
  Esc com o foco dentro do painel pode fechar (listener local, opcional).
- Ao fechar, o foco volta ao botão que abriu ("Tirar dúvidas com a IA" ou a aba
  lateral) — o próprio `useFocusTrap` restaura.
- **Aceite**: no celular (emulado), abrir o assistente prende o foco no painel,
  Esc fecha e devolve o foco; NVDA anuncia a resposta do tutor ao chegar e o
  "pensando" enquanto carrega; o campo tem nome. No desktop, nada muda
  visualmente.

### AC.4 — `<html lang>` dinâmico (A4) `[x]`

- **`i18n.tsx`** (`LanguageProvider`): adicionar

  ```ts
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  }, [lang]);
  ```

  Roda no mount (corrige também quem carrega já em EN via localStorage) e a
  cada troca. `index.html` continua com `lang="pt-BR"` como default estático.
- **Aceite**: alternar PT↔EN na Topbar muda `document.documentElement.lang`
  (verificável no console e por Playwright); NVDA troca a pronúncia.

---

## 5. ETAPA 14 — Navegação: mobile, popovers e atalhos

**Objetivo:** o app é navegável de ponta a ponta em qualquer tamanho de tela e
sem mouse (A5–A7).

### NA.1 — Menu de navegação no celular (A5) `[x]`

- **Refactor sem mudança visual**: extrair de `Sidebar.tsx` a lista de itens
  para um componente interno reutilizável (ex.: `NavList({ items, activeView, onChangeView, onNavigate? })`)
  — usado pela sidebar desktop (idêntica) e pelo drawer novo. `navItems`/
  `tutorItem` já são dados puros, ficam como estão.
- **Novo drawer mobile** (no próprio `Sidebar.tsx`, exportado como parte da
  `Topbar`, ou componente irmão `MobileNav`):
  - botão hambúrguer no **início da Topbar**, visível só `< lg`
    (`lg:hidden`), com `aria-label={t("Abrir menu", "Open menu")}`,
    `aria-expanded`, `aria-controls="mobile-nav"`;
  - painel `fixed inset-y-0 left-0` deslizante com overlay escuro, contendo
    `<nav id="mobile-nav" aria-label={t("Navegação principal", "Main navigation")}>`
    + `NavList` + os itens de rodapé (aluno conectado, Sair);
  - `role="dialog"` + `aria-modal="true"` + `useFocusTrap` (AC.1) com
    `onEscape` fechando; clique no overlay fecha; **selecionar um item fecha o
    drawer** e navega (`onNavigate`);
  - animação de entrada respeita `prefers-reduced-motion` (ver VI.2).
- **`Sidebar` desktop**: envolver a lista em `<nav aria-label={t("Navegação principal", ...)}>`
  (hoje o `<nav>` existe sem rótulo — linha 43; só adicionar o `aria-label`).
- **Aceite**: em viewport 375px, todas as abas são alcançáveis pelo hambúrguer,
  só com teclado; abrir/fechar gerencia o foco; em desktop nada muda.

### NA.2 — Busca e sino operáveis por teclado (A6) `[x]`

**Busca (`Topbar`, linhas 140-168):**

- Padrão **combobox** enxuto:
  - `<input role="combobox" aria-expanded={results.length > 0} aria-controls="search-results" aria-activedescendant={active ? `search-opt-${activeIdx}` : undefined} aria-label={placeholder}>`;
  - lista `<div id="search-results" role="listbox">`, cada resultado
    `role="option"` com `id="search-opt-{i}"` e `aria-selected`;
  - teclado no input: `ArrowDown`/`ArrowUp` movem a opção ativa (estado
    `activeIdx`, destaque visual = o mesmo `hover:bg-slate-50` de hoje),
    `Enter` ativa a opção destacada, `Esc` limpa a busca e fecha.
  - **Anúncio da contagem**: `<span className="sr-only" role="status">` com
    `t(`${results.length} resultados`, `${results.length} results`)` (debounce
    natural: só re-renderiza quando `results` muda).
- **Fechar por teclado**: além do `mousedown` fora (linhas 102-110), tratar
  `Esc` e `blur` para fora do container (`onBlur` com
  `relatedTarget`/`contains`).

**Sino (linhas 187-221):**

- `aria-label` dinâmico com contagem:
  `t(`Avisos do EduBot — ${n} não lidos`, `EduBot notices — ${n} unread`)`
  (com `n === 0` → rótulo simples). A bolinha vermelha continua (visual).
- Popover: `Esc` fecha e devolve o foco ao sino; ao abrir, foco vai para o
  primeiro elemento interativo (ou o container com `tabIndex={-1}`);
  `aria-expanded`/`aria-controls` no botão.
- Botões "Dispensar" já têm `aria-label` — incluir o tipo:
  `t(`Dispensar aviso: ${item.tipo}`, ...)` (há vários botões idênticos —
  leitor de tela precisa distingui-los).

- **Aceite**: buscar "quiz" e escolher um resultado só com teclado; abrir o
  sino, dispensar um aviso e fechar com Esc; NVDA anuncia a contagem de
  resultados e de avisos.

### NA.3 — Skip link + `aria-current` (A7) `[x]`

- **`App.tsx`** (layout logado, linhas 216-240): primeiro elemento do DOM:

  ```tsx
  <a href="#conteudo"
     className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[8px] focus:bg-brand focus:px-4 focus:py-2 focus:font-bold focus:text-white">
    {t("Pular para o conteúdo", "Skip to content")}
  </a>
  ```

  e no `<main>`: `id="conteudo"` + `tabIndex={-1}` (para o foco pousar).
  *Atenção: o app usa hash-routing (`#/dashboard`) — `href="#conteudo"` muda o
  hash e o `onHashChange` de `App.tsx:122-138` interpretaria como view!*
  **Solução**: o skip link usa `onClick` com `e.preventDefault()` +
  `document.getElementById("conteudo")?.focus()` + `scrollIntoView` — sem tocar
  no hash. (Alternativa aceitável: incluir `conteudo` na guarda do
  `parseHash`, mas o preventDefault é mais limpo.)
- **`Sidebar.tsx`** (linhas 48-58) e itens do drawer (NA.1):
  `aria-current={active ? "page" : undefined}` no botão ativo.
- **Aceite**: primeiro Tab após carregar mostra o link "Pular para o conteúdo";
  Enter leva o foco ao `<main>` sem trocar de view; NVDA anuncia "página atual"
  no item ativo da navegação.

---

## 6. ETAPA 15 — Quiz, formulários e mensagens de status

**Objetivo:** o ciclo central de estudo (ler → destravar → responder → feedback)
é perceptível de ponta a ponta por leitor de tela (A8–A11).

### QF.1 — Quiz com semântica completa (A8) `[x]`

Em `OvaQuiz.tsx` (linhas 119-167):

- Cada questão vira `<fieldset>` com `<legend>`:
  - `<fieldset className="...">` recebe as classes do card atual (borda
    verde/vermelha etc.) — resetar o default do browser
    (`border`/`padding`/`margin` já são controlados pelo Tailwind; conferir que
    `min-w-0` não é necessário);
  - o `<h4>` do enunciado (linha 128) vira
    `<legend className="font-bold text-ink">` com o mesmo conteúdo
    (`{index + 1}. {question.statement}`) — visual idêntico, semântica certa.
    *(Nota: legend dentro de fieldset não aceita as mesmas regras de layout de
    um h4 em todos os browsers — se o visual desviar, alternativa equivalente:
    manter o `<h4 id="q-{id}-label">` e usar
    `<div role="radiogroup" aria-labelledby="q-{id}-label">` no grid de
    alternativas. Escolher UMA das duas na execução e aplicar às demais.)*
- **Feedback**: os `role="status"` por questão (linha 157) ficam; adicionar um
  **resumo** após o "Verificar": `<p role="status" className="sr-only">` com
  `t(`Correção concluída: ${acertos} de ${total} corretas.`, ...)` — um
  submit com N questões dispara N anúncios hoje; o resumo dá o quadro geral.
- **Botão desabilitado explicado**: quando `answeredCount < questions.length`,
  exibir junto ao botão
  `<p className="text-sm text-muted">{t(`Responda as ${questions.length - answeredCount} questões restantes para verificar.`, ...)}</p>`
  — ajuda todo mundo, não só leitor de tela.
- **Aceite**: NVDA em um radio anuncia "1. <enunciado> — alternativa a), 1 de
  4"; após verificar, ouve-se o resumo; o motivo do botão desabilitado é
  visível.

### QF.2 — Progresso de leitura acessível (A9) `[x]`

Em `OvaReader.tsx` (linhas 401-403):

- A barra vira:

  ```tsx
  <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
       aria-label={t("Progresso de leitura", "Reading progress")}
       className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
  ```

  (o filho visual permanece igual).
- **Ligação com o gate do quiz**: a mensagem de bloqueio do quiz
  (`OvaQuiz.tsx:94-108`) já diz "você está em X%" — adicionar `role="status"`
  ao container do aviso, para que a chegada do estado bloqueado seja anunciada.
- **Aceite**: NVDA lê "Progresso de leitura, barra de progresso, N%"; ao rolar,
  `aria-valuenow` acompanha (Playwright: asserção no atributo).

### QF.3 — Erro do login anunciado (A10) `[x]`

Em `Login.tsx` (linha 81): `<p role="alert" className="...">{error}</p>` —
`role="alert"` é live region assertiva implícita; nada mais a fazer. Manter o
`autoFocus` do RA.

- **Aceite**: submeter senha errada com NVDA → "RA ou senha incorretos" é falado
  imediatamente, sem mover o foco.

### QF.4 — Toasts pausáveis e i18n (A11) `[x]`

Em `Toast.tsx`:

- **Pausa no hover/foco** (WCAG 2.2.1): trocar o `setTimeout` solto (linha 57)
  por timers canceláveis por toast — `Map<number, number>` em `useRef`;
  `onMouseEnter`/`onFocus` (capture no container do toast) cancela o timer;
  `onMouseLeave`/`onBlur` reinicia a contagem (4s de novo é aceitável e
  simples). Erros ganham tempo maior: `error` → 8s, demais → 4s.
- **i18n do fechar** (linha 93): o `aria-label="Fechar aviso"` é hardcoded.
  **Conferir a ordem dos providers em `main.tsx`**: se `ToastProvider` estiver
  FORA do `LanguageProvider`, inverter (Toast não consome idioma hoje, então a
  inversão é segura) e usar `useT()` no render dos toasts; se já estiver
  dentro, só trocar por `t("Fechar aviso", "Close notice")`.
- **Aceite**: pousar o mouse sobre um toast o mantém na tela; sair retoma a
  contagem; em EN o botão anuncia "Close notice".

---

## 7. ETAPA 16 — Percepção visual: foco, movimento e micro-textos

**Objetivo:** ajustes de baixo risco que beneficiam baixa visão, sensibilidade a
movimento e telas ruins (A12–A14).

### VI.1 — Foco visível forte (A12) `[x]`

Em `styles.css` (linhas 22-27):

- Trocar o outline translúcido por **anel de dois tons** (funciona em fundo
  claro E no gradiente do header do chat/hero):

  ```css
  button:focus-visible, input:focus-visible, textarea:focus-visible,
  select:focus-visible, a:focus-visible, [tabindex]:focus-visible {
    outline: 3px solid #4f46e5;          /* indigo-600 sólido, sem alpha */
    outline-offset: 2px;
    box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.9); /* halo p/ fundos escuros */
  }
  ```

- Conferir os pontos onde há `outline-none`/`focus:border-brand` locais
  (inputs do login/chat/busca — `Login.tsx:65,77`, `TutorChat.tsx:189`,
  `Sidebar.tsx:147`): `outline-none` + borda colorida é **mais fraco** que o
  padrão novo; remover o `outline-none` desses inputs (o global passa a valer)
  ou garantir que o estilo local tenha contraste ≥ 3:1 (WCAG 1.4.11).
- **Aceite**: tabulando pela página, o foco é visível em TODOS os controles,
  inclusive sobre o gradiente do header do chat e o hero escuro do OVA.

### VI.2 — `prefers-reduced-motion` global (A13) `[x]`

- Em `styles.css`, regra global:

  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

  Isso congela também os spinners (`animate-spin`) — aceitável, **desde que**
  todo spinner tenha texto: o `ViewFallback` (`App.tsx:31-35`) e o loading do
  leitor (`OvaReader.tsx:411-415`) mostram só o ícone → adicionar
  `<span className="sr-only">{t("Carregando", "Loading")}</span>` nos dois.
- `TutorChat.tsx:52`: o `scrollTo({ behavior: "smooth" })` deve respeitar a
  preferência — `const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;`
  → `behavior: reduce ? "auto" : "smooth"`.
- `Avatar3D.tsx`: verificar animações de "idle" (respiração/flutuação) no
  `useFrame` e condicioná-las ao mesmo `matchMedia` (checar uma vez no mount;
  a boca do lip-sync PODE continuar — é conteúdo, não decoração).
- O CSS local do `StudyCompanion` (linhas 64-70) já respeita — fica como está
  (a regra global é redundante ali, sem conflito).
- **Aceite**: com "reduzir movimento" ativo no SO, nenhuma animação decorativa
  roda (celebração, pops, slides do drawer); os carregamentos continuam
  compreensíveis pelo texto.

### VI.3 — Micro-textos e tooltips (A14) `[x]`

- **Piso de 12px** (`text-xs`) para texto com informação. Ocorrências mapeadas
  (buscar `text-[10px]` e `text-[11px]` para confirmar a lista na execução):
  - `PerformanceCoach.tsx:143` — badge "por IA" (10px) → `text-xs`;
  - `PerformanceCoach.tsx:133` — tagline da persona (11px) → `text-xs`;
  - `StudyCompanion.tsx:82` — cabeçalho do menu (11px) → `text-xs`;
  - `StudyCompanion.tsx:150,157` — botões Ouvir/Parar do balão (11px) → `text-xs`;
  - `TutorChat.tsx:129` — botão Ouvir/Parar por resposta (11px) → `text-xs`;
  - `ConsentModal.tsx:79` — selo "Necessário" (11px) → `text-xs`.
  Ajustar padding se algum quebrar linha (conferir visualmente no Playwright).
- **Chips de fonte do tutor** (`TutorChat.tsx:137-150`): o trecho que embasa a
  resposta vive num `title` (invisível a teclado/touch). Trocar o `<span>` por
  `<button>` que **expande/recolhe o trecho** abaixo dos chips
  (`aria-expanded`; estado local `openSource: number | null`); o trecho aparece
  num bloco de texto normal. Sem `title`.
- Botões "Ouvir/Explique" das seções (`OvaReader.tsx:444,457`): têm texto
  visível — os `title` ali são redundantes e podem ficar.
- **Aceite**: nenhum texto informativo abaixo de 12px; o trecho das fontes é
  alcançável por teclado e visível no touch.

---

## 8. Validação (ao final de cada etapa e na auditoria)

1. **Build estrito**: `docker compose up --build ova_react_build` sai com
   código 0 (tsc + vite). Sem dependência nova no `package.json`.
2. **Passeio só-teclado** (roteiro manual, RA 1 / senha 1):
   login → consentimento (Tab circula, sem escape) → onboarding (passos
   anunciados, Esc sai) → skip link → abrir módulo pelo drawer/sidebar →
   menu do boneco (setas + Esc) → "Tirar uma dúvida" → perguntar e ouvir o
   anúncio da resposta → responder quiz → verificar → logout. **Zero mouse.**
3. **Playwright** (mesmo harness das auditorias anteriores —
   `.claude/skills/run/shot.mjs` como base): asserções de atributo
   (`aria-expanded`, `aria-valuenow`, `document.documentElement.lang`,
   `aria-current`) e de teclado (`page.keyboard.press("Tab"/"Escape"/"ArrowDown")`
   + `document.activeElement`). Screenshot em 375px provando o drawer.
4. **Leitor de tela real** (manual, fora do CI): NVDA no Chrome — os itens de
   aceite marcados com "NVDA" acima. Registrar o resultado no `LOG_EXECUCAO.md`.
5. **Não-regressão**: backend intocado (222 testes seguem valendo sem rodar
   nada novo); bundle inicial continua ~60kB gzip (nenhum import novo pesado);
   `EDUBOT_COMPANION=off` continua escondendo o widget (o menu novo vive dentro
   dele).

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Focus trap "caseiro" com bug (armadilha de teclado — WCAG 2.1.2, pior que não ter) | Hook único testado nos 4 usos; Esc sempre disponível exceto no consentimento; passeio só-teclado no aceite de cada uso |
| `aria-live` na lista do chat repetindo mensagens antigas | Live region **dedicada e separada** com só a última fala (AC.3) — nunca `aria-live` em lista re-renderizada |
| Skip link com `href="#conteudo"` quebrando o hash-routing | `onClick` + `preventDefault` + foco programático (NA.3) — o hash nunca muda |
| `<fieldset>`/`<legend>` desviando o layout do card do quiz | Alternativa equivalente documentada (radiogroup + aria-labelledby) — decidir na execução com screenshot antes/depois |
| Congelar `animate-spin` deixando telas "mudas" no reduced motion | Todo spinner ganha texto `sr-only` (VI.2) |
| Inversão de providers do Toast quebrando `useToast` em algum consumidor | Inversão só se necessária; `useToast` não depende de idioma — busca por `useToast(` antes de mover |
| Drawer mobile duplicando a sidebar (dois lugares para manter itens) | `NavList` único consumindo o mesmo `navItems` (NA.1) |

## 10. Fora do escopo (registrado, não esquecido)

- **Legendas/transcrições** de vídeos e podcasts (WCAG 1.2): exige produzir
  conteúdo (VTT/transcrição), não código. Backlog de conteúdo.
- **`alt` das imagens dos OVAs**: vêm do HTML-fonte dos OVAs
  (`services/ovaContent.ts` já propaga `alt` quando existe) — corrigir na
  autoria dos OVAs.
- **Auditoria automatizada (axe-core / @axe-core/playwright)**: dependência
  nova — se desejado, decidir explicitamente em plano futuro (vale a pena como
  guarda de regressão, ~0 custo de runtime, dev-only).
- **Contraste da paleta** (`text-muted` sobre `slate-50` etc.): auditoria
  completa de tokens de cor do Tailwind config — plano próprio se necessário.

---

## Progresso

- [x] ETAPA 13 — AC.1 focus trap + modais · AC.2 menu do companheiro · AC.3 chat anunciado + diálogo móvel · AC.4 `<html lang>` (2026-07-19: build tsc estrito exit 0; smoke Playwright 16/16 verde)
- [x] ETAPA 14 — NA.1 drawer mobile · NA.2 busca/sino por teclado · NA.3 skip link + aria-current (2026-07-19: build exit 0; smoke Playwright desktop+mobile 20/20 verde; corrigido bloco de contenção do backdrop-blur via portal)
- [x] ETAPA 15 — QF.1 quiz semântico · QF.2 progressbar · QF.3 alerta do login · QF.4 toasts (2026-07-19: build exit 0; smoke Playwright 9/9 verde, console limpo)
- [x] ETAPA 16 — VI.1 foco visível · VI.2 reduced motion global · VI.3 micro-textos/tooltips (2026-07-19: build exit 0; smoke Playwright 6/6 verde)
- [x] Auditoria de consistência do Plano 4 (2026-07-19): 5 defeitos corrigidos (2 confirmados ao vivo — foco puxado no resize e ArrowUp da busca; 3 latentes — Avatar3D reduced-motion, activeIdx do menu, id do quiz). Build exit 0; smoke de regressão 8/8 verde.
