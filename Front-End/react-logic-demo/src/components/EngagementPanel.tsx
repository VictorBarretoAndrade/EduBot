/*
E.4 (Plano 2) — Painel de engajamento da turma (tutor).

Mostra a participação no ranking, a distribuição de sequências, o XP médio da
semana, os alunos prestes a perder a sequência (alvo de intervenção de 1 clique)
e a validação ANTES×DEPOIS (dias ativos/aluno em duas janelas de 28 dias) — o
gate honesto: a gamificação mexeu o ponteiro?
*/
import { AlertCircle, Bot, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { TutorEngagement, getTutorEngagement } from "../services/api";
import { useT } from "../i18n";
import { RelevoLoader } from "./brand/RelevoLoader";

export const EngagementPanel = () => {
  const t = useT();
  const [data, setData] = useState<TutorEngagement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTutorEngagement()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="flex justify-center py-6"><RelevoLoader size={32} /></div>
    );
  }
  if (!data) return null;

  const { antes_depois: ad } = data;
  const delta = Math.round((ad.dias_ativos_depois - ad.dias_ativos_antes) * 100) / 100;
  const dist = data.distribuicao_sequencia;
  const buckets: [string, string][] = [["0", t("0 dias", "0 days")], ["1-2", "1-2"], ["3-6", "3-6"], ["7+", "7+"]];

  return (
    <div className="card p-6">
      <h2 className="lab">
        <span>{t("Engajamento da turma", "Class engagement")}</span>
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-line bg-bg p-4">
          <div className="k k-muted">{t("Participam do ranking", "On the leaderboard")}</div>
          <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-ink [font-variant-numeric:tabular-nums]">
            {data.participacao_ranking.opt_in}/{data.participacao_ranking.total}
          </div>
        </div>
        <div className="rounded border border-line bg-bg p-4">
          <div className="k k-muted">{t("XP médio/semana", "Avg XP/week")}</div>
          <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-ink [font-variant-numeric:tabular-nums]">{data.xp_medio_semana}</div>
        </div>
        <div className="rounded border border-line bg-bg p-4">
          <div className="k k-muted flex items-center gap-1"><TrendingUp size={14} /> {t("Dias ativos/aluno", "Active days/student")}</div>
          <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-ink [font-variant-numeric:tabular-nums]">
            {ad.dias_ativos_depois}
            <span className={`ml-2 text-sm font-semibold ${delta >= 0 ? "text-mata" : "text-trail-text"}`}>
              {delta >= 0 ? "+" : ""}{delta} {t("vs. 4 sem. antes", "vs. 4 wks before")}
            </span>
          </div>
        </div>
      </div>

      {/* distribuição de sequências */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-ink">{t("Distribuição de sequências", "Streak distribution")}</p>
        <div className="flex gap-2">
          {buckets.map(([k, label]) => (
            <div key={k} className="flex-1 rounded border border-line p-2 text-center">
              <div className="num text-lg font-semibold text-ink">{dist[k] ?? 0}</div>
              <div className="num text-[11px] text-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* EX.4 — uso do companheiro de estudo (o personagem está ajudando ou sendo ignorado?) */}
      {data.companheiro && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Bot size={16} className="text-ink" /> {t("Companheiro de estudo", "Study companion")}
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded border border-line p-3 text-center">
              <div className="num text-lg font-semibold text-ink">
                {data.companheiro.alunos_ativos}/{data.companheiro.total_alunos}
              </div>
              <div className="num text-[11px] text-muted">{t("usaram (28d)", "used it (28d)")}</div>
            </div>
            <div className="rounded border border-line p-3 text-center">
              <div className="num text-lg font-semibold text-ink">{data.companheiro.secoes_ouvidas_semana}</div>
              <div className="num text-[11px] text-muted">{t("seções ouvidas/sem.", "sections listened/wk")}</div>
            </div>
            <div className="rounded border border-line p-3 text-center">
              <div className="num text-lg font-semibold text-ink">{data.companheiro.explicacoes_semana}</div>
              <div className="num text-[11px] text-muted">{t("explicações/sem.", "explanations/wk")}</div>
            </div>
            <div className="rounded border border-line p-3 text-center">
              <div className="num text-lg font-semibold text-ink">{data.companheiro.falas_ouvidas_semana}</div>
              <div className="num text-[11px] text-muted">{t("falas ouvidas/sem.", "voice clips played/wk")}</div>
            </div>
          </div>
        </div>
      )}

      {/* alunos prestes a perder a sequência */}
      {data.em_risco.length > 0 && (
        <div className="mt-4 rounded border border-line-strong bg-surface-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <AlertCircle size={16} /> {t("Prestes a perder a sequência", "About to lose their streak")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.em_risco.map((s) => (
              <span key={s.student_id} className="rounded bg-surface px-3 py-1 text-sm text-ink">
                {s.nome} · 🔥 {s.sequencia}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
