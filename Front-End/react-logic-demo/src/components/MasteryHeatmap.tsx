/*
D.6 — Heatmap turma × competência (domínio estimado por BKT). Grid colorido
simples (sem lib nova): cada célula é um div com escala de cor por p_mastery.
Relevo: abaixo de 40 = Trilha com ▲ (pede atenção), 40–80 = neutro (a caminho),
na cota (≥ 80, limiar do BKT) = Mata com ✓. A cor reforça; o número e o símbolo
são o sinal (nunca só a cor).
*/
import { useEffect, useState } from "react";
import { MasteryColumn, MasteryRow, getTutorMastery } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { RelevoLoader } from "./brand/RelevoLoader";
import { competencyStatusLabel } from "../services/labels";

function cellColor(p: number | null): string {
  if (p == null) return "border border-dashed border-line-strong/50 text-muted";
  if (p >= 0.8) return "bg-mata text-on-ink";
  if (p >= 0.6) return "bg-surface-2 text-ink ring-1 ring-inset ring-line-strong/40";
  if (p >= 0.4) return "bg-surface-2 text-ink";
  if (p >= 0.2) return "bg-trail/20 text-trail-text";
  return "bg-trail text-on-trail";
}

const cellMark = (p: number | null) => (p == null ? "" : p >= 0.8 ? "✓ " : p < 0.4 ? "▲ " : "");

export const MasteryHeatmap = () => {
  const t = useT();
  const { lang } = useLanguage();
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

  // Plano 5: agrupa as colunas por ASSUNTO (as competências vêm ordenadas por
  // disciplina do backend). Vira uma linha de cabeçalho que spania as colunas.
  const hasSubjects = !!cols?.some((c) => c.subject_nome);
  const subjectGroups: { key: string; nome: string; count: number }[] = [];
  for (const c of cols ?? []) {
    const nome = c.subject_nome ?? "";
    const last = subjectGroups[subjectGroups.length - 1];
    if (last && last.nome === nome) last.count += 1;
    else subjectGroups.push({ key: `${c.subject_id ?? "x"}-${subjectGroups.length}`, nome, count: 1 });
  }

  return (
    <div className="card p-6">
      <h2 className="lab">
        <span>{t("Domínio da turma", "Class mastery")}</span>
        <span>{t("aluno × competência · cota 80", "student × outcome · goal 80")}</span>
      </h2>
      <p className="-mt-1 text-sm text-muted">
        {t("Domínio estimado (BKT). ▲ abaixo de 40 pede atenção; ✓ chegou à cota.",
           "Estimated mastery (BKT). ▲ below 40 needs attention; ✓ reached the goal.")}
      </p>

      {cols === null ? (
        <div className="flex justify-center py-6"><RelevoLoader size={32} /></div>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded bg-bg p-4 text-sm text-muted">
          {t("Ainda não há dados de domínio da turma.", "No class mastery data yet.")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-1 text-sm">
            <thead>
              {/* Linha de ASSUNTOS: cada disciplina spania as colunas das suas
                  competências (agrupa o que antes ficava "jogado"). */}
              {hasSubjects && (
                <tr>
                  <th className="sticky left-0 bg-surface" aria-hidden="true" />
                  {subjectGroups.map((sg) => (
                    <th
                      key={sg.key}
                      colSpan={sg.count}
                      className="k k-muted border-b border-line-strong px-1 pb-1 text-center"
                    >
                      {sg.nome}
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                <th className="sticky left-0 bg-surface px-2 py-1 text-left align-bottom font-semibold text-muted">
                  {t("Aluno", "Student")}
                </th>
                {cols.map((c) => (
                  <th key={c.competency_id} className="px-1 py-1 text-center align-bottom">
                    <div className="mx-auto max-w-[64px] truncate text-xs font-semibold text-muted" title={c.nome}>
                      {c.nome}
                    </div>
                    <div className="num text-[11px] text-muted">
                      {c.media != null ? `${Math.round(c.media * 100)}%` : "—"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id}>
                  <td className="sticky left-0 bg-surface px-2 py-1 font-medium text-ink">{r.nome}</td>
                  {r.celulas.map((cell) => (
                    <td key={cell.competency_id} className="p-0">
                      <div
                        className={`num flex h-8 min-w-[48px] items-center justify-center rounded-sm text-[12px] font-semibold ${cellColor(cell.p_mastery)}`}
                        title={cell.status ? competencyStatusLabel(cell.status, lang) : t("sem dados", "no data")}
                      >
                        {cell.p_mastery != null ? `${cellMark(cell.p_mastery)}${Math.round(cell.p_mastery * 100)}` : "–"}
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
