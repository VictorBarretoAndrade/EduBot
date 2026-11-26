/*
MELHORIA (Roteiro Cena 4) — Painel do Tutor / Gestão Pedagógica.

Visão de turma + Central de Alertas preventivos. O botão "Analisar turma" roda
as regras do EduBot no servidor (POST /tutor/evaluate) e gera os alertas dos
alunos em risco — o beat "o Engage-Agent envia o plano de retomada e alerta o tutor".
*/
import { AlertTriangle, Bell, Check, Copy, KeyRound, LoaderCircle, RefreshCw, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { StudentRisk, TurmaStudent, TutorAlert, ackTutorAlert, evaluateTurma, getTurma, getTutorAlerts, tutorResetPassword } from "../services/api";
import { useToast } from "./ui/Toast";
import { MasteryHeatmap } from "./MasteryHeatmap";
import { ApprovalQueue } from "./ApprovalQueue";
import { AgentKpi } from "./AgentKpi";
import { EngagementPanel } from "./EngagementPanel";
import { AddStudentForm } from "./demoMode/AddStudentForm";
import { useLanguage, useT } from "../i18n";
import { RelevoLoader } from "./brand/RelevoLoader";
import { StatusIcon } from "./ui/Relevo";
import { levelLabel, noticeTypeLabel } from "../services/labels";

const severityStyle: Record<string, string> = {
  // Relevo: severidade pelo filete à esquerda (Trilha = alta); o texto fica legível.
  alta: "border-line border-l-2 border-l-trail bg-surface text-ink",
  media: "border-line border-l-2 border-l-ink bg-surface text-ink",
  baixa: "border-line bg-bg text-ink"
};

type Translate = (pt: string, en: string) => string;

// Fase 3 — nomes dos componentes do risco. Cada um pede uma ação diferente do
// professor: "sumiu" se resolve com contato, "errando" com reforço.
export const motivoLabel = (motivo: string, t: Translate): string => {
  if (motivo === "inatividade") return t("sumiu", "inactive");
  if (motivo === "erro_quiz") return t("errando", "high error rate");
  if (motivo === "dominio_caindo") return t("esquecendo", "forgetting");
  if (motivo === "revisoes_vencidas") return t("revisões", "overdue reviews");
  if (motivo === "consumo_baixo") return t("pouco estudo", "low engagement");
  return motivo;
};

/** Texto do tooltip: a composição inteira do score, para o professor auditar. */
export const riscoDetalhe = (risco: StudentRisk, t: Translate): string => {
  const partes = Object.entries(risco.componentes)
    .sort(([, a], [, b]) => b - a)
    .map(([motivo, peso]) => `${motivoLabel(motivo, t)}: ${peso}`);
  return partes.length
    ? `${t("Risco", "Risk")} ${risco.score}/100 — ${partes.join(" · ")}`
    : t("Sem sinais de risco", "No risk signals");
};

// `demo` (migration 026): coordenador do modo DEMO — libera "Adicionar aluno".
export const TutorPanel = ({ demo = false }: { demo?: boolean }) => {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const { lang } = useLanguage();
  const [alunos, setAlunos] = useState<TurmaStudent[]>([]);
  const [alertas, setAlertas] = useState<TutorAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const toast = useToast();

  const load = () =>
    Promise.all([getTurma(), getTutorAlerts()])
      .then(([turma, al]) => {
        setAlunos(turma.alunos);
        setAlertas(al.alertas);
      })
      .catch(() => toast.error(t("Não foi possível carregar o painel da turma.", "Couldn't load the class panel.")))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analisar = async () => {
    setEvaluating(true);
    try {
      const { alertas_criados } = await evaluateTurma();
      toast.success(
        alertas_criados > 0
          ? t(`${alertas_criados} ${alertas_criados === 1 ? "novo alerta gerado" : "novos alertas gerados"} pela Learnia.`, `${alertas_criados} new ${alertas_criados === 1 ? "alert" : "alerts"} from Learnia.`)
          : t("Análise concluída — nenhum aluno novo em zona de risco.", "Analysis complete — no new at-risk students.")
      );
      await load();
    } catch {
      toast.error(t("Não foi possível rodar a análise da turma.", "Couldn't run the class analysis."));
    } finally {
      setEvaluating(false);
    }
  };

  // A.4: marca o alerta como tratado. Atualiza o estado local (read=true) para
  // sair da contagem de abertos sem recarregar o painel inteiro.
  // Plano 6: "Esqueci minha senha" — a senha temporária aparece UMA vez, aqui.
  const [tempPasswords, setTempPasswords] = useState<Record<number, string>>({});
  const [resetting, setResetting] = useState<number | null>(null);
  const resetPassword = (alertId: number) => {
    setResetting(alertId);
    tutorResetPassword(alertId)
      .then((r) => {
        setTempPasswords((cur) => ({ ...cur, [alertId]: r.senha_temporaria }));
        setAlertas((current) => current.map((a) => (a.alert_id === alertId ? { ...a, read: true } : a)));
      })
      .catch(() => toast.error(t("Não foi possível gerar a senha agora.", "Couldn't create the password right now.")))
      .finally(() => setResetting(null));
  };

  const treat = (alertId: number) => {
    setAlertas((current) => current.map((a) => (a.alert_id === alertId ? { ...a, read: true } : a)));
    ackTutorAlert(alertId).catch(() =>
      toast.error(t("Não foi possível marcar o alerta como tratado.", "Couldn't mark the alert as handled."))
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <RelevoLoader size={44} />
      </div>
    );
  }

  const alertasAbertos = alertas.filter((a) => !a.read).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="k k-muted">{t("Painel do professor", "Teacher dashboard")}</p>
          <h1 className="h-display mt-2 text-ink">{t("Minha turma", "My class")}</h1>
          <p className="mt-2 text-muted">{t("Acompanhe a turma e os alertas preventivos da Learnia.", "Monitor your class and early alerts from Learnia.")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {demo && (
            <button
              onClick={() => setAdding(true)}
              aria-expanded={adding}
              className="btn btn-gh"
            >
              <UserPlus size={18} aria-hidden="true" /> {t("Adicionar aluno", "Add student")}
            </button>
          )}
          <button
            onClick={analisar}
            disabled={evaluating}
            className="btn btn-pri"
          >
            {evaluating ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            {t("Analisar turma", "Analyze class")}
          </button>
        </div>
      </div>

      {demo && adding && <AddStudentForm onClose={() => setAdding(false)} onCreated={load} />}

      {/* KPIs rápidos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="k k-muted flex items-center justify-between">{t("Alunos ativos", "Active students")} <Users size={16} strokeWidth={1.8} /></div>
          <div className="mt-3 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink [font-variant-numeric:tabular-nums]">{alunos.length}</div>
        </div>
        <div className="card p-5">
          <div className="k k-muted flex items-center justify-between">{t("Alertas abertos", "Open alerts")} <Bell size={16} strokeWidth={1.8} /></div>
          <div className="mt-3 text-[34px] font-bold leading-none tracking-[-0.04em] text-trail-text [font-variant-numeric:tabular-nums]">{alertasAbertos}</div>
        </div>
        <div className="card p-5">
          <div className="k k-muted flex items-center justify-between">{t("Em risco", "At risk")} <AlertTriangle size={16} strokeWidth={1.8} /></div>
          <div className="mt-3 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink [font-variant-numeric:tabular-nums]">
            {/* Fase 3: risco COMPOSTO, calculado no backend (erro + ausência +
                esquecimento + revisões + consumo). A regra antiga (taxa_erro >
                50%) não via o aluno que sumiu — quem não tenta, não erra.
                Fallback para a regra antiga se o backend for anterior à Fase 3. */}
            {alunos.filter((a) => a.risco?.em_risco ?? (a.taxa_erro ?? 0) > 0.5).length}
          </div>
        </div>
      </div>

      {/* B.5 — fila de aprovação das ações propostas pelo agente */}
      <ApprovalQueue />

      {/* B.6 — KPI do agente (taxa de aceitação por tipo) */}
      <AgentKpi />

      {/* E.4 — engajamento da turma + validação antes×depois da gamificação */}
      <EngagementPanel />

      {/* D.6 — heatmap turma × competência (domínio por BKT) */}
      <MasteryHeatmap />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Tabela da turma */}
        <div className="overflow-hidden card">
          <div className="lab mb-0 border-b border-line px-5 py-3.5">
            <span>{t("Alunos", "Students")}</span>
            {/* Plano 5 (19.4): a linha abre o detalhe do aluno. */}
            <span>{t("clique para ver o detalhe", "click for details")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="k k-muted bg-bg text-[10.5px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t("Aluno", "Student")}</th>
                  <th className="px-3 py-3 font-semibold">{t("Consumo", "Progress")}</th>
                  <th className="px-3 py-3 font-semibold">{t("Erro quiz", "Error rate")}</th>
                  <th className="px-3 py-3 font-semibold">{t("Sem acesso", "Inactive")}</th>
                  <th className="px-3 py-3 font-semibold">{t("Risco", "Risk")}</th>
                  <th className="px-3 py-3 font-semibold">{t("Alertas", "Alerts")}</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a) => {
                  // Plano 5 (19.4): navega para o detalhe via hash (#/aluno/:id),
                  // reaproveitando o roteador por hash do App.
                  const abrir = () => { window.location.hash = `#/aluno/${a.student_id}`; };
                  return (
                  <tr
                    key={a.student_id}
                    onClick={abrir}
                    className="cursor-pointer border-t border-line transition hover:bg-surface-2"
                  >
                    <td className="px-5 py-3 font-semibold text-ink">
                      {/* Botão = alvo focável por teclado (Enter/Espaço). O onClick
                          da linha é só conveniência do mouse (mesmo destino). */}
                      <button
                        onClick={(e) => { e.stopPropagation(); abrir(); }}
                        className="rounded text-left font-semibold text-ink underline-offset-2 hover:underline focus-visible:underline"
                        aria-label={t(`Ver desempenho de ${a.nome}`, `View ${a.nome}'s performance`)}
                      >
                        {a.nome}
                      </button>{" "}
                      <span className="font-normal text-muted">· {t("RA", "ID")} {a.ra}</span>
                    </td>
                    <td className="num px-3 py-3">{a.consumo_percentual}%</td>
                    <td className="px-3 py-3">
                      {a.taxa_erro != null ? (
                        <span className={(a.taxa_erro > 0.5 ? "text-trail-text" : "text-ink") + " num font-semibold"}>
                          {Math.round(a.taxa_erro * 100)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num px-3 py-3">{a.dias_sem_acesso != null ? `${a.dias_sem_acesso}d` : "—"}</td>
                    <td className="px-3 py-3">
                      {a.risco ? (
                        <span
                          className={
                            "tag " +
                            (a.risco.em_risco ? "tag-low" : a.risco.score > 0 ? "tag-mid" : "tag-ok")
                          }
                          // O motivo principal é o que diz ao professor COMO
                          // agir: sumiu, está esquecendo ou está errando.
                          title={riscoDetalhe(a.risco, t)}
                        >
                          <StatusIcon kind={a.risco.em_risco ? "low" : a.risco.score > 0 ? "mid" : "ok"} />
                          {a.risco.score}
                          {a.risco.principal && <span>· {motivoLabel(a.risco.principal, t)}</span>}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {a.alertas_abertos > 0 ? (
                        <span className="tag tag-low">
                          {a.alertas_abertos}
                        </span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {alunos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-muted">
                      {t("Nenhum aluno com atividade ainda nesta turma.", "No students with activity in this class yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Central de alertas */}
        <aside className="card p-5">
          <h2 className="lab">
            <span>{t("Central de alertas", "Alert center")}</span>
            <span>{alertasAbertos} {t("abertos", "open")}</span>
          </h2>
          <div className="space-y-3">
            {alertas.length === 0 && (
              <p className="text-sm text-muted">
                {t("Sem alertas. Clique em", "No alerts. Click")} <strong>"{t("Analisar turma", "Analyze class")}"</strong> {t("para a Learnia avaliar os alunos.", "for Learnia to evaluate the students.")}
              </p>
            )}
            {alertas.map((al) => (
              <div key={al.alert_id} className={`rounded border p-3 ${al.read ? "border-line bg-bg text-muted" : severityStyle[al.severity] ?? severityStyle.baixa}`}>
                <div className="k flex items-center justify-between">
                  <span>{noticeTypeLabel(al.type, lang)}</span>
                  <span>{levelLabel(al.severity, lang)}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{al.message}</p>
                {tempPasswords[al.alert_id] && (
                  <div role="status" className="mt-2 rounded border border-mata/50 bg-mata/10 p-2.5 text-sm text-mata">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {t("Senha temporária:", "Temporary password:")}{" "}
                        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-base font-bold tracking-wider">{tempPasswords[al.alert_id]}</code>
                      </span>
                      <button
                        onClick={() => navigator.clipboard?.writeText(tempPasswords[al.alert_id]).then(() => toast.success(t("Copiada.", "Copied.")))}
                        aria-label={t("Copiar senha temporária", "Copy temporary password")}
                        className="rounded p-1 transition hover:bg-surface"
                      >
                        <Copy size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs">
                      {t("Entregue ao aluno pessoalmente. Ela só aparece agora.", "Give it to the student in person. It's only shown now.")}
                    </p>
                  </div>
                )}
                <div className="mt-2 flex justify-end">
                  {al.type === "redefinir_senha" && !al.read ? (
                    <button
                      onClick={() => resetPassword(al.alert_id)}
                      disabled={resetting === al.alert_id}
                      className="btn btn-gh btn-sm"
                    >
                      {resetting === al.alert_id
                        ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                        : <KeyRound size={14} aria-hidden="true" />}
                      {t("Gerar senha temporária", "Create temporary password")}
                    </button>
                  ) : al.read ? (
                    <span className="tag tag-ok">
                      <StatusIcon kind="ok" /> {t("Tratado", "Handled")}
                    </span>
                  ) : (
                    <button
                      onClick={() => treat(al.alert_id)}
                      className="btn btn-gh btn-sm"
                    >
                      <Check size={14} /> {t("Marcar como tratado", "Mark as handled")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};
