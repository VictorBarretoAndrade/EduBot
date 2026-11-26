/*
Identidade "Relevo" — controles da barra superior, iguais aos da home:
  - LangSwitch: segmentado PT | EN (Geist Mono, o ativo em Basalto);
  - ThemeToggle: sol/lua. Tema do sistema por padrão; a escolha fica lembrada em
    localStorage["learnia-tema"] (mesma chave da home, então vale nos dois).
*/
import { useEffect, useState } from "react";
import { useLanguage, useT } from "../../i18n";
import { safeGet, safeSet } from "../../services/storage";

const THEME_KEY = "learnia-tema";

const systemDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
const currentDark = () => {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : systemDark();
};

export const LangSwitch = ({ className = "" }: { className?: string }) => {
  const { lang, setLang } = useLanguage();
  const t = useT();
  const btn = (value: "pt" | "en", label: string, htmlLang: string) => (
    <button
      type="button"
      lang={htmlLang}
      aria-pressed={lang === value}
      onClick={() => setLang(value)}
      className={`num px-2.5 py-1.5 text-[12px] font-medium uppercase tracking-[0.06em] transition-colors duration-rapido ${
        lang === value ? "bg-ink text-on-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t("Idioma", "Language")} className={`inline-flex overflow-hidden rounded border border-line-strong ${className}`}>
      {btn("pt", "PT", "pt-BR")}
      {btn("en", "EN", "en")}
    </div>
  );
};

export const ThemeToggle = ({ className = "" }: { className?: string }) => {
  const t = useT();
  const [dark, setDark] = useState(currentDark);

  // Acompanha o sistema enquanto o usuário não escolheu um tema.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => setDark(currentDark());
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    safeSet("local", THEME_KEY, next);
    setDark(!dark);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t("Mudar para o modo claro", "Switch to light mode") : t("Mudar para o modo escuro", "Switch to dark mode")}
      title={dark ? t("Modo claro", "Light mode") : t("Modo escuro", "Dark mode")}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded border border-line-strong text-ink transition-colors duration-rapido hover:bg-surface-2 ${className}`}
    >
      {dark ? (
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path d="M15.5 12.6A6.6 6.6 0 0 1 7.4 4.5 6.6 6.6 0 1 0 15.5 12.6Z" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="3.6" />
          <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" />
        </svg>
      )}
    </button>
  );
};

/** Lê o tema salvo (para quem precisar saber antes do primeiro render). */
export const savedTheme = () => safeGet("local", THEME_KEY);
