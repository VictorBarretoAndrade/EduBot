/*
Identidade "Relevo" — tema dos gráficos (Recharts).

As cores são os tokens (rgb(var(--x))), então os gráficos trocam de tema sozinhos.
Regra do guia: a Trilha marca o caminho, a meta e o que está abaixo dela; Basalto é
a série principal; Mata é "na meta". Eixos e rótulos em Geist Mono; a grade é linha
fina; cantos quase retos (2 px) nas barras.
*/
export const C = {
  ink: "rgb(var(--ink))",
  muted: "rgb(var(--muted))",
  trail: "rgb(var(--trail))",
  trailText: "rgb(var(--trail-text))",
  mata: "rgb(var(--mata))",
  line: "rgb(var(--line))",
  lineStrong: "rgb(var(--line-strong))",
  surface: "rgb(var(--surface))",
  surface2: "rgb(var(--surface-2))",
  contourEm: "rgb(var(--contour-em))"
};

export const axisTick = { fontSize: 11, fill: C.muted, fontFamily: "var(--font-mono)" };
export const axisProps = { tick: axisTick, stroke: C.lineStrong, tickLine: false };
export const gridProps = { stroke: C.line, strokeDasharray: "0", vertical: false };
export const barRadius: [number, number, number, number] = [2, 2, 0, 0];

export const tooltipProps = {
  contentStyle: {
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 4,
    boxShadow: "0 12px 32px -16px rgb(0 0 0 / .25)",
    fontSize: 13,
    color: C.ink
  },
  labelStyle: { fontFamily: "var(--font-mono)", fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  itemStyle: { color: C.ink },
  cursor: { fill: C.surface2 }
};

export const legendProps = {
  iconType: "square" as const,
  iconSize: 10,
  wrapperStyle: { fontFamily: "var(--font-mono)", fontSize: 11, color: C.muted }
};

/** Linha da cota (meta do professor): tracejada em Trilha, com rótulo mono. */
export const cotaLineProps = (value: number, label: string) => ({
  y: value,
  stroke: C.trail,
  strokeDasharray: "6 5",
  strokeWidth: 1.6,
  label: { value: label, position: "insideTopRight" as const, fill: C.trailText, fontSize: 11, fontFamily: "var(--font-mono)" }
});
