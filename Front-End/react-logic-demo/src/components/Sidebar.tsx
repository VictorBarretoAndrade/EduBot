import { BarChart3, Bell, BookOpen, ChevronDown, Grid2X2, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Stars, Users, X } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StudentProfile } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { noticeTypeLabel } from "../services/labels";
import { stripCompetencyMarker } from "../services/reinforcementTarget";
import { useInterventions } from "../hooks/useInterventions";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { LearniaLogo } from "./brand/LearniaLogo";
import { ExploradorAvatar } from "./brand/Explorador";
import { LangSwitch, ThemeToggle } from "./ui/ShellControls";

interface NavItem {
  id: string;
  pt: string;
  en: string;
  icon: typeof Grid2X2;
}

interface SidebarProps {
  activeView: string;
  onChangeView: (view: string) => void;
  studentName: string;
  role: string;
  onLogout: () => void;
}

// Cada item guarda o rótulo nos dois idiomas (traduzido no render).
// Plano 6 (B.1): o aluno tem 3 abas. Atividades e Quiz moram dentro do módulo,
// o Dashboard virou "Minhas matérias" e o Professor Mediador foi desmontado
// (sugestões na home, histórico em Meu progresso, privacidade no menu da conta).
const coursesItem: NavItem = { id: "materias", pt: "Minhas matérias", en: "My courses", icon: BookOpen };
const navItems: NavItem[] = [
  coursesItem,
  { id: "pratica", pt: "Prática personalizada", en: "Personalized practice", icon: Stars },
  { id: "progresso", pt: "Meu progresso", en: "My progress", icon: BarChart3 }
];

// Itens exclusivos de tutor/admin (gestão pedagógica)
const tutorItem: NavItem = { id: "tutor", pt: "Minha turma", en: "My class", icon: Users };
// Plano 5 (20.2): visão do curso — "tudo que o sistema rastreia" da turma.
const gestorItem: NavItem = { id: "gestor", pt: "Visão do curso", en: "Program overview", icon: LayoutDashboard };
const staffCoursesItem: NavItem = { ...coursesItem, pt: "Matérias", en: "Courses", icon: Grid2X2 };

// O menu do STAFF foca em gestão: Minha turma (home) + Visão do curso + Matérias
// (pré-visualizar o material do aluno). Matéria e módulo são subpáginas.
export const STAFF_VIEWS = ["tutor", "gestor", "materias", "privacidade"];

const itemsFor = (role: string): NavItem[] =>
  role === "tutor" || role === "admin" ? [tutorItem, gestorItem, staffCoursesItem] : navItems;

// Plano 6 (A12): marca única do produto — identidade "Relevo": logo Learnia
// (anéis de nível + trilha até a cota), o mesmo da home.
export const Wordmark = ({ small = false }: { small?: boolean }) => <LearniaLogo height={small ? 24 : 28} />;

// NA.1 (Plano 4): lista de navegação compartilhada entre a sidebar (desktop) e o
// drawer (mobile) — uma única fonte dos itens e do estilo. `aria-current="page"`
// marca a aba ativa para leitores de tela (NA.3 / A7).
const NavList = ({
  items,
  activeView,
  onNavigate
}: {
  items: NavItem[];
  activeView: string;
  onNavigate: (view: string) => void;
}) => {
  const t = useT();
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeView;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-11 w-full items-center gap-3 rounded px-4 text-left text-[15px] transition-colors duration-rapido ${
              active
                ? "bg-surface font-semibold text-ink ring-1 ring-inset ring-line"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {/* Aba ativa: marca em Trilha à esquerda ("você está aqui"). */}
            {active && <span className="absolute inset-y-2 left-0 w-[2px] bg-trail" aria-hidden="true" />}
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            {t(item.pt, item.en)}
          </button>
        );
      })}
    </>
  );
};

export const Sidebar = ({ activeView, onChangeView, studentName, role, onLogout }: SidebarProps) => {
  const t = useT();
  const items = itemsFor(role);
  return (
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-line bg-surface/50 lg:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Wordmark />
      </div>

      <nav aria-label={t("Navegação principal", "Main navigation")} className="flex-1 space-y-1 px-3 py-6">
        <div className="k k-muted mb-3 px-4">{t("Navegação", "Navigation")}</div>
        <NavList items={items} activeView={activeView} onNavigate={onChangeView} />
      </nav>

      {/* INTEGRAÇÃO (4.2): aluno logado real + logout */}
      <div className="mx-3 border-t border-line px-1 py-5">
        <div className="k k-muted px-3">{t("Conectado como", "Signed in as")}</div>
        <div className="mt-1 px-3 font-semibold text-ink">{studentName}</div>
        <button
          onClick={onLogout}
          className="mt-3 flex h-10 w-full items-center gap-3 rounded px-3 text-left text-[15px] text-muted transition-colors duration-rapido hover:bg-surface-2 hover:text-ink"
        >
          <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
          {t("Sair", "Sign out")}
        </button>
      </div>
    </aside>
  );
};

// NA.1 (Plano 4) — Navegação no celular. Hambúrguer (só < lg) que abre um drawer
// modal: role="dialog" + foco preso (useFocusTrap) + Esc/overlay fecham; escolher
// um item fecha o drawer e navega. Reaproveita o NavList (mesmos itens da sidebar).
export const MobileNav = ({ activeView, onChangeView, studentName, role, onLogout }: SidebarProps) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const items = itemsFor(role);

  useFocusTrap(panelRef, { active: open, onEscape: () => setOpen(false) });

  const navigate = (view: string) => {
    setOpen(false);
    onChangeView(view);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("Abrir menu", "Open menu")}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-line-strong text-ink transition-colors duration-rapido hover:bg-surface-2 lg:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* Portal para o body: o header tem `backdrop-blur` (backdrop-filter), que
          criaria um bloco de contenção para o `position: fixed` — o drawer ficaria
          preso à altura do header. No body, o `fixed inset-0` cobre a viewport. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
          <style>{`
            @keyframes ebDrawerIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
            .eb-drawer-in { animation: ebDrawerIn var(--dur-medio) var(--ease-subida); }
            @media (prefers-reduced-motion: reduce) { .eb-drawer-in { animation: none !important; } }
          `}</style>
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={t("Menu", "Menu")}
            className="eb-drawer-in absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col border-r border-line bg-surface shadow-soft"
          >
            <div className="flex h-16 items-center justify-between gap-3 border-b border-line px-5">
              <Wordmark small />
              <button
                onClick={() => setOpen(false)}
                aria-label={t("Fechar menu", "Close menu")}
                className="flex h-9 w-9 items-center justify-center rounded text-muted transition-colors duration-rapido hover:bg-surface-2 hover:text-ink"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={t("Navegação principal", "Main navigation")} className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
              <NavList items={items} activeView={activeView} onNavigate={navigate} />
            </nav>

            <div className="border-t border-line px-5 py-5">
              <div className="k k-muted">{t("Conectado como", "Signed in as")}</div>
              <div className="mt-1 font-semibold text-ink">{studentName}</div>
              <button
                onClick={onLogout}
                className="mt-3 flex h-10 w-full items-center gap-3 rounded px-3 text-left text-muted transition-colors duration-rapido hover:bg-surface-2 hover:text-ink"
              >
                <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
                {t("Sair", "Sign out")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

interface SearchResult {
  label: string;
  sub: string;
  hash: string;
}

interface TopbarProps {
  profile: StudentProfile;
  onChangeView: (view: string) => void;
  // Plano 6: navegação por hash completo (a busca abre a matéria/módulo direto).
  onNavigate: (hash: string) => void;
  // NA.1: a Topbar hospeda o hambúrguer/drawer (que precisa dos dados do aluno).
  activeView: string;
  studentName: string;
  role: string;
  onLogout: () => void;
}

// MELHORIA — a busca e o sino deixaram de ser decorativos:
//  - busca: filtra OVAs, competências e seções e navega para a aba certa;
//  - sino: abre os avisos do EduBot (histórico de intervenções) com badge.
// NA.2 (Plano 4): busca no padrão combobox (↑/↓/Enter/Esc + contagem anunciada) e
// sino operável por teclado (Esc fecha e devolve o foco; contagem no rótulo).
export const Topbar = ({ profile, onChangeView, onNavigate, activeView, studentName, role, onLogout }: TopbarProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showNotif, setShowNotif] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Fecha os popovers ao clicar fora deles
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setQuery("");
      if (notifRef.current && !notifRef.current.contains(target)) setShowNotif(false);
      if (accountRef.current && !accountRef.current.contains(target)) setShowAccount(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = query.trim().toLowerCase();
  const staff = role === "tutor" || role === "admin";
  const results = useMemo<SearchResult[]>(() => {
    if (!q) return [];
    const out: SearchResult[] = [];
    // Só sugere seções que existem no menu do papel atual (staff não tem as abas
    // de aluno; sugerir "Meu Desempenho" para um gestor só levaria a um redirect).
    itemsFor(role).forEach((item) => {
      const label = t(item.pt, item.en);
      if (label.toLowerCase().includes(q)) out.push({ label, sub: t("Ir para a seção", "Go to section"), hash: `#/${item.id}` });
    });
    // Plano 6 (A13): matéria e módulo abrem direto o item, não a aba genérica.
    const subjects = new Map<number, string>();
    profile.ovas.forEach((ova) => {
      if (ova.subject_id != null && ova.subject_nome) subjects.set(ova.subject_id, ova.subject_nome);
    });
    subjects.forEach((nome, id) => {
      if (nome.toLowerCase().includes(q)) out.push({ label: nome, sub: t("Matéria", "Course"), hash: `#/materia/${id}` });
    });
    profile.ovas.forEach((ova) => {
      if (ova.ova_name.toLowerCase().includes(q))
        out.push({ label: ova.ova_name, sub: t(`Módulo · ${ova.subject_nome ?? ""}`, `Module · ${ova.subject_nome ?? ""}`), hash: `#/modulo/${ova.ova_id}` });
    });
    // Resultado de aprendizagem → "Meu progresso" só faz sentido para o aluno.
    if (!staff) {
      profile.competencias.forEach((comp) => {
        if (comp.nome.toLowerCase().includes(q))
          out.push({ label: comp.nome, sub: t("Resultado de aprendizagem · Meu progresso", "Learning outcome · My progress"), hash: "#/progresso" });
      });
    }
    return out.slice(0, 8);
  }, [q, profile, t, role, staff]);

  // A opção destacada zera quando os resultados mudam.
  useEffect(() => { setActiveIdx(-1); }, [q]);

  const pick = (hash: string) => {
    onNavigate(hash);
    setQuery("");
    setActiveIdx(-1);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { e.preventDefault(); setQuery(""); setActiveIdx(-1); return; }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % results.length); }
    // AUDITORIA P4: a fórmula anterior `(i - 1 + n) % n` com i=-1 (nenhuma seleção)
    // caía em n-2 em vez do último item (n-1) — confirmado ao vivo. `i <= 0` cobre
    // tanto "nada selecionado" quanto "no primeiro item", indo direto ao último.
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx].hash); }
  };

  // E.2 — sino lê a MESMA fonte do card do dashboard (não lidas) via hook único.
  const { items: notifications, dismiss } = useInterventions();
  const notifCount = notifications.length;

  const closeNotif = () => {
    setShowNotif(false);
    bellRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-bg/85 px-5 backdrop-blur-md lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* NA.1: hambúrguer + drawer (só aparece em telas < lg). */}
        <MobileNav
          activeView={activeView}
          onChangeView={onChangeView}
          studentName={studentName}
          role={role}
          onLogout={onLogout}
        />

        <div ref={searchRef} className="relative w-full max-w-[520px]">
          <div className="flex h-10 items-center gap-3 card px-3.5 text-muted transition-colors duration-rapido focus-within:border-ink">
            <Search size={17} strokeWidth={1.8} aria-hidden="true" />
            <input
              role="combobox"
              aria-expanded={Boolean(q)}
              aria-controls="search-results"
              aria-activedescendant={activeIdx >= 0 ? `search-opt-${activeIdx}` : undefined}
              aria-autocomplete="list"
              aria-label={t("Buscar matérias, módulos e resultados", "Search courses, modules and outcomes")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("Buscar matérias, módulos...", "Search courses, modules...")}
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          {/* Contagem anunciada por leitor de tela (NA.2). */}
          <span className="sr-only" role="status">
            {q ? t(`${results.length} ${results.length === 1 ? "resultado" : "resultados"}`, `${results.length} ${results.length === 1 ? "result" : "results"}`) : ""}
          </span>
          {q && (
            <div
              id="search-results"
              role="listbox"
              aria-label={t("Resultados da busca", "Search results")}
              className="absolute left-0 right-0 top-12 z-30 overflow-hidden card shadow-soft"
            >
              {results.length === 0 ? (
                <div className="px-4 py-4 text-muted">{t("Nada encontrado para", "No results for")} “{query}”.</div>
              ) : (
                results.map((result, index) => (
                  <button
                    key={`${result.hash}-${index}`}
                    id={`search-opt-${index}`}
                    role="option"
                    aria-selected={index === activeIdx}
                    tabIndex={-1}
                    onClick={() => pick(result.hash)}
                    onMouseEnter={() => setActiveIdx(index)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-line px-4 py-3 text-left transition-colors duration-rapido last:border-0 ${
                      index === activeIdx ? "bg-surface-2" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className="font-semibold text-ink">{result.label}</span>
                    <span className="k k-muted text-[10.5px]">{result.sub}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ml-4 flex items-center gap-2.5">
        {/* INTEGRAÇÃO: o chip fake de "streak" virou o consumo real de recursos.
            NA.1: oculto em telas muito estreitas para o header não transbordar
            sobre o hambúrguer (o mesmo dado está no dashboard). Relevo: dado em
            mono, status "você está aqui" (◐). */}
        {!staff && (
          <div className="tag tag-mid mr-1 hidden md:inline-flex">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
            </svg>
            {profile.recursos.percentual_consumido}% {t("concluído", "complete")}
          </div>
        )}

        {/* Alternador de idioma PT/EN e tema claro/escuro, iguais aos da home. */}
        <LangSwitch className="hidden sm:inline-flex" />
        <ThemeToggle />
        <div
          ref={notifRef}
          className="relative"
          onKeyDown={(e) => { if (e.key === "Escape" && showNotif) { e.preventDefault(); closeNotif(); } }}
        >
          <button
            ref={bellRef}
            onClick={() => setShowNotif((value) => !value)}
            aria-expanded={showNotif}
            aria-controls="notif-popover"
            className="relative flex h-9 w-9 items-center justify-center rounded border border-line-strong text-ink transition-colors duration-rapido hover:bg-surface-2"
            aria-label={
              notifCount > 0
                ? t(`Avisos — ${notifCount} ${notifCount === 1 ? "não lido" : "não lidos"}`, `Notifications — ${notifCount} unread`)
                : t("Avisos", "Notifications")
            }
          >
            <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
            {notifCount > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-bg bg-trail" aria-hidden="true" />}
          </button>
          {showNotif && (
            <div id="notif-popover" className="absolute right-0 top-12 z-30 w-80 overflow-hidden card shadow-soft">
              <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
                <ExploradorAvatar size={28} estado="revisar" />
                <span className="font-semibold text-ink">{t("Avisos da Learnia", "Learnia notifications")}</span>
              </div>
              <div className="max-h-96 overflow-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted">{t("Nenhum aviso por enquanto.", "No notifications yet.")}</p>
                ) : (
                  notifications.map((item) => (
                    <div key={item.intervention_id} className="border-b border-line px-4 py-3 last:border-0">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="k">{noticeTypeLabel(item.tipo, lang)}</span>
                        <button
                          onClick={() => dismiss(item.intervention_id)}
                          className="text-muted transition hover:text-ink"
                          aria-label={t(`Dispensar aviso: ${noticeTypeLabel(item.tipo, lang)}`, `Dismiss notification: ${noticeTypeLabel(item.tipo, lang)}`)}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                      {item.descricao && <p className="mt-1 text-sm text-ink">{stripCompetencyMarker(item.descricao)}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Plano 6 (C3.7): menu da conta — privacidade (LGPD/GDPR) e sair. */}
        <div
          ref={accountRef}
          className="relative"
          onKeyDown={(e) => { if (e.key === "Escape" && showAccount) { e.preventDefault(); setShowAccount(false); } }}
        >
          <button
            onClick={() => setShowAccount((value) => !value)}
            aria-expanded={showAccount}
            aria-controls="account-menu"
            aria-label={t(`Conta de ${studentName}`, `${studentName}'s account`)}
            className="flex h-9 items-center gap-1.5 rounded border border-line-strong pl-1 pr-2 text-ink transition-colors duration-rapido hover:bg-surface-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-sm font-semibold text-on-ink" aria-hidden="true">
              {studentName.charAt(0).toUpperCase()}
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {showAccount && (
            <div id="account-menu" className="absolute right-0 top-12 z-30 w-64 overflow-hidden card shadow-soft">
              <div className="border-b border-line px-4 py-3">
                <div className="k k-muted">{t("Conectado como", "Signed in as")}</div>
                <div className="mt-0.5 font-semibold text-ink">{studentName}</div>
              </div>
              {/* Idioma no menu da conta em telas estreitas (o segmentado some no header). */}
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:hidden">
                <span className="text-sm text-muted">{t("Idioma", "Language")}</span>
                <LangSwitch />
              </div>
              <button
                onClick={() => { setShowAccount(false); onChangeView("privacidade"); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-ink transition-colors duration-rapido hover:bg-surface-2"
              >
                <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" /> {t("Privacidade e dados", "Privacy & data")}
              </button>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-muted transition-colors duration-rapido hover:bg-surface-2 hover:text-ink"
              >
                <LogOut size={18} aria-hidden="true" /> {t("Sair", "Sign out")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
