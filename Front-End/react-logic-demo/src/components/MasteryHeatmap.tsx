/*
D.6 — Heatmap turma × competência (domínio estimado por BKT). Grid colorido
simples (sem lib nova): cada célula é um div com escala de cor por p_mastery.
Vermelho = frágil (<0.4), âmbar = em desenvolvimento (0.4–0.8), verde = domina.
*/
import { Grid3x3, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { MasteryColumn, MasteryRow, getTutorMastery } from "../services/api";
import { useT } from "../i18n";

function cellColor(p: number | null): string {
  if (p == null) return "bg-slate-100 text-slate-400";
  if (p >= 0.8) return "bg-emerald-500 text-white";
  if (p >= 0.6) return "bg-emerald-300 text-emerald-900";
  if (p >= 0.4) return "bg-amber-300 text-amber-900";
  if (p >= 0.2) return "bg-rose-300 text-rose-900";
  return "bg-rose-500 text-white";
}

export const MasteryHeatmap = () => {
  const t = useT();
  const [cols, setCols] = useState<MasteryColumn[] | null>(null);
  const [rows, setRows] = useState<MasteryRow[]>([]);

  useEffect(() => {
    getTutorMastery()
      .then((d) => {
        setCols(d.competencias);
        setRows(d.matriz);
      })
      .catch(() => setCols([]));
  }, []);

  return (
    <div className="rounded-[8px] border border-line bg-white p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <Grid3x3 size={20} className="text-brand" />
        <h2 className="text-xl font-bold text-ink">{t("Domínio da turma", "Class mastery")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t("Domínio estimado (BKT) por aluno e competência. Vermelho pede atenção; verde domina.",
           "Estimated mastery (BKT) per student and competency. Red needs attention; green mastered.")}
      </p>

      {cols === null ? (
        <div className="flex justify-center py-6"><LoaderCircle className="animate-spin text-brand" size={20} /></div>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-[8px] bg-slate-50 p-4 text-sm text-muted">
          {t("Ainda não há dados de domínio da turma.", "No class mastery data yet.")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-2 py-1 text-left font-semibold text-muted">
                  {t("Aluno", "Student")}
                </th>
                {cols.map((c) => (
                  <th key={c.competency_id} className="px-1 py-1 text-center align-bottom">
                    <div className="mx-auto max-w-[64px] truncate text-xs font-semibold text-muted" title={c.nome}>
                      {c.nome}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {c.media != null ? `${Math.round(c.media * 100)}%` : "—"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id}>
                  <td className="sticky left-0 bg-white px-2 py-1 font-medium text-ink">{r.nome}</td>
                  {r.celulas.map((cell) => (
                    <td key={cell.competency_id} className="p-0">
                      <div
                        className={`flex h-8 min-w-[44px] items-center justify-center rounded-[6px] text-xs font-bold ${cellColor(cell.p_mastery)}`}
                        title={cell.status ?? t("sem dados", "no data")}
                      >
                        {cell.p_mastery != null ? Math.round(cell.p_mastery * 100) : "–"}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
