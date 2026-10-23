/*
Plano 6 (B.1) — página da MATÉRIA (#/materia/:id), 2º nível do modelo Canvas:
os módulos da matéria em ordem, com o estado de cada um, os resultados de
aprendizagem (competências) da matéria e o atalho para a prática personalizada.
*/
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed, ListChecks, Stars } from "lucide-react";
import { OvaState, StudentProfile } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { competencyStatusLabel } from "../services/labels";
import { groupBySubject, moduleProgress } from "./CoursesHome";

interface SubjectPageProps {
  profile: StudentProfile;
  subjectId: number;
  onBack: () => void;
  onOpenModule: (ova: OvaState) => void;
  onOpenPractice: () => void;
}

export const SubjectPage = ({ profile, subjectId, onBack, onOpenModule, onOpenPractice }: SubjectPageProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const group = groupBySubject(profile, profile.estudante.curso ?? "").find((g) => g.subject_id === subjectId);
  const outcomes = profile.competencias.filter((c) => (c.subject_id ?? 0) === subjectId);
  const needsPractice = outcomes.some((c) => c.status !== "desenvolvida" && (c.tentativas ?? 0) > 0);

  if (!group) {
    return (
      <div className="rounded-[8px] border border-line bg-white p-6 text-muted">
        {t("Matéria não encontrada.", "Course not found.")}{" "}
        <button onClick={onBack} className="font-semibold text-brand">{t("Voltar", "Back")}</button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-line bg-white text-ink transition hover:bg-slate-50"
          aria-label={t("Voltar para Minhas matérias", "Back to My courses")}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <p className="font-semibold text-brand">{t("Matéria", "Course")}</p>
          <h1 className="text-3xl font-bold text-ink">{group.nome}</h1>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          <h2 className="mb-3 text-xl font-bold text-ink">{t("Módulos", "Modules")}</h2>
          <ol className="space-y-3">
            {group.ovas.map((ova, index) => {
              const perc = moduleProgress(ova);
              const activities = ova.recursos.filter((r) => r.tipo === "atividade");
              const activitiesDone = activities.filter((r) => r.concluido).length;
              const state = ova.completed
                ? t("Concluído", "Completed")
                : perc > 0
                  ? t(`${perc}% lido`, `${perc}% read`)
                  : t("Não iniciado", "Not started");
              return (
                <li key={ova.ova_id}>
                  <button
                    onClick={() => onOpenModule(ova)}
                    className="flex w-full items-center justify-between gap-4 rounded-[8px] border border-line bg-white p-5 text-left shadow-sm transition hover:border-brand"
                  >
                    <span className="flex min-w-0 items-center gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-bold text-brand">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-ink">{ova.ova_name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                          <span className="flex items-center gap-1">
                            {ova.completed
                              ? <CheckCircle2 size={15} className="text-teal" aria-hidden="true" />
                              : <CircleDashed size={15} aria-hidden="true" />}
                            {state}
                          </span>
                          {activities.length > 0 && (
                            <span className="flex items-center gap-1">
                              <ListChecks size={15} aria-hidden="true" />
                              {t(`${activitiesDone}/${activities.length} atividades`, `${activitiesDone}/${activities.length} activities`)}
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="shrink-0 text-brand" size={20} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-[8px] border border-line bg-white p-5">
            <h2 className="font-bold text-ink">{t("Resultados de aprendizagem", "Learning outcomes")}</h2>
            <ul className="mt-4 space-y-4">
              {outcomes.map((c) => {
                const mastery = c.dominio_estimado != null
                  ? Math.round(c.dominio_estimado * 100)
                  : c.total_questoes ? Math.round((100 * c.acertos) / c.total_questoes) : 0;
                return (
                  <li key={c.competency_id}>
                    <div className="mb-1.5 flex justify-between gap-3 text-sm">
                      <span className="font-semibold text-ink">{c.nome}</span>
                      <span className="shrink-0 text-muted">{competencyStatusLabel(c.status, lang)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100" aria-hidden="true">
                      <div className="h-2 rounded-full bg-teal" style={{ width: `${Math.max(mastery, c.status === "não iniciada" ? 0 : 4)}%` }} />
                    </div>
                  </li>
                );
              })}
              {outcomes.length === 0 && <li className="text-sm text-muted">{t("Nenhum resultado cadastrado.", "No outcomes yet.")}</li>}
            </ul>
          </div>

          {needsPractice && (
            <div className="rounded-[8px] border border-brand/30 bg-indigo-50/60 p-5">
              <p className="flex items-center gap-2 font-bold text-brand">
                <Stars size={18} aria-hidden="true" /> {t("Prática personalizada", "Personalized practice")}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {t("O Engage-Agent monta uma trilha curta com o que você mais errou nesta matéria.",
                   "Engage-Agent builds a short path around what you missed most in this course.")}
              </p>
              <button
                onClick={onOpenPractice}
                className="mt-3 h-10 rounded-[8px] bg-brand px-4 text-sm font-semibold text-white transition hover:bg-indigo-600"
              >
                {t("Praticar agora", "Practice now")}
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};
