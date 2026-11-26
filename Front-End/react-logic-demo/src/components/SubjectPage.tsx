/*
Plano 6 (B.1) — página da MATÉRIA (#/materia/:id), 2º nível do modelo Canvas:
os módulos da matéria em ordem, com o estado de cada um, os resultados de
aprendizagem (competências) da matéria e o atalho para a prática personalizada.

Identidade "Relevo": os módulos são marcos de uma trilha (concluído ✓, em curso ◐,
não iniciado em pontilhado); as competências são o TERRENO da matéria — morros com
a cota do professor (DomainMountains).
*/
import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react";
import { OvaState, StudentProfile } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { plural } from "../services/format";
import { groupBySubject, moduleProgress } from "./CoursesHome";
import { Explorador } from "./brand/Explorador";
import { TopoMap } from "./brand/TopoMap";
import { DomainMountains, kindOf, masteryOf } from "./ui/DomainMountains";
import { Elev, Lab, StatusIcon, StatusTag } from "./ui/Relevo";

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
  const atGoal = outcomes.filter((c) => kindOf(c) === "ok").length;

  if (!group) {
    return (
      <div className="card p-6 text-muted">
        {t("Matéria não encontrada.", "Course not found.")}{" "}
        <button onClick={onBack} className="font-semibold text-trail-text underline underline-offset-[3px]">{t("Voltar", "Back")}</button>
      </div>
    );
  }

  const done = group.ovas.filter((o) => o.completed).length;

  return (
    <section className="space-y-8">
      <div className="card relative overflow-hidden">
        <TopoMap variant="faixa" className="opacity-80" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <button
              onClick={onBack}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line-strong bg-surface text-ink transition-colors duration-rapido hover:bg-surface-2"
              aria-label={t("Voltar para Minhas matérias", "Back to My courses")}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <div>
              <p className="k">{t("Matéria", "Course")}</p>
              <h1 className="h-display mt-1.5 text-ink">{group.nome}</h1>
              <p className="num mt-2 text-[12px] text-muted">
                {t(
                  `${done} de ${group.ovas.length} ${group.ovas.length === 1 ? "módulo concluído" : "módulos concluídos"}`,
                  `${done} of ${group.ovas.length} ${group.ovas.length === 1 ? "module" : "modules"} completed`
                )}
                {outcomes.length > 0 && ` · ${t(`${atGoal} de ${outcomes.length} na cota`, `${atGoal} of ${outcomes.length} at goal`)}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="h-sec text-ink">{t("Módulos", "Modules")}</h2>
            <span className="k k-muted">{plural(group.ovas.length, lang, ["módulo", "módulos"], ["module", "modules"])}</span>
          </div>
          {/* Trilha: um marco por módulo, ligados por uma linha vertical. */}
          <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-line-strong/50">
            {group.ovas.map((ova, index) => {
              const perc = moduleProgress(ova);
              const activities = ova.recursos.filter((r) => r.tipo === "atividade");
              const activitiesDone = activities.filter((r) => r.concluido).length;
              const started = perc > 0;
              return (
                <li key={ova.ova_id} className="relative">
                  <button
                    onClick={() => onOpenModule(ova)}
                    className="card group flex w-full items-center justify-between gap-4 p-4 pl-3 text-left transition-colors duration-rapido hover:border-ink"
                  >
                    <span className="flex min-w-0 items-center gap-4">
                      <span
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold num ${
                          ova.completed
                            ? "border-mata bg-mata text-on-ink"
                            : started
                              ? "border-ink bg-surface text-ink"
                              : "border-dashed border-line-strong bg-surface text-muted"
                        }`}
                        aria-hidden="true"
                      >
                        {ova.completed ? <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4"><StatusIcon kind="ok" /></span> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{ova.ova_name}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
                          {ova.completed ? (
                            <StatusTag kind="ok">{t("Concluído", "Completed")}</StatusTag>
                          ) : started ? (
                            <StatusTag kind="mid">{t(`${perc}% lido`, `${perc}% read`)}</StatusTag>
                          ) : (
                            <span className="num text-[11.5px] uppercase tracking-[0.06em]">{t("Não iniciado", "Not started")}</span>
                          )}
                          {activities.length > 0 && (
                            <span className="num flex items-center gap-1 text-[12px]">
                              <ListChecks size={14} aria-hidden="true" />
                              {t(`${activitiesDone}/${activities.length} atividades`, `${activitiesDone}/${activities.length} activities`)}
                            </span>
                          )}
                        </span>
                        {started && !ova.completed && <Elev value={perc} small className="mt-3 max-w-[280px]" />}
                      </span>
                    </span>
                    <ArrowRight
                      className="shrink-0 text-ink transition-transform duration-medio ease-subida group-hover:translate-x-1"
                      size={18}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="h-fit space-y-4">
          <div className="card p-5">
            <Lab as="h2">
              <span>{t("Resultados de aprendizagem", "Learning outcomes")}</span>
              <span>{t("domínio", "mastery")}</span>
            </Lab>
            {outcomes.length > 0 ? (
              <DomainMountains
                peaks={outcomes.map((c) => ({ id: c.competency_id, nome: c.nome, valor: masteryOf(c), kind: kindOf(c) }))}
              />
            ) : (
              <p className="text-sm text-muted">{t("Nenhum resultado cadastrado.", "No outcomes yet.")}</p>
            )}
          </div>

          {needsPractice && (
            <div className="card flex items-start gap-4 p-5">
              <Explorador estado="encorajando" size={64} />
              <div className="min-w-0">
                <p className="k">{t("Prática personalizada", "Personalized practice")}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">
                  {t("A Learnia monta uma trilha curta com o que você mais errou nesta matéria.",
                     "Learnia builds a short path around what you missed most in this course.")}
                </p>
                <button onClick={onOpenPractice} className="btn btn-acc btn-sm mt-3">
                  {t("Ver trilha de reforço", "See practice path")}
                  <ArrowRight size={16} className="arw" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};
