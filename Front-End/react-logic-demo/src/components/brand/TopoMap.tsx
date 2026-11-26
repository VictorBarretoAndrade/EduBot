/*
Identidade "Relevo" — curvas de nível de fundo (decorativas, aria-hidden).

Linhas em Curva (a cada 5, a curva mestra, um tom mais forte), deriva lenta de
60 s (vai e volta). Opcionalmente desenha a trilha do aluno até o cume, com o
ponto atual pulsando como sinal de GPS. Com "reduzir movimento", tudo parado.
As curvas vêm de relevoTopo.ts (gerado por design/relevo/gerador/build_app.py).
*/
import { TOPO_FAIXA, TOPO_LOGIN, TRILHA_LOGIN, type Curva } from "./relevoTopo";

const SETS: Record<"login" | "faixa", { curvas: Curva[]; w: number; h: number }> = {
  login: { curvas: TOPO_LOGIN, w: 1200, h: 900 },
  faixa: { curvas: TOPO_FAIXA, w: 1200, h: 260 }
};

interface TopoMapProps {
  variant?: "login" | "faixa";
  /** Desenha a trilha pontilhada até o cume (só no mapa de entrada). */
  trilha?: boolean;
  className?: string;
}

export const TopoMap = ({ variant = "faixa", trilha = false, className = "" }: TopoMapProps) => {
  const { curvas, w, h } = SETS[variant];
  const pts = TRILHA_LOGIN;
  const d = "M" + pts.map(([x, y]) => `${x} ${y}`).join(" L");
  const [cx, cy] = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      className={`topo pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      <g className="deriva">
        {curvas.map((c, i) => (
          <path key={i} d={c.d} className={c.em ? "em" : undefined} />
        ))}
      </g>
      {trilha && variant === "login" && (
        <g>
          <path d={d} fill="none" stroke="rgb(var(--trail))" strokeWidth="6" strokeDasharray="0.1 15" strokeLinecap="round" />
          {pts.slice(1, -1).map(([x, y], i) =>
            i % 2 === 1 ? <circle key={i} cx={x} cy={y} r="5" fill="rgb(var(--surface))" stroke="rgb(var(--ink))" strokeWidth="2" /> : null
          )}
          <circle cx={cx} cy={cy} r="20" fill="none" stroke="rgb(var(--trail))" strokeWidth="2" className="gps" />
          <circle cx={cx} cy={cy} r="9" fill="rgb(var(--trail))" stroke="rgb(var(--ink))" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
};
