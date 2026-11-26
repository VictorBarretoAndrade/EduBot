/*
Identidade "Relevo" — peças pequenas do guia (design/relevo/guia.html, "Componentes").

  <StatusTag kind="ok|mid|low">  status com FORMA e PALAVRA: ✓ na meta, ◐ você está
                                 aqui, ▲ abaixo da meta. A cor reforça; nunca é o único sinal.
  <Elev value={0..100} />        régua de elevação: o avanço sobe em Trilha.
  <Lab>Título<span>apoio</span></Lab>  rótulo de cartão em Geist Mono.
*/
import type { ReactNode } from "react";

export type StatusKind = "ok" | "mid" | "low";

export const StatusIcon = ({ kind }: { kind: StatusKind | "lock" }) => {
  if (kind === "ok")
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    );
  if (kind === "mid")
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </svg>
    );
  if (kind === "lock")
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2l6.5 12h-13z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 6.5v3.5M8 11.6v.4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

export const StatusTag = ({ kind, children, className = "" }: { kind: StatusKind; children: ReactNode; className?: string }) => (
  <span className={`tag tag-${kind} ${className}`}>
    <StatusIcon kind={kind} />
    {children}
  </span>
);

/** Régua de elevação. `meta` pinta o avanço em Mata (competência na cota). */
export const Elev = ({ value, meta = false, small = false, className = "" }: { value: number; meta?: boolean; small?: boolean; className?: string }) => (
  <div className={`elev ${small ? "elev-sm" : ""} ${meta ? "na-meta" : ""} ${className}`} aria-hidden="true">
    <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const Lab = ({ children, className = "", as: As = "div", id }: { children: ReactNode; className?: string; as?: "div" | "h2" | "h3"; id?: string }) => (
  <As id={id} className={`lab ${className}`}>
    {children}
  </As>
);
