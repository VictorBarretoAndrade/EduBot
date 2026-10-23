/*
Plano 6 (B.1) — "Minhas matérias": a home do aluno no modelo Canvas.

Substitui o antigo Dashboard. Mostra, nesta ordem, o que o aluno precisa para
decidir o que estudar: continuar de onde parou, os cartões de MATÉRIA (cada um
leva aos seus módulos) e, à direita, a coluna "Para fazer" — o único lugar onde
o aluno age sobre o que o Engage-Agent sugeriu (C.2). Métricas detalhadas foram
para "Meu progresso".
*/
import { ArrowRight, BookOpenText, CalendarClock, Flame, Sparkles, Square, Volume2, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
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
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-line bg-white px-4 py-3 shadow-sm">
      <span className="flex items-center gap-1.5 font-bold text-orange-600">
        <Flame size={20} className={me.streak.current_days > 0 ? "" : "opacity-40"} aria-hidden="true" />
        {plural(me.streak.current_days, lang, ["dia", "dias"], ["day", "days"])}
      </span>
      <span className="h-5 w-px bg-line" />
      <span className="font-bold text-brand">{t("Nível", "Level")} {me.level}</span>
      <span className="h-5 w-px bg-line" />
      <span className="flex items-center gap-1.5 font-bold text-amber-600">
        <Zap size={18} aria-hidden="true" /> {me.xp_week} <span className="text-xs font-medium text-muted">{t("XP/semana", "XP/week")}</span>
      </span>
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
    <section aria-labelledby="next-steps-title" className="rounded-[8px] border border-brand/30 bg-indigo-50/60 p-5 shadow-soft">
      <h2 id="next-steps-title" className="flex items-center gap-2 text-lg font-bold text-brand">
        <Sparkles size={20} aria-hidden="true" /> {t("Próximos passos", "Next steps")}
      </h2>
      <p className="mt-1 text-sm text-slate-700">{t("Sugestões do Engage-Agent para você.", "Suggestions from Engage-Agent.")}</p>

      {items === null ? null : items.length === 0 ? (
        <div className="mt-4 rounded-[8px] bg-white p-4 text-sm text-muted">
          <p>{t("Você está em dia. Quando houver algo novo, aparece aqui.", "You're all caught up. New suggestions will show up here.")}</p>
          <button
            onClick={askNow}
            disabled={asking}
            className="mt-3 font-semibold text-brand underline-offset-2 hover:underline disabled:text-muted"
          >
            {asking ? t("Pensando…", "Thinking…") : t("Pedir uma sugestão agora", "Get a suggestion now")}
          </button>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.intervention_id} className="rounded-[8px] border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="shrink-0">
                    <CompanionAvatar personaId={persona} size={36} speaking={speakingId === item.intervention_id} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">{noticeTypeLabel(item.tipo, lang)}</span>
                    {item.descricao && <p className="mt-1 text-sm text-slate-700">{stripCompetencyMarker(item.descricao)}</p>}
                  </div>
                </div>
                <button
                  onClick={() => dismiss(item.intervention_id)}
                  className="shrink-0 rounded-[8px] p-1.5 text-muted transition hover:bg-slate-100"
                  aria-label={t("Dispensar", "Dismiss")}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const alvo = competencyFromDescription(item.descricao);
                    if (alvo != null) safeSet("session", REFORCO_COMP_KEY, String(alvo));
                    dismiss(item.intervention_id);
                    onOpenPractice();
                  }}
                  className="h-10 rounded-[8px] bg-brand px-4 text-sm font-semibold text-white transition hover:bg-indigo-600"
                >
                  {t("Praticar agora", "Practice now")}
                </button>
                {supported && (
                  <button
                    onClick={() => listen(item)}
                    className="flex h-10 items-center gap-2 rounded-[8px] border border-brand bg-white px-4 text-sm font-semibold text-brand transition hover:bg-indigo-50"
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
    <section aria-labelledby="due-reviews-title" className="rounded-[8px] border border-amber-200 bg-amber-50 p-5">
      <h2 id="due-reviews-title" className="flex items-center gap-2 font-bold text-amber-800">
        <CalendarClock size={18} aria-hidden="true" /> {t("Revisões para hoje", "Reviews due")}
      </h2>
      <ul className="mt-3 space-y-2">
        {reviews.map((r) => (
          <li key={r.review_id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 text-amber-900">{r.competencia}</span>
            {r.ova_id != null && (
              <a href={`#/modulo/${r.ova_id}/quiz`} className="shrink-0 font-semibold text-amber-800 underline-offset-2 hover:underline">
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
  const groups = groupBySubject(profile, profile.estudante.curso ?? t("Minhas matérias", "My courses"));
  const firstName = profile.estudante.nome.split(" ")[0];
  const isFresh = !preview && profile.ovas.every((ova) => !ova.perc_scrolled && !ova.read_time);
  // U.4 — o módulo mais recente ainda não concluído.
  const resume = preview ? undefined : [...profile.ovas]
    .filter((ova) => ova.last_access && !ova.completed)
    .sort((a, b) => String(b.last_access).localeCompare(String(a.last_access)))[0];

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-lg text-muted">{profile.estudante.curso ?? ""}</p>
          <h1 className="mt-1 text-4xl font-bold text-ink">
            {preview ? t("Matérias", "Courses") : t(`Olá, ${firstName}!`, `Hi, ${firstName}!`)}
          </h1>
          {preview && (
            <p className="mt-2 text-muted">{t("Pré-visualize o material como o aluno vê.", "Preview the material the way students see it.")}</p>
          )}
        </div>
        {!preview && <StreakChip />}
      </div>

      <div className={`grid gap-6 ${preview ? "" : "xl:grid-cols-[1fr_360px]"}`}>
        <div className="space-y-6">
          {isFresh && profile.ovas[0] && (
            <div className="flex flex-col items-start gap-4 rounded-[8px] border border-brand/30 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-brand">
                  <Sparkles size={20} aria-hidden="true" /> {t("Boas-vindas ao Engage-Agent!", "Welcome to Engage-Agent!")}
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  {t("Escolha uma matéria e comece pelo primeiro módulo — eu acompanho você a cada passo.",
                     "Pick a course and start with its first module — I'll be with you every step of the way.")}
                </p>
              </div>
              <button
                onClick={() => onOpenModule(profile.ovas[0])}
                className="h-11 shrink-0 rounded-[8px] bg-brand px-5 font-bold text-white transition hover:bg-indigo-600"
              >
                {t("Começar o primeiro módulo", "Start the first module")}
              </button>
            </div>
          )}

          {resume && (
            <button
              onClick={() => onOpenModule(resume)}
              className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[8px] border border-line bg-white p-5 text-left shadow-soft transition hover:border-brand"
            >
              <span className="flex items-center gap-3">
                <BookOpenText className="text-brand" size={24} aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-brand">{t("Continuar de onde parou", "Pick up where you left off")}</span>
                  <span className="block font-bold text-ink">{resume.ova_name}</span>
                  <span className="block text-sm text-muted">{t(`${moduleProgress(resume)}% lido`, `${moduleProgress(resume)}% read`)}</span>
                </span>
              </span>
              <ArrowRight className="text-brand" size={22} aria-hidden="true" />
            </button>
          )}

          <div>
            {!preview && <h2 className="mb-4 text-2xl font-bold text-ink">{t("Minhas matérias", "My courses")}</h2>}
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((group) => {
                const perc = subjectProgress(group);
                const done = group.ovas.filter((ova) => ova.completed).length;
                return (
                  <button
                    key={group.subject_id}
                    onClick={() => onOpenSubject(group.subject_id)}
                    className="flex flex-col overflow-hidden rounded-[8px] border border-line bg-white text-left shadow-soft transition hover:border-brand"
                  >
                    <span className="h-2 w-full bg-gradient-to-r from-indigo-700 via-brand to-violet-500" aria-hidden="true" />
                    <span className="flex flex-1 flex-col p-5">
                      <span className="text-xl font-bold text-ink">{group.nome}</span>
                      <span className="mt-1 text-sm text-muted">
                        {t(
                          `${done} de ${group.ovas.length} ${group.ovas.length === 1 ? "módulo concluído" : "módulos concluídos"}`,
                          `${done} of ${group.ovas.length} ${group.ovas.length === 1 ? "module" : "modules"} completed`
                        )}
                      </span>
                      <span className="mt-4 h-2 rounded-full bg-slate-100" aria-hidden="true">
                        <span className="block h-2 rounded-full bg-teal" style={{ width: `${perc}%` }} />
                      </span>
                      <span className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted">{t(`${perc}% do conteúdo`, `${perc}% of the content`)}</span>
                        <span className="flex items-center gap-1 font-semibold text-brand">
                          {t("Abrir", "Open")} <ArrowRight size={16} aria-hidden="true" />
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {!preview && <aside aria-label={t("Para fazer", "To do")} className="h-fit space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">{t("Para fazer", "To do")}</h2>
          <NextSteps persona={profile.estudante.persona} onOpenPractice={onOpenPractice} />
          <DueReviews />
          <WeeklyGoalsCard />
        </aside>}
      </div>
    </section>
  );
};
