/*
Identidade "Relevo" — "Domínio por competência" (guia, seção Componentes).

Cada competência é um morro: a altitude é o domínio (0–100), a linha tracejada em
Trilha é a COTA — a meta. No produto a cota é o limiar do BKT para "desenvolvida"
(services/mastery.py: DEVELOPED_THRESHOLD = 0.80 → 80). Status com forma e palavra:
na cota (✓, Mata), perto (◐) e abaixo (▲, Trilha). Os morros sobem da base, um por
vez (--ease-subida); com "reduzir movimento", aparecem prontos.
*/
import { useId } from "react";
import type { CompetencyState } from "../../services/api";
import { useT } from "../../i18n";
import { StatusIcon, type StatusKind } from "./Relevo";

export const COTA = 80;
export const COTA_PERTO = 40; // services/mastery.py: DEVELOPING_THRESHOLD

/** Domínio 0–100 de uma competência (BKT quando houver; senão, taxa de acerto). */
export const masteryOf = (c: Pick<CompetencyState, "dominio_estimado" | "total_questoes" | "acertos">) =>
  c.dominio_estimado != null
    ? Math.round(c.dominio_estimado * 100)
    : c.total_questoes
      ? Math.round((100 * c.acertos) / c.total_questoes)
      : 0;

/** ok = na cota · mid = a caminho · low = abaixo, pede reforço · null = não iniciada. */
export const kindOf = (c: Pick<CompetencyState, "status" | "dominio_estimado" | "total_questoes" | "acertos" | "tentativas">): StatusKind | null => {
  // total_questoes é o total de questões DA competência (não as respondidas): o que diz
  // se o aluno começou é ter tentativa ou acerto registrado.
  if (c.status === "não iniciada" && !c.tentativas && !c.acertos) return null;
  const v = masteryOf(c);
  if (c.status === "desenvolvida" || v >= COTA) return "ok";
  if (v >= COTA_PERTO) return "mid";
  return "low";
};

export interface Peak {
  id: string | number;
  nome: string;
  valor: number;
  kind: StatusKind | null;
}

export const DomainMountains = ({ peaks, cota = COTA, className = "" }: { peaks: Peak[]; cota?: number; className?: string }) => {
  const t = useT();
  const uid = useId().replace(/:/g, "");
  const n = Math.max(peaks.length, 1);
  const step = n <= 4 ? 128 : n <= 6 ? 100 : 80;
  const half = step <= 80 ? 44 : step <= 100 ? 58 : 76;
  const w = Math.max(400, n * step + 24);
  const h = 196;
  const base = h - 8;
  const top = 26;
  const y = (v: number) => base - ((base - top) * v) / 100;
  const x0 = (w - n * step) / 2 + step / 2;
  const label = t(
    `Domínio por competência: ${peaks.map((p) => `${p.nome} ${p.valor}`).join("; ")}; cota ${cota}`,
    `Mastery by outcome: ${peaks.map((p) => `${p.nome} ${p.valor}`).join("; ")}; goal ${cota}`
  );

  return (
    // Largura máxima = tamanho natural do desenho (não estica em telas largas);
    // os nomes em HTML usam a mesma largura e ficam alinhados com os morros.
    <div className={`mx-auto w-full ${className}`} style={{ maxWidth: Math.min(w, 620) }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="mts block h-auto w-full" role="img" aria-label={label}>
        <defs>
          {peaks.map((p, i) => {
            const cx = x0 + i * step;
            const py = y(Math.max(p.valor, 3));
            const d = `M${cx - half} ${base} C${cx - half * 0.55} ${base} ${cx - half * 0.37} ${py} ${cx} ${py} C${cx + half * 0.37} ${py} ${cx + half * 0.55} ${base} ${cx + half} ${base} Z`;
            return (
              <clipPath key={p.id} id={`mc-${uid}-${i}`}>
                <path d={d} />
              </clipPath>
            );
          })}
        </defs>
        {peaks.map((p, i) => {
          const cx = x0 + i * step;
          const py = y(Math.max(p.valor, 3));
          const d = `M${cx - half} ${base} C${cx - half * 0.55} ${base} ${cx - half * 0.37} ${py} ${cx} ${py} C${cx + half * 0.37} ${py} ${cx + half * 0.55} ${base} ${cx + half} ${base} Z`;
          return (
            <g key={p.id} className={`mt ${p.kind ?? "none"}`} style={{ ["--i" as string]: i }}>
              <path d={d} className="body" />
              <g clipPath={`url(#mc-${uid}-${i})`} className="cl">
                {Array.from({ length: 12 }, (_, k) => (k + 1) * 8).map((v) => (
                  <line key={v} x1="0" x2={w} y1={y(v)} y2={y(v)} />
                ))}
              </g>
              <text x={cx} y={py - 9} className="pv">
                {p.kind == null ? "—" : p.valor}
              </text>
            </g>
          );
        })}
        <line x1="8" x2={w - 8} y1={y(cota)} y2={y(cota)} className="goal" />
        <text x={w - 8} y={y(cota) - 7} className="gl">
          {t(`cota ${cota}`, `goal ${cota}`)}
        </text>
        <line x1="0" x2={w} y1={base} y2={base} className="base" />
      </svg>
      {/* Nomes em HTML (quebram linha; o SVG não). Uma coluna por morro. */}
      <ul className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {peaks.map((p) => (
          <li key={p.id} className="min-w-0 text-center">
            <span className="line-clamp-2 text-[12px] leading-snug text-muted" title={p.nome}>
              {p.nome}
            </span>
            {p.kind && (
              <span className={`mt-1 inline-flex items-center gap-1 num text-[10.5px] uppercase tracking-[0.06em] ${p.kind === "ok" ? "text-mata" : p.kind === "low" ? "text-trail-text" : "text-ink"}`}>
                <span className="inline-block h-3 w-3 [&>svg]:h-3 [&>svg]:w-3">
                  <StatusIcon kind={p.kind} />
                </span>
                {p.kind === "ok" ? t("na cota", "at goal") : p.kind === "mid" ? t("a caminho", "on the way") : t("abaixo", "below")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
