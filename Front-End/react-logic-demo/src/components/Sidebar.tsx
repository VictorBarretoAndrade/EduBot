import { Award, BarChart3, Bell, BookOpen, CalendarDays, Grid2X2, Languages, LogOut, MessageCircle, Search, Stars, TrendingUp, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StudentProfile } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { useInterventions } from "../hooks/useInterventions";
import { EduBotLogo } from "./brand/EduBotLogo";

interface SidebarProps {
  activeView: string;
  onChangeView: (view: string) => void;
  studentName: string;
  role: string;
  onLogout: () => void;
}

// Cada item guarda o rótulo nos dois idiomas (traduzido no render)
const navItems = [
  { id: "dashboard", pt: "Dashboard", en: "Dashboard", icon: Grid2X2 },
  { id: "contents", pt: "Conteúdos", en: "Contents", icon: BookOpen },
  { id: "exercises", pt: "Atividades", en: "Activities", icon: CalendarDays },
  { id: "quiz", pt: "Quiz", en: "Quiz", icon: Award },
  { id: "reforco", pt: "Reforço", en: "Reinforcement", icon: Stars },
  { id: "evolution", pt: "Meu Desempenho", en: "My Performance", icon: BarChart3 },
  { id: "report", pt: "Professor Mediador", en: "Mediating Professor", icon: MessageCircle }
];

// Item exclusivo de tutor/admin (gestão pedagógica)
const tutorItem = { id: "tutor", pt: "Turma", en: "Class", icon: Users };

export const Sidebar = ({ activeView, onChangeView, studentName, role, onLogout }: SidebarProps) => {
  const t = useT();
  const items = role === "tutor" || role === "admin" ? [...navItems, tutorItem] : navItems;
  return (
    <aside className="hidden min-h-screen w-[340px] shrink-0 border-r border-line bg-white/70 lg:block">
      <div className="flex h-20 items-center gap-3 border-b border-line px-5">
        <EduBotLogo size={46} />
        <div>
          <div className="text-2xl font-bold leading-none text-ink">Adapta</div>
          <div className="mt-1 text-sm tracking-[0.18em] text-muted">LEARN · IA</div>
        </div>
      </div>

      <nav className="space-y-2 px-3 py-8">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex h-14 w-full items-center gap-4 rounded-[8px] px-5 text-left text-lg transition ${
                active ? "bg-indigo-50 text-indigo-800 shadow-soft" : "text-muted hover:bg-slate-50"
              }`}
            >
              <Icon size={22} />
              {t(item.pt, item.en)}
            </button>
          );
        })}
      </nav>

      {/* INTEGRAÇÃO (4.2): aluno logado real + logout */}
      <div className="mx-3 mt-auto border-t border-line px-2 py-6">
        <div className="px-3 text-sm text-muted">{t("Conectado como", "Signed in as")}</div>
        <div className="px-3 font-bold text-ink">{studentName}</div>
        <button
          onClick={onLogout}
          className="mt-3 flex h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-muted transition hover:bg-rose-50 hover:text-rose-700"
        >
          <LogOut size={20} />
          {t("Sair", "Sign out")}
        </button>
      </div>
    </aside>
  );
};

interface SearchResult {
  label: string;
  sub: string;
  view: string;
}

// MELHORIA — a busca e o sino deixaram de ser decorativos:
//  - busca: filtra OVAs, competências e seções e navega para a aba certa;
//  - sino: abre os avisos do EduBot (histórico de intervenções) com badge.
export const Topbar = ({
  profile,
  onChangeView
}: {
  profile: StudentProfile;
  onChangeView: (view: string) => void;
}) => {
  const t = useT();
  const { lang, toggle } = useLanguage();
  const [query, setQuery] = useState("");
  const [showNotif, setShowNotif] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fecha os popovers ao clicar fora deles
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setQuery("");
      if (notifRef.current && !notifRef.current.contains(target)) setShowNotif(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = query.trim().toLowerCase();
  const results = useMemo<SearchResult[]>(() => {
    if (!q) return [];
    const out: SearchResult[] = [];
    navItems.forEach((item) => {
      const label = t(item.pt, item.en);
      if (label.toLowerCase().includes(q)) out.push({ label, sub: t("Ir para a seção", "Go to section"), view: item.id });
    });
    profile.ovas.forEach((ova) => {
      if (ova.ova_name.toLowerCase().includes(q)) out.push({ label: ova.ova_name, sub: t("OVA · Conteúdos", "OVA · Contents"), view: "contents" });
    });
    profile.competencias.forEach((comp) => {
      if (comp.nome.toLowerCase().includes(q))
        out.push({ label: comp.nome, sub: t("Competência · Meu Desempenho", "Competency · My Performance"), view: "evolution" });
    });
    return out.slice(0, 8);
  }, [q, profile, t]);

  const pick = (view: string) => {
    onChangeView(view);
    setQuery("");
  };

  // E.2 — sino lê a MESMA fonte do card do dashboard (não lidas) via hook único.
  const { items: notifications, dismiss } = useInterventions();

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-line bg-slate-50/90 px-5 backdrop-blur">
      <div ref={searchRef} className="relative w-full max-w-[620px]">
        <div className="flex h-14 items-center gap-4 rounded-[8px] border border-line bg-slate-100 px-5 text-muted focus-within:border-brand">
          <Search size={24} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Buscar OVAs, competências, seções...", "Search OVAs, competencies, sections...")}
            className="w-full bg-transparent text-lg text-ink outline-none placeholder:text-muted"
          />
        </div>
        {q && (
          <div className="absolute left-0 right-0 top-16 z-30 overflow-hidden rounded-[8px] border border-line bg-white shadow-soft">
            {results.length === 0 ? (
              <div className="px-5 py-4 text-muted">{t("Nada encontrado para", "No results for")} “{query}”.</div>
            ) : (
              results.map((result, index) => (
                <button
                  key={`${result.view}-${index}`}
                  onClick={() => pick(result.view)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-line px-5 py-3 text-left transition last:border-0 hover:bg-slate-50"
                >
                  <span className="font-semibold text-ink">{result.label}</span>
                  <span className="text-xs text-muted">{result.sub}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-4 flex items-center gap-4">
        {/* Alternador de idioma PT/EN */}
        <button
          onClick={toggle}
          className="flex h-10 items-center gap-2 rounded-[8px] border border-line bg-white px-3 font-bold text-ink transition hover:bg-slate-50"
          aria-label={t("Trocar idioma", "Switch language")}
          title={t("Trocar idioma", "Switch language")}
        >
          <Languages size={18} className="text-brand" />
          {lang === "pt" ? "PT" : "EN"}
        </button>

        {/* INTEGRAÇÃO: o chip fake de "streak" virou o consumo real de recursos */}
        <div className="flex h-10 items-center gap-2 rounded-[8px] bg-coral px-4 font-bold text-white">
          <TrendingUp size={19} />
          {profile.recursos.percentual_consumido}% {t("consumido", "consumed")}
        </div>
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotif((value) => !value)}
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:bg-slate-50"
            aria-label={t("Avisos do EduBot", "EduBot notices")}
          >
            <Bell size={22} />
            {notifications.length > 0 && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500" />}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-14 z-30 w-80 overflow-hidden rounded-[8px] border border-line bg-white shadow-soft">
              <div className="border-b border-line px-4 py-3 font-bold text-ink">{t("Avisos do EduBot", "EduBot notices")}</div>
              <div className="max-h-96 overflow-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted">{t("Nenhum aviso por enquanto.", "No notices yet.")}</p>
                ) : (
                  notifications.map((item) => (
                    <div key={item.intervention_id} className="border-b border-line px-4 py-3 last:border-0">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="font-bold uppercase tracking-wide">{item.tipo}</span>
                        <button
                          onClick={() => dismiss(item.intervention_id)}
                          className="text-muted transition hover:text-ink"
                          aria-label={t("Dispensar", "Dismiss")}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {item.descricao && <p className="mt-1 text-sm text-slate-700">{item.descricao}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
