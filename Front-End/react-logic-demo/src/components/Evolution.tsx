/*
INTEGRAÇÃO — "Meu progresso" a partir do perfil real (GET /student/me):
placar de acertos/erros por MATÉRIA e por RESULTADO DE APRENDIZAGEM + gráficos.
Plano 5: os gráficos foram extraídos para <PerformanceCharts>, reusado no detalhe
do aluno visto pelo professor (TutorStudentDetail) — sem duplicar o Recharts.

Plano 6 (B.2): absorve as métricas do antigo Dashboard e o histórico de
sugestões do antigo Professor Mediador, organizados em 3 abas internas para a
página deixar de ser uma pilha de 7 blocos.
*/
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ClipboardCheck, Timer, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { MasteryTrendItem, StudentProfile, getMasteryTrend } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { PerformanceCoach } from "./PerformanceCoach";
import { ReviewsPanel } from "./ReviewsPanel";
import { GamificationSection } from "./Gamification";
import { CompetencyScores } from "./CompetencyScores";
import { SubjectScores } from "./SubjectScores";
import { PerformanceCharts } from "./PerformanceCharts";
import { noticeTypeLabel } from "../services/labels";
import { formatDate } from "../services/format";
import { stripCompetencyMarker } from "../services/reinforcementTarget";

interface EvolutionProps {
  profile: StudentProfile;
}

type Tab = "resumo" | "materias" | "conquistas";

// Relevo: número grande (Geist 700, algarismos de largura fixa) e rótulo em mono.
const Metric = ({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) => (
  <div className="card p-5">
    <div className="k k-muted flex items-center justify-between gap-2">
      {label}
      <Icon size={16} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden="true" />
    </div>
    <div className="mt-3 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink [font-variant-numeric:tabular-nums]">{value}</div>
  </div>
);

export const Evolution = ({ profile }: EvolutionProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const [tab, setTab] = useState<Tab>("resumo");
  // H.1 (Plano 2) — tendência de domínio (setas): só aparece após o backend
  // acumular snapshots diários; vazio no começo é esperado (degrada em silêncio).
  const [trend, setTrend] = useState<MasteryTrendItem[]>([]);
  useEffect(() => {
    getMasteryTrend().then((r) => setTrend(r.trend)).catch(() => setTrend([]));
  }, [lang]);
  const rising = trend.filter((x) => x.direcao !== "flat");

  const totalReadMinutes = Math.round(profile.ovas.reduce((sum, ova) => sum + (ova.read_time || 0), 0) / 60);
  const quizScore = profile.quiz.taxa_erro != null ? `${Math.round((1 - profile.quiz.taxa_erro) * 100)}%` : "—";
  const allResources = profile.ovas.flatMap((ova) => ova.recursos);
  const completedActivities = allResources.filter((r) => r.tipo === "atividade" && r.concluido).length;
  const totalActivities = allResources.filter((r) => r.tipo === "atividade").length;

  const tabs: { id: Tab; pt: string; en: string }[] = [
    { id: "resumo", pt: "Resumo", en: "Overview" },
    { id: "materias", pt: "Por matéria", en: "By course" },
    { id: "conquistas", pt: "Conquistas", en: "Achievements" }
  ];

  return (
    <section>
      <p className="k k-muted">{t("Seu relevo", "Your terrain")}</p>
      <h1 className="h-display mt-2 text-ink">{t("Meu progresso", "My progress")}</h1>
      <p className="mt-2 text-muted">{t("Como você está indo em cada matéria.", "How you're doing in each course.")}</p>

      <div role="tablist" aria-label={t("Seções de Meu progresso", "My progress sections")} className="mt-6 flex flex-wrap gap-2 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 font-semibold transition-colors duration-rapido ${
              tab === item.id ? "border-trail text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t(item.pt, item.en)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6 space-y-6">
        {tab === "resumo" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label={t("Tempo de leitura", "Reading time")} value={`${totalReadMinutes} min`} icon={Timer} />
              <Metric label={t("Atividades concluídas", "Activities completed")} value={`${completedActivities}/${totalActivities}`} icon={ClipboardCheck} />
              <Metric label={t("Acerto nos quizzes", "Quiz accuracy")} value={quizScore} icon={Trophy} />
              <Metric label={t("Conteúdo concluído", "Content completed")} value={`${profile.recursos.percentual_consumido}%`} icon={TrendingUp} />
            </div>

            {/* Personagem do Engage-Agent falando sobre o progresso (Cena 3) */}
            <PerformanceCoach profile={profile} />

            {/* D.3 — agenda de revisão espaçada */}
            <ReviewsPanel />

            {/* C.2 — histórico de sugestões (antes no Professor Mediador) */}
            <div className="card p-6">
              <h2 className="lab">
                <span>{t("Histórico de sugestões", "Suggestion history")}</span>
                <span>{t("rastro do tutor", "tutor trail")}</span>
              </h2>
              <ul className="-mx-6 divide-y divide-line border-t border-line">
                {profile.historico_intervencoes.map((item, index) => (
                  <li key={`${item.data}-${index}`} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted">
                      <span className="k">{noticeTypeLabel(item.tipo, lang)}</span>
                      <span className="num">{formatDate(item.data, lang)}</span>
                    </div>
                    {item.descricao && <p className="mt-2 text-sm text-ink">{stripCompetencyMarker(item.descricao)}</p>}
                  </li>
                ))}
                {profile.historico_intervencoes.length === 0 && (
                  <li className="px-6 py-4 text-sm text-muted">
                    {t("Ainda não há sugestões. Estude e responda aos quizzes — a Learnia vai sugerir os próximos passos.",
                       "No suggestions yet. Study and take the quizzes — Learnia will suggest your next steps.")}
                  </li>
                )}
              </ul>
            </div>
          </>
        )}

        {tab === "materias" && (
          <>
            {/* Placar cru de acertos x erros: primeiro a visão macro por MATÉRIA
                (Plano 5), depois o detalhe por resultado de aprendizagem. */}
            <SubjectScores competencias={profile.competencias} />
            <CompetencyScores competencias={profile.competencias} />

            {/* Gráficos (Recharts) — a "Tendência (7 dias)" entra no slot do card da teia. */}
            <PerformanceCharts
              profile={profile}
              radarExtra={
                rising.length > 0 ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <p className="k k-muted mb-2">{t("Tendência · 7 dias", "Trend · 7 days")}</p>
                    <div className="flex flex-wrap gap-2">
                      {rising.map((x) => {
                        const up = x.direcao === "up";
                        const pts = Math.round(Math.abs(x.delta) * 100);
                        return (
                          <span
                            key={x.competency_id}
                            className={`tag ${up ? "tag-ok" : "tag-low"}`}
                            aria-label={t(
                              `${x.competencia}: ${up ? "subiu" : "caiu"} ${pts} pontos`,
                              `${x.competencia}: ${up ? "up" : "down"} ${pts} points`
                            )}
                          >
                            {up ? <TrendingUp size={15} aria-hidden="true" /> : <TrendingDown size={15} aria-hidden="true" />}
                            {x.competencia} {up ? "+" : "−"}{pts}%
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : undefined
              }
            />
          </>
        )}

        {tab === "conquistas" && <GamificationSection studentName={profile.estudante.nome} />}
      </div>
    </section>
  );
};
