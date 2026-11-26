/*
Identidade "Relevo" — carregamento: curvas de nível se abrindo a partir do cume
(2,4 s, contínuo). Para esperas acima de 400 ms. Com "reduzir movimento" fica
parado; o texto (visível ou sr-only) mantém o sentido.
*/
import { RING_OUTER } from "./LearniaLogo";

interface RelevoLoaderProps {
  size?: number;
  /** Título visível ao lado (ex.: "Lendo o seu rastro…"). Sem ele, vira sr-only. */
  label?: string;
  /** Linha de apoio em mono, abaixo do título. */
  hint?: string;
  className?: string;
}

export const RelevoLoader = ({ size = 48, label, hint, className = "" }: RelevoLoaderProps) => (
  <div className={`flex items-center gap-4 ${className}`} role="status">
    <div className="ripple" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        {[0, 1, 2].map((i) => (
          <path key={i} d={RING_OUTER} style={{ ["--i" as string]: i }} />
        ))}
        <circle cx="26.5" cy="24" r="3" />
      </svg>
    </div>
    {label ? (
      <div>
        <b className="block font-semibold text-ink">{label}</b>
        {hint && <small className="num text-[11.5px] text-muted">{hint}</small>}
      </div>
    ) : (
      <span className="sr-only">{hint ?? "…"}</span>
    )}
  </div>
);
