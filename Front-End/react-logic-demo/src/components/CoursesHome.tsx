/*
Plano 6 (B.1) — "Minhas matérias": a home do aluno no modelo Canvas.

Substitui o antigo Dashboard. Mostra, nesta ordem, o que o aluno precisa para
decidir o que estudar: continuar de onde parou, os cartões de MATÉRIA (cada um
leva aos seus módulos) e, à direita, a coluna "Para fazer" — o único lugar onde
o aluno age sobre o que o tutor sugeriu (C.2). Métricas detalhadas foram
para "Meu progresso".

Identidade "Relevo": cartão "Próximo passo" com régua de elevação, rastro da
semana em dados mono, cartões de matéria em Folha com borda de 1 px (sem
gradiente), o Explorador como tutor.
*/
import { ArrowRight, CalendarClock, Square, Volume2, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import {
  GamificationMe,
  OvaState,
  ReviewItem,
  StudentProfile,
  UnreadIntervention,
  ackIntervention,
  getEdubotRecommendation,
  getGamificationMe,
  getInterventions,
  getReviews
} from "../services/api";
import { useLanguage, useT } from "../i18n";
import { useSpeech } from "../hooks/useSpeech";
import { CompanionAvatar } from "./brand/CompanionAvatar";
import { Explorador } from "./brand/Explorador";
import { TopoMap } from "./brand/TopoMap";
import { Elev, Lab, StatusTag } from "./ui/Relevo";
import { REFORCO_COMP_KEY, competencyFromDescription, stripCompetencyMarker } from "../services/reinforcementTarget";
import { WeeklyGoalsCard } from "./Gamification";
import { safeSet } from "../services/storage";
import { noticeTypeLabel } from "../services/labels";
import { plural } from "../services/format";

export interface SubjectGroup {
  subject_id: number;
  nome: string;
  ovas: OvaState[];
}

// Agrupa os módulos por matéria, na ordem que o backend devolve (matéria, módulo).
// Backend antigo (sem subject_id) → uma matéria só, com o nome do curso.
export const groupBySubject = (profile: StudentProfile, fallbackName: string): SubjectGroup[] => {
  const groups: SubjectGroup[] = [];
  profile.ovas.forEach((ova) => {
    const id = ova.subject_id ?? 0;
    let group = groups.find((g) => g.subject_id === id);
    if (!group) {
      group = { subject_id: id, nome: ova.subject_nome ?? fallbackName, ovas: [] };
      groups.push(group);
    }
    group.ovas.push(ova);
  });
  return groups;
};

export const moduleProgress = (ova: OvaState) => Math.min(100, ova.completed ? 100 : ova.perc_scrolled || 0);

const subjectProgress = (group: SubjectGroup) =>
  group.ovas.length ? Math.round(group.ovas.reduce((sum, ova) => sum + moduleProgress(ova), 0) / group.ovas.length) : 0;

// Sequência, nível e XP da semana (some quando a gamificação está desligada).
const StreakChip = () => {
  const t = useT();
  const { lang } = useLanguage();
  const [me, setMe] = useState<GamificationMe | null>(null);
  useEffect(() => {
    getGamificationMe().then(setMe).catch(() => setMe(null));
  }, []);
  if (!me || !me.enabled) return null;
  // Relevo (voz): o histórico de estudo é o "rastro". Dados em mono, um por célula.
  const cell = (label: string, value: ReactNode) => (
    <div className="px-4 py-2.5">
      <div className="k k-muted text-[10.5px]">{label}</div>
      <div className="num mt-0.5 text-[17px] font-semibold text-ink">{value}</div>
    </div>
  );
  return (
    <div className="card flex divide-x divide-line">
      {cell(t("Rastro", "Trail"), plural(me.streak.current_days, lang, ["dia", "dias"], ["day", "days"]))}
      {cell(t("Nível", "Level"), me.level)}
      {cell(t("XP · semana", "XP · week"), me.xp_week)}
    </div>
  );
};

// C.2 — "Próximos passos": sugestões do Engage-Agent que o aluno ainda não tratou.
const NextSteps = ({ persona, onOpenPractice }: { persona: string; onOpenPractice: () => void }) => {
  const t = useT();
  const { lang } = useLanguage();
  const { speak, stop, speaking, supported } = useSpeech();
  const [items, setItems] = useState<UnreadIntervention[] | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);

  const load = () =>
    getInterventions()
      .then((r) => setItems(r.interventions))
      .catch(() => setItems([]));

  useEffect(() => {
    void load();
  }, [lang]);

  useEffect(() => {
    if (!speaking) setSpeakingId(null);
  }, [speaking]);

  const dismiss = (id: number) => {
    setItems((cur) => (cur ?? []).filter((i) => i.intervention_id !== id));
    ackIntervention(id).catch(() => undefined);
  };

  const listen = (item: UnreadIntervention) => {
    if (speakingId === item.intervention_id) {
      stop();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(item.intervention_id);
    void speak(stripCompetencyMarker(item.descricao) || noticeTypeLabel(item.tipo, lang), lang, persona);
  };

  // Ação secundária do estado vazio: pede uma sugestão sob demanda (o antigo
  // botão do "Professor Mediador"). A sugestão vira um item desta lista.
  const askNow = () => {
    setAsking(true);
    getEdubotRecommendation()
      .then(load)
      .catch(() => undefined)
      .finally(() => setAsking(false));
  };

  return (
    <section aria-labelledby="next-steps-title" className="card p-5">
      <Lab as="h2" id="next-steps-title">
        <span>{t("Próximos passos", "Next steps")}</span>
        <span>{t("tutor Learnia", "Learnia tutor")}</span>
      </Lab>

      {items === null ? null : items.length === 0 ? (
        <div className="flex items-start gap-3">
          <Explorador estado="meta" size={56} still decorative />
          <div className="text-sm text-muted">
            <p>{t("Você está em dia. Quando houver algo novo, aparece aqui.", "You're all caught up. New suggestions will show up here.")}</p>
            <button
              onClick={askNow}
              disabled={asking}
              className="mt-2 font-semibold text-trail-text underline decoration-1 underline-offset-[3px] hover:decoration-2 disabled:text-muted disabled:no-underline"
            >
              {asking ? t("Pensando…", "Thinking…") : t("Pedir uma sugestão agora", "Get a suggestion now")}
            </button>
          </div>
        </div>
      ) : (
        <ul className="-mx-5 divide-y divide-line border-t border-line">
          {items.map((item) => (
            <li key={item.intervention_id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="shrink-0">
                    <CompanionAvatar personaId={persona} size={36} estado="encorajando" speaking={speakingId === item.intervention_id} />
                  </div>
                  <div className="min-w-0">
                    <span className="k">{noticeTypeLabel(item.tipo, lang)}</span>
                    {item.descricao && <p className="mt-1 text-sm leading-relaxed text-ink">{stripCompetencyMarker(item.descricao)}</p>}
                  </div>
                </div>
                <button
                  onClick={() => dismiss(item.intervention_id)}
                  className="shrink-0 rounded p-1.5 text-muted transition-colors duration-rapido hover:bg-surface-2 hover:text-ink"
                  aria-label={t("Dispensar", "Dismiss")}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 pl-[48px]">
                <button
                  onClick={() => {
                    const alvo = competencyFromDescription(item.descricao);
                    if (alvo != null) safeSet("session", REFORCO_COMP_KEY, String(alvo));
                    dismiss(item.intervention_id);
                    onOpenPractice();
                  }}
                  className="btn btn-acc btn-sm"
                >
                  {t("Praticar agora", "Practice now")}
                  <ArrowRight size={16} className="arw" aria-hidden="true" />
                </button>
                {supported && (
                  <button
                    onClick={() => listen(item)}
                    className="btn btn-gh btn-sm"
                  >
                    {speakingId === item.intervention_id ? <Square size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                    {speakingId === item.intervention_id ? t("Parar", "Stop") : t("Ouvir", "Listen")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// Revisões vencidas (revisão espaçada) — só as que pedem ação agora.
const DueReviews = () => {
  const t = useT();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  useEffect(() => {
    getReviews().then((r) => setReviews(r.reviews.filter((x) => x.vencida))).catch(() => setReviews([]));
  }, []);
  if (reviews.length === 0) return null;
  return (
    <section aria-labelledby="due-reviews-title" className="card p-5">
      {/* Relevo (voz): revisão agendada = "marco"; o Explorador no estado "revisar". */}
      <Lab as="h2" id="due-reviews-title">
        <span>{t("Marcos de revisão", "Review checkpoints")}</span>
        <span>{t(`${reviews.length} para hoje`, `${reviews.length} due today`)}</span>
      </Lab>
      <ul className="-mx-5 divide-y divide-line border-t border-line">
        {reviews.map((r) => (
          <li key={r.review_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink">
              <CalendarClock size={16} className="shrink-0 text-muted" aria-hidden="true" />
              {r.competencia}
            </span>
            {r.ova_id != null && (
              <a href={`#/modulo/${r.ova_id}/quiz`} className="btn btn-gh btn-sm shrink-0">
                {t("Revisar", "Review")}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

interface CoursesHomeProps {
  profile: StudentProfile;
  onOpenSubject: (subjectId: number) => void;
  onOpenModule: (ova: OvaState) => void;
  onOpenPractice: () => void;
  // Professor/coordenação: pré-visualização do material, sem os elementos do aluno.
  preview?: boolean;
}

export const CoursesHome = ({ profile, onOpenSubject, onOpenModule, onOpenPractice, preview = false }: CoursesHomeProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const groups = groupBySubject(profile, profile.estudante.curso ?? t("Minhas matérias", "My courses"));
  const firstName = profile.estudante.nome.split(" ")[0];
  const isFresh = !preview && profile.ovas.every((ova) => !ova.perc_scrolled && !ova.read_time);
  // U.4 — o módulo mais recente ainda não concluído.
  const resume = preview ? undefined : [...profile.ovas]
    .filter((ova) => ova.last_access && !ova.completed)
    .sort((a, b) => String(b.last_access).localeCompare(String(a.last_access)))[0];

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="k k-muted">{profile.estudante.curso ?? ""}</p>
          <h1 className="h-display mt-2 text-ink">
            {preview ? t("Matérias", "Courses") : t(`Olá, ${firstName}!`, `Hi, ${firstName}!`)}
          </h1>
          {preview && (
            <p className="mt-2 text-muted">{t("Pré-visualize o material como o aluno vê.", "Preview the material the way students see it.")}</p>
          )}
        </div>
        {!preview && <StreakChip />}
      </div>

      <div className={`grid gap-8 ${preview ? "" : "xl:grid-cols-[1fr_360px]"}`}>
        <div className="space-y-8">
          {isFresh && profile.ovas[0] && (
            <div className="card relative overflow-hidden">
              <TopoMap variant="faixa" className="opacity-70" />
              <div className="relative flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
                <Explorador estado="explicando" size={88} />
                <div className="min-w-0 flex-1">
                  <div className="k">{t("Primeiro passo", "First step")}</div>
                  <h2 className="h-sec mt-1.5 text-ink">{t("Boas-vindas à Learnia!", "Welcome to Learnia!")}</h2>
                  <p className="mt-1.5 max-w-[520px] text-muted">
                    {t("Escolha uma matéria e comece pelo primeiro módulo — eu acompanho você a cada passo.",
                       "Pick a course and start with its first module — I'll be with you every step of the way.")}
                  </p>
                </div>
                <button onClick={() => onOpenModule(profile.ovas[0])} className="btn btn-pri shrink-0">
                  {t("Começar o primeiro módulo", "Start the first module")}
                  <ArrowRight size={18} className="arw" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Guia "Próximo passo": rótulo, título, régua de elevação e o botão. */}
          {resume && (
            <div className="card sobe p-6">
              <Lab>
                <span>{t("Próximo passo", "Next step")}</span>
                <span>{resume.subject_nome ?? ""}</span>
              </Lab>
              <h2 className="h-sec text-ink">{t(`Continuar ${resume.ova_name}`, `Continue ${resume.ova_name}`)}</h2>
              <p className="mt-1.5 text-sm text-muted">{t("De onde você parou", "Where you left off")}</p>
              <Elev value={moduleProgress(resume)} className="my-5" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <small className="num text-[11.5px] text-muted">
                  {t(`${moduleProgress(resume)}% lido · faltam ${100 - moduleProgress(resume)}%`, `${moduleProgress(resume)}% read · ${100 - moduleProgress(resume)}% to go`)}
                </small>
                <button onClick={() => onOpenModule(resume)} className="btn btn-pri btn-sm">
                  {t("Continuar", "Continue")}
                  <ArrowRight size={16} className="arw" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          <div>
            {!preview && (
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="h-sec text-ink">{t("Minhas matérias", "My courses")}</h2>
                <span className="k k-muted">{plural(groups.length, lang, ["matéria", "matérias"], ["course", "courses"])}</span>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((group, i) => {
                const perc = subjectProgress(group);
                const done = group.ovas.filter((ova) => ova.completed).length;
                return (
                  <button
                    key={group.subject_id}
                    onClick={() => onOpenSubject(group.subject_id)}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="card sobe group flex flex-col p-5 text-left transition-colors duration-rapido hover:border-ink"
                  >
                    <span className="k k-muted">
                      {plural(group.ovas.length, lang, ["módulo", "módulos"], ["module", "modules"])}
                    </span>
                    <span className="mt-1.5 text-xl font-bold leading-tight tracking-[-0.02em] text-ink">{group.nome}</span>
                    <span className="mt-1 text-sm text-muted">
                      {t(
                        `${done} de ${group.ovas.length} ${group.ovas.length === 1 ? "módulo concluído" : "módulos concluídos"}`,
                        `${done} of ${group.ovas.length} ${group.ovas.length === 1 ? "module" : "modules"} completed`
                      )}
                    </span>
                    <Elev value={perc} small meta={perc >= 100} className="mt-5" />
                    <span className="mt-3 flex items-center justify-between gap-3 text-sm">
                      {perc >= 100 ? (
                        <StatusTag kind="ok">{t("Concluída", "Completed")}</StatusTag>
                      ) : (
                        <span className="num text-[12px] text-muted">{t(`${perc}% do conteúdo`, `${perc}% of the content`)}</span>
                      )}
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        {t("Abrir", "Open")}
                        <ArrowRight size={16} className="transition-transform duration-medio ease-subida group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {!preview && <aside aria-label={t("Para fazer", "To do")} className="h-fit space-y-4">
          <h2 className="k k-muted">{t("Para fazer", "To do")}</h2>
          <NextSteps persona={profile.estudante.persona} onOpenPractice={onOpenPractice} />
          <DueReviews />
          <WeeklyGoalsCard />
        </aside>}
      </div>
    </section>
  );
};
