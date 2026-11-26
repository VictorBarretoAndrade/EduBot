/*
Plano 5 (20.3) — Painel do GESTOR: "tudo que o sistema consegue medir" da turma.

Consolida numa só tela, com números reais agregados:
  - KPIs da turma (alunos ativos, em risco, alertas, consumo, acertos/erros);
  - acertos × erros POR ASSUNTO (gráfico + números brutos), do /tutor/overview;
  - domínio da turma (heatmap BKT) e engajamento — reuso dos painéis existentes;
  - um CATÁLOGO do que é rastreado hoje (com a contagem real de registros) e do
    que ainda NÃO é rastreado — transparência para os gerentes do projeto.

A11y: cada bloco é uma região com heading; os números aparecem sempre em texto
(não só dentro do gráfico); nada depende só de cor.
*/
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { AlertTriangle, Bell, CheckCircle2, Gauge, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { TutorOverview, getTutorOverview } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { resourceTypeLabel } from "../services/labels";
import { formatNumber } from "../services/format";
import { MasteryHeatmap } from "./MasteryHeatmap";
import { C, axisProps, barRadius, gridProps, legendProps, tooltipProps } from "./ui/chartTheme";
import { RelevoLoader } from "./brand/RelevoLoader";
import { EngagementPanel } from "./EngagementPanel";

// Catálogo: chave vinda do backend (rastreamento) -> rótulo amigável. Tudo aqui
// PERSISTE no banco (é justamente o que o sistema já grava).
const CATALOGO: { key: string; pt: string; en: string }[] = [
  { key: "interacoes", pt: "Interações (scroll, clique, vídeo)", en: "Interactions (scroll, click, video)" },
  { key: "ova_progress", pt: "Progresso por módulo (tempo e % de leitura)", en: "Module progress (time and % read)" },
  { key: "progresso_recursos", pt: "Consumo de recursos (vídeo/podcast/atividade)", en: "Resource progress (video/podcast/activity)" },
  { key: "tentativas_quiz", pt: "Tentativas de quiz (certas e erradas)", en: "Quiz attempts (correct and incorrect)" },
  { key: "eventos_aprendizado", pt: "Eventos de aprendizado (login, tutor, mídia)", en: "Learning events (sign-in, AI chat, media)" },
  { key: "linhas_mastery", pt: "Domínio estimado por competência (BKT)", en: "Estimated mastery per learning outcome (BKT)" },
  // Fase 2 do Plano de Rastreabilidade — leitura por seção do OVA.
  { key: "leitura_por_secao", pt: "Leitura por seção do módulo (onde o aluno travou)", en: "Reading by module section (where students get stuck)" },
  { key: "consentimentos", pt: "Consentimentos LGPD", en: "GDPR/LGPD consents" }
];

// O que ainda NÃO é rastreado (honestidade com o gestor — ver PROJETO.md).
// "% de vídeo efetivamente assistido" SAIU desta lista na Fase 1: passou a ser
// medido de verdade (tempo assistido + cobertura da linha do tempo).
const NAO_RASTREADO: { pt: string; en: string }[] = [
  { pt: "Submissão e correção de atividades práticas", en: "Hands-on activity submission and grading" }
];

interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  alerta?: boolean;
}
const Kpi = ({ icon, label, value, alerta }: KpiProps) => (
  <div className="card p-5">
    <div className="k k-muted flex items-center justify-between gap-2">{label} <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span></div>
    <div className={`mt-3 text-[34px] font-bold leading-none tracking-[-0.04em] [font-variant-numeric:tabular-nums] ${alerta ? "text-trail-text" : "text-ink"}`}>{value}</div>
  </div>
);

export const ManagerDashboard = () => {
  const t = useT();
  const { lang } = useLanguage();
  const [data, setData] = useState<TutorOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getTutorOverview().then(setData).catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="rounded border border-trail/40 bg-trail/10 p-6 text-trail-text" role="alert">
        {t("Não foi possível carregar a visão do gestor.", "Couldn't load the program overview.")}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <RelevoLoader size={44} />
        <span className="sr-only" role="status">{t("Carregando", "Loading")}</span>
      </div>
    );
  }

  const kLabel = t("acertos", "correct");
  const eLabel = t("erros", "incorrect");
  const assuntoChart = data.por_assunto.map((s) => ({
    nome: s.subject_nome.length > 16 ? `${s.subject_nome.slice(0, 16)}…` : s.subject_nome,
    [kLabel]: s.acertos,
    [eLabel]: s.erros
  }));
  const aproveitamento = data.quiz.tentativas
    ? Math.round((100 * data.quiz.acertos) / (data.quiz.acertos + data.quiz.erros))
    : null;

  return (
    <section className="space-y-6">
      <div>
        <p className="k k-muted">{t("Coordenação", "Program coordination")}</p>
        <h1 className="h-display mt-2 text-ink">{t("Visão do Gestor", "Program Coordinator Overview")}</h1>
        <p className="mt-2 text-muted">
          {t("Tudo que o sistema consegue medir da turma, com números reais.", "Everything the platform measures across the class, with live data.")}
        </p>
      </div>

      {/* KPIs da turma */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Users size={18} />} label={t("Alunos ativos", "Active students")} value={String(data.turma.alunos_ativos)} />
        <Kpi icon={<AlertTriangle size={18} />} label={t("Em risco", "At risk")} value={String(data.turma.em_risco)} alerta={data.turma.em_risco > 0} />
        <Kpi icon={<Bell size={18} />} label={t("Alertas abertos", "Open alerts")} value={String(data.turma.alertas_abertos)} alerta={data.turma.alertas_abertos > 0} />
        <Kpi icon={<Gauge size={18} />} label={t("Consumo médio", "Average progress")} value={`${data.consumo.percentual_medio}%`} />
      </div>

      {/* Acertos x erros totais da turma (número cru) */}
      <div className="card p-6">
        <h2 className="lab">{t("Quiz da turma", "Class quiz performance")}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-line bg-bg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={22} className="text-mata" aria-hidden="true" />
            <span className="text-2xl font-bold text-mata">{data.quiz.acertos}</span>
            <span className="text-sm text-muted">{t("acertos", "correct")}</span>
          </div>
          <span className="text-muted" aria-hidden="true">|</span>
          <div className="flex items-center gap-2">
            <XCircle size={22} className="text-trail-text" aria-hidden="true" />
            <span className="text-2xl font-bold text-trail-text">{data.quiz.erros}</span>
            <span className="text-sm text-muted">{t("erros", "incorrect")}</span>
          </div>
          {aproveitamento !== null && (
            <>
              <span className="text-muted" aria-hidden="true">|</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-ink">{aproveitamento}%</span>
                <span className="text-sm text-muted">{t("de aproveitamento", "accuracy")}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Acertos x erros POR ASSUNTO — gráfico + números brutos */}
      <div className="card p-6">
        <h2 className="lab">{t("Acertos e erros por assunto (turma)", "Correct and incorrect answers by course (class)")}</h2>
        {data.por_assunto.length === 0 ? (
          <p className="mt-4 rounded bg-bg p-4 text-sm text-muted">
            {t("Ainda não há respostas registradas nesta turma.", "No answers recorded in this class yet.")}
          </p>
        ) : (
          <>
            <div className="mt-5 h-72">
              <ResponsiveContainer>
                <BarChart data={assuntoChart}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="nome" interval={0} {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip {...tooltipProps} />
                  <Legend {...legendProps} />
                  <Bar dataKey={kLabel} fill={C.ink} radius={barRadius} />
                  <Bar dataKey={eLabel} fill={C.trail} radius={barRadius} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Números brutos (o gráfico é o resumo; aqui vem a tabela exata) */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">{t("Assunto", "Course")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("Acertos", "Correct")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("Erros", "Incorrect")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("Aproveitamento", "Accuracy")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("Domínio médio", "Avg. mastery")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.por_assunto.map((s) => {
                    const resp = s.acertos + s.erros;
                    const perc = resp ? Math.round((100 * s.acertos) / resp) : null;
                    return (
                      <tr key={s.subject_id} className="border-t border-line">
                        <td className="py-2 pr-4 font-semibold text-ink">{s.subject_nome}</td>
                        <td className="py-2 pr-4 text-mata">{s.acertos}</td>
                        <td className="py-2 pr-4 text-trail-text">{s.erros}</td>
                        <td className="py-2 pr-4 font-semibold text-ink">{perc != null ? `${perc}%` : "—"}</td>
                        <td className="py-2 pr-4">{s.dominio_medio != null ? `${Math.round(s.dominio_medio * 100)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Reuso: domínio da turma (heatmap BKT) + engajamento */}
      <MasteryHeatmap />
      <EngagementPanel />

      {/* Fase 1 — consumo REAL de vídeo. A métrica anterior era a posição
          máxima do player: um seek para o fim marcava 100% sem assistir nada. */}
      {data.video && data.video.segundos_assistidos > 0 && (
        <div className="card p-6">
          <h2 className="lab">{t("Vídeo — consumo real", "Video — actual watch time")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("Cobertura é o trecho do vídeo efetivamente percorrido (pular à frente não conta).",
               "Coverage is the portion of the video actually played through (skipping ahead doesn't count).")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-2xl font-bold text-ink">{data.video.cobertura_media}%</div>
              <div className="k k-muted">{t("cobertura média", "average coverage")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-ink">
                {Math.round(data.video.segundos_assistidos / 60)} min
              </div>
              <div className="k k-muted">{t("assistidos pela turma", "watched by the class")}</div>
            </div>
            {data.video.ponto_abandono_medio != null && (
              <div>
                <div className="text-2xl font-bold text-ink">
                  {Math.floor(data.video.ponto_abandono_medio / 60)}m
                  {String(data.video.ponto_abandono_medio % 60).padStart(2, "0")}s
                </div>
                <div className="k k-muted">{t("ponto médio de abandono", "average drop-off point")}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fase 2 — onde a turma trava. Só aparece quando já há leitura por seção. */}
      {data.secoes_dificeis && data.secoes_dificeis.length > 0 && (
        <div className="card p-6">
          <h2 className="lab">{t("Onde a turma trava", "Where the class gets stuck")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("Seções com maior tempo de leitura e mais releituras — candidatas a revisão do conteúdo.",
               "Sections with the longest reading time and most re-reads — candidates for content revision.")}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">{t("Seção", "Section")}</th>
                  <th className="px-3 py-2 font-semibold">{t("Módulo", "Module")}</th>
                  <th className="px-3 py-2 font-semibold">{t("Alunos", "Students")}</th>
                  <th className="px-3 py-2 font-semibold">{t("Tempo médio", "Avg. time")}</th>
                  <th className="px-3 py-2 font-semibold">{t("Releituras", "Re-reads")}</th>
                </tr>
              </thead>
              <tbody>
                {data.secoes_dificeis.map((s) => (
                  <tr key={`${s.ova_id}-${s.section_id}`} className="border-t border-line">
                    <td className="px-4 py-2 font-semibold text-ink">{s.section_id}</td>
                    <td className="px-3 py-2 text-muted">{s.ova_nome}</td>
                    <td className="px-3 py-2">{s.alunos}</td>
                    <td className="px-3 py-2">
                      {Math.floor(s.segundos_medios / 60)}m{String(s.segundos_medios % 60).padStart(2, "0")}s
                    </td>
                    <td className="px-3 py-2">
                      <span className={s.releituras_por_aluno > 1 ? "font-bold text-ink" : "text-ink"}>
                        {s.releituras_por_aluno}×
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fase 4 (§6.2) — lacunas de conteúdo: competências que o reforço não
          consegue atender. É informação acionável para o GESTOR (trabalho
          editorial), não um erro de software. */}
      {data.lacunas_conteudo && data.lacunas_conteudo.length > 0 && (
        <div className="rounded border border-line-strong bg-surface-2 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
            <XCircle size={20} className="text-ink" aria-hidden="true" />
            {t("Lacunas de conteúdo para o reforço", "Content gaps for personalized practice")}
          </h2>
          <p className="mt-1 text-sm text-ink">
            {t("Estas competências não têm material suficiente para a Learnia montar um reforço eficaz: são necessárias ao menos 3 questões e 2 formatos de material.",
               "These learning outcomes don't have enough material for Learnia to build effective practice paths: at least 3 questions and 2 resource formats are needed.")}
          </p>
          <ul className="mt-4 space-y-2">
            {data.lacunas_conteudo.map((c) => (
              <li key={c.competency_id} className="rounded border border-line-strong bg-surface p-3 text-sm">
                <span className="font-semibold text-ink">{c.nome}</span>
                <span className="text-muted"> · {c.assunto}</span>
                <div className="mt-1 text-muted">
                  {c.questoes} {c.questoes === 1 ? t("questão", "question") : t("questões", "questions")}
                  {" · "}
                  {c.formatos.length > 0
                    ? `${t("formatos", "formats")}: ${c.formatos.map((f) => resourceTypeLabel(f, lang)).join(", ")}`
                    : t("nenhum material de reforço", "no practice material")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Catálogo de rastreamento — transparência com o gestor */}
      <div className="card p-6">
        <h2 className="lab">{t("O que o sistema rastreia", "What the platform tracks")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("Cada sinal com a contagem real de registros da turma. Tudo abaixo persiste no banco.",
             "Each learning signal and its live record count for this class.")}
        </p>
        <ul className="mt-4 divide-y divide-line">
          {CATALOGO.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-2 text-sm text-ink">
                <CheckCircle2 size={16} className="text-mata" aria-hidden="true" />
                {t(c.pt, c.en)}
              </span>
              <span className="shrink-0 text-sm">
                <strong className="text-ink">{formatNumber(data.rastreamento[c.key] ?? 0, lang)}</strong>{" "}
                <span className="text-muted">{t("registros", "records")}</span>
              </span>
            </li>
          ))}
        </ul>

        <h3 className="k mt-6 text-muted">
          {t("Ainda não rastreado", "Not tracked yet")}
        </h3>
        <ul className="mt-2 space-y-2">
          {NAO_RASTREADO.map((c) => (
            <li key={c.pt} className="flex items-center gap-2 text-sm text-muted">
              <XCircle size={16} className="text-muted" aria-hidden="true" />
              {t(c.pt, c.en)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
