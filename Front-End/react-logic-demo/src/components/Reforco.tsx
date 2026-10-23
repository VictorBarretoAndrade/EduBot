/*
INTEGRAÇÃO (OVA personalizada) — Aba "Reforço".

O EduBot, agora um AGENTE de tool-use no backend, diagnostica o assunto em que o
aluno foi pior e monta uma prática (vídeos, textos e questões do banco
classificado por competência). Esta tela:
  - aciona o agente (POST /edubot/personalized-ova),
  - lista as práticas já geradas (GET /personalized-ova),
  - abre uma OVA e a renderiza reaproveitando os mesmos players (VideoPlayer/
    AudioPlayer) e o mesmo padrão de quiz corrigido no servidor das OVAs normais
    (GET /personalized-ova/<id>).
O consumo é persistido em resource_progress / attempts, realimentando o perfil
e o próprio EduBot.
*/
import { ArrowLeft, ClipboardCheck, ExternalLink, FileText, GraduationCap, LoaderCircle, Sparkles, Square, Stars, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ExternalResource,
  OvaResource,
  PersonalizedOVAContent,
  PersonalizedOVASummary,
  StudentProfile,
  answerQuestion,
  createPersonalizedOVA,
  getExternalResources,
  getPersonalizedOVA,
  getSession,
  listPersonalizedOVAs,
  ExternalCourse,
  getExternalCourses,
} from "../services/api";
import { ExternalCourseCard } from "./ExternalCourseCard";
import { saveMediaProgress } from "../services/mediaProgress";
import { REFORCO_COMP_KEY } from "../services/reinforcementTarget";
import { AudioPlayer } from "./players/AudioPlayer";
import { MediaProgress, VideoPlayer } from "./players/VideoPlayer";
import { useToast } from "./ui/Toast";
import { useLanguage, useT } from "../i18n";
import { useSpeech } from "../hooks/useSpeech";
import { CompanionAvatar } from "./brand/CompanionAvatar";
import { safeGet, safeSet, safeRemove } from "../services/storage";

interface ReforcoProps {
  profile: StudentProfile;
  onTracked: () => void;
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

// P.2 — rótulo do formato preferido com ícone, para o chip "no seu formato".
const formatChip = (formato: string, t: (pt: string, en: string) => string) => {
  const map: Record<string, string> = {
    video: `🎬 ${t("vídeo primeiro", "video first")}`,
    texto: `📖 ${t("texto primeiro", "text first")}`,
    podcast: `🎧 ${t("podcast primeiro", "podcast first")}`
  };
  return map[formato] ?? formato;
};

export const Reforco = ({ profile, onTracked }: ReforcoProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const { speak, stop, speaking, supported, visemeRef } = useSpeech();
  const persona = profile.estudante.persona;
  const [ovas, setOvas] = useState<PersonalizedOVASummary[]>([]);
  const [active, setActive] = useState<PersonalizedOVAContent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Plano 6: cursos externos com certificado (Cisco) — lista e estado do envio.
  const [externalCourses, setExternalCourses] = useState<ExternalCourse[]>([]);
  const toast = useToast();

  useEffect(() => {
    getExternalCourses().then(setExternalCourses).catch(() => setExternalCourses([]));
  }, [lang]);

  const refreshList = () =>
    listPersonalizedOVAs().then(setOvas).catch(() => setError(t("Não foi possível listar as práticas.", "Couldn't load your practice paths.")));

  useEffect(() => {
    refreshList();
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setFeedback(t("O Engage-Agent está diagnosticando e montando sua trilha de prática...", "Engage-Agent is diagnosing and building your practice path..."));
    try {
      // Se o aluno chegou pelo convite de reforço, a competência já foi decidida
      // pelo gatilho (é a que ele acabou de errar). Consome a chave uma vez.
      const alvo = safeGet("session", REFORCO_COMP_KEY);
      safeRemove("session", REFORCO_COMP_KEY);
      const created = await createPersonalizedOVA(alvo ? Number(alvo) : undefined);
      setFeedback(created.mensagem_aluno || t("Prática criada!", "Practice path created!"));
      await refreshList();
      await open(created.personalized_ova_id);
      onTracked();
    } catch (err) {
      setFeedback(null);
      const msg = (err as { message?: string }).message ?? "";
      setError(
        msg.includes("conteúdo de reforço")
          ? t("Não há conteúdo de reforço para o seu assunto fraco no momento.", "There's no practice material available for this topic right now.")
          : t("Não foi possível gerar a prática agora.", "Couldn't build your practice path right now.")
      );
    } finally {
      setGenerating(false);
    }
  };

  const open = async (id: number) => {
    setLoadingId(id);
    setError(null);
    try {
      setActive(await getPersonalizedOVA(id));
    } catch {
      setError(t("Não foi possível abrir a prática.", "Couldn't open this practice path."));
    } finally {
      setLoadingId(null);
    }
  };

  const saveProgress = (resource: OvaResource, state: Partial<MediaProgress>) =>
    saveMediaProgress(resource.resource_id, state).catch(() =>
      toast.error(t("Não foi possível salvar seu progresso. Verifique a conexão.", "Couldn't save your progress. Check your connection."))
    );

  // ----- Visualização de uma OVA de reforço aberta -------------------------
  if (active) {
    return (
      <section className="space-y-6">
        <button
          onClick={() => setActive(null)}
          className="flex items-center gap-2 text-muted transition hover:text-ink"
        >
          <ArrowLeft size={18} /> {t("Voltar para minhas práticas", "Back to my practice paths")}
        </button>

        <div className="rounded-[8px] border border-line bg-white p-8 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            {active.competencia && (
              <span className="rounded-[8px] bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800">
                {t("Foco:", "Focus:")} {active.competencia.nome}
              </span>
            )}
            {/* P.2 — a trilha começa pelo formato em que o aluno mais aprende. */}
            {active.formato_preferido && (
              <span className="rounded-[8px] bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                {t("No seu formato:", "Preferred format:")} {formatChip(active.formato_preferido, t)}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-bold text-ink">{active.titulo}</h1>
          {/* EX.2 — o PERSONAGEM entrega a trilha que o agente montou. */}
          {active.mensagem_aluno && (
            <div className="mt-3 flex items-start gap-3 rounded-[8px] bg-indigo-50/60 p-4">
              <div className="shrink-0">
                <CompanionAvatar personaId={persona} size={72} speaking={speaking} visemeRef={visemeRef} />
              </div>
              <div className="min-w-0">
                <p className="text-lg leading-8 text-slate-800">{active.mensagem_aluno}</p>
                {supported && (
                  <button
                    onClick={() => (speaking ? stop() : speak(active.mensagem_aluno as string, lang, persona))}
                    className="mt-2 flex h-9 items-center gap-2 rounded-[8px] border border-brand bg-white px-3 text-sm font-semibold text-brand transition hover:bg-indigo-50"
                  >
                    {speaking ? <Square size={16} /> : <Volume2 size={16} />}
                    {speaking ? t("Parar", "Stop") : t("Ouvir", "Listen")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-xl font-bold text-ink">{t("Conteúdo de reforço", "Practice material")}</h2>
          <div className="space-y-4">
            {active.recursos.map((resource) => {
              if (resource.resource_type === "video") {
                return (
                  <VideoPlayer
                    key={resource.resource_id}
                    url={resource.resource_url}
                    mediaType={resource.media_type}
                    title={resource.resource_title}
                    resourceId={resource.resource_id}
                    initialCoverageBitmap={resource.coverage_bitmap}
                    initialCoveragePerc={resource.coverage_perc}
                    onProgress={(state) => saveProgress(resource, state)}
                  />
                );
              }
              if (resource.resource_type === "podcast") {
                return (
                  <AudioPlayer
                    key={resource.resource_id}
                    url={resource.resource_url}
                    title={resource.resource_title}
                    durationSeconds={resource.duration_seconds}
                    initialSeconds={resource.seconds_consumed}
                    resourceId={resource.resource_id}
                    onProgress={(state) => saveProgress(resource, state)}
                  />
                );
              }
              if (resource.resource_type === "texto") {
                return (
                  <div
                    key={resource.resource_id}
                    className="flex items-center justify-between rounded-[8px] border border-line bg-white p-5"
                  >
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <FileText size={20} className="text-brand" />
                      {resource.resource_title}
                    </span>
                    <a
                      href={resource.resource_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => saveProgress(resource, { perc: 100, completed: true })}
                      className="rounded-[8px] border border-brand px-4 py-2 font-semibold text-brand transition hover:bg-indigo-50"
                    >
                      {resource.completed ? t("Reler", "Read again") : t("Abrir leitura", "Read article")}
                    </a>
                  </div>
                );
              }
              if (resource.resource_type === "curso_externo") {
                const course = externalCourses.find((c) => c.resource_id === resource.resource_id) ?? {
                  resource_id: resource.resource_id, ova_id: 0, titulo: resource.resource_title,
                  url: resource.resource_url, competency_id: null,
                  certificado: { status: resource.completed ? "aprovado" : null, feedback: null, enviado_em: null }
                };
                return <ExternalCourseCard key={resource.resource_id} course={course} onApproved={onTracked} />;
              }
              if (resource.resource_type === "atividade") {
                return (
                  <ActivityCard
                    key={resource.resource_id}
                    resource={resource}
                    onComplete={() => saveProgress(resource, { perc: 100, completed: true })}
                  />
                );
              }
              return null;
            })}
            {active.recursos.length === 0 && (
              <p className="rounded-[8px] border border-line bg-white p-6 text-muted">{t("Nenhum recurso nesta trilha.", "No resources in this path.")}</p>
            )}
          </div>
        </div>

        {active.competencia && <ExternalSources competencyId={active.competencia.competency_id} />}

        {active.questoes.length > 0 && (
          <ReforcoQuiz questions={active.questoes} onTracked={onTracked} />
        )}
      </section>
    );
  }

  // ----- Lista + geração ----------------------------------------------------
  return (
    <section className="space-y-6">
      <div className="rounded-[8px] border border-line bg-white p-8 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-ink">
              <Stars className="text-brand" /> {t("Prática personalizada", "Personalized practice")}
            </h1>
            <p className="mt-2 text-muted">
              {t(
                "O Engage-Agent identifica o assunto em que você foi pior e monta uma trilha de prática só para você.",
                "Engage-Agent identifies the topic where you need the most help and builds a practice path just for you."
              )}
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex h-12 items-center gap-2 rounded-[8px] bg-brand px-5 font-bold text-white disabled:bg-slate-300"
          >
            {generating ? <LoaderCircle className="animate-spin" size={20} /> : <Sparkles size={20} />}
            {t("Montar minha prática", "Build my practice path")}
          </button>
        </div>
        {feedback && <p className="mt-5 rounded-[8px] bg-indigo-50/60 p-4 text-slate-800">{feedback}</p>}
        {error && <p className="mt-5 rounded-[8px] bg-rose-50 p-4 font-semibold text-rose-700">{error}</p>}
      </div>

      <div className="space-y-3">
        {ovas.map((pova) => (
          <button
            key={pova.personalized_ova_id}
            onClick={() => open(pova.personalized_ova_id)}
            className="flex w-full items-center justify-between rounded-[8px] border border-line bg-white p-5 text-left transition hover:border-brand"
          >
            <span>
              <span className="flex items-center gap-2 font-bold text-ink">
                <Stars size={18} className="text-coral" />
                {pova.titulo}
              </span>
              {pova.competencia && <span className="mt-1 block text-sm text-muted">{pova.competencia}</span>}
            </span>
            {loadingId === pova.personalized_ova_id ? (
              <LoaderCircle className="animate-spin text-brand" size={20} />
            ) : (
              <span className="rounded-[8px] bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800">{t("Abrir", "Open")}</span>
            )}
          </button>
        ))}
        {ovas.length === 0 && (
          <p className="rounded-[8px] border border-line bg-white p-6 text-muted">
            {t("Nenhuma prática ainda — clique em", "No practice paths yet — click")} <strong>"{t("Montar minha prática", "Build my practice path")}"</strong>.
          </p>
        )}
      </div>

      {externalCourses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-ink">{t("Cursos com certificado", "Courses with a certificate")}</h2>
          <p className="text-sm text-muted">
            {t("Vá além do módulo com um curso reconhecido pelo mercado. Envie o certificado para ele contar no seu progresso.",
               "Go beyond the module with an industry-recognized course. Upload your certificate so it counts toward your progress.")}
          </p>
          {externalCourses.map((course) => (
            <ExternalCourseCard key={course.resource_id} course={course} onApproved={onTracked} />
          ))}
        </div>
      )}
    </section>
  );
};

// Materiais externos (artigos científicos) por competência — Crossref (Cena 4)
const ExternalSources = ({ competencyId }: { competencyId: number }) => {
  const t = useT();
  const [items, setItems] = useState<ExternalResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getExternalResources(competencyId)
      .then((data) => active && setItems(data.resultados))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [competencyId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <LoaderCircle className="animate-spin" size={16} /> {t("Buscando materiais externos...", "Searching external materials...")}
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-ink">
        <GraduationCap size={20} className="text-brand" /> {t("Materiais externos", "External materials")}
      </h2>
      <p className="mb-3 text-sm text-muted">{t("Artigos científicos relacionados a este assunto (fonte: Crossref).", "Scientific articles related to this topic (source: Crossref).")}</p>
      <div className="space-y-3">
        {items.map((item, index) => (
          <a
            key={index}
            href={item.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-4 rounded-[8px] border border-line bg-white p-5 transition hover:border-brand"
          >
            <span>
              <span className="font-semibold text-ink">{item.titulo}</span>
              <span className="mt-1 block text-sm text-muted">
                {item.fonte}
                {item.ano ? ` · ${item.ano}` : ""}
              </span>
            </span>
            <ExternalLink size={18} className="mt-1 shrink-0 text-brand" />
          </a>
        ))}
      </div>
    </div>
  );
};

// Cartão de atividade prática com botão de conclusão (estado local)
const ActivityCard = ({ resource, onComplete }: { resource: OvaResource; onComplete: () => void }) => {
  const t = useT();
  const [done, setDone] = useState(resource.completed);
  return (
    <div className="flex items-center justify-between rounded-[8px] border border-line bg-white p-5">
      <span className="flex items-center gap-2 font-semibold text-ink">
        <ClipboardCheck size={20} className="text-brand" />
        {resource.resource_title}
      </span>
      <button
        disabled={done}
        onClick={() => {
          onComplete();
          setDone(true);
        }}
        className={`rounded-[8px] px-4 py-2 font-semibold ${
          done ? "bg-emerald-100 text-emerald-700" : "border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {done ? t("Concluída ✓", "Completed ✓") : t("Marcar como concluída", "Mark as done")}
      </button>
    </div>
  );
};

// Quiz de fixação — mesmo padrão do Quiz.tsx: correção no servidor (answerQuestion)
const ReforcoQuiz = ({
  questions,
  onTracked
}: {
  questions: PersonalizedOVAContent["questoes"];
  onTracked: () => void;
}) => {
  const t = useT();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const session = getSession();
  const toast = useToast();

  const finish = async () => {
    if (!session) return;
    setSubmitting(true);
    const newFeedback: Record<number, boolean> = {};
    let failed = false;
    for (const question of questions) {
      const selected = LETTERS[answers[question.question_id]];
      try {
        const graded = await answerQuestion(question.question_id, selected);
        newFeedback[question.question_id] = graded.is_correct;
      } catch (err) {
        console.error(err);
        failed = true;
      }
    }
    setFeedback(newFeedback);
    setSubmitting(false);
    if (failed) toast.error(t("Algumas respostas não puderam ser corrigidas. Tente novamente.", "Some answers couldn't be graded. Try again."));
    onTracked();
  };

  return (
    <div>
      <h2 className="mb-3 text-xl font-bold text-ink">{t("Quiz de fixação", "Practice quiz")}</h2>
      <div className="space-y-5">
        {questions.map((question, index) => {
          const graded = feedback[question.question_id];
          return (
            <div
              key={question.question_id}
              className={`rounded-[8px] border bg-white p-6 ${
                graded === undefined ? "border-line" : graded ? "border-emerald-300" : "border-rose-300"
              }`}
            >
              <div className="text-sm font-semibold text-brand">{t("Questão", "Question")} {index + 1}</div>
              <h3 className="mt-2 text-lg font-bold text-ink">{question.statement}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {question.alternatives.map((option, optionIndex) => (
                  <label
                    key={option}
                    className={`flex min-h-12 cursor-pointer items-center rounded-[8px] border px-4 py-3 ${
                      answers[question.question_id] === optionIndex ? "border-brand bg-indigo-50" : "border-line bg-white"
                    }`}
                  >
                    <input
                      className="mr-3"
                      type="radio"
                      checked={answers[question.question_id] === optionIndex}
                      onChange={() => setAnswers((current) => ({ ...current, [question.question_id]: optionIndex }))}
                    />
                    <span className="mr-2 font-bold text-muted">{LETTERS[optionIndex]})</span>
                    {option}
                  </label>
                ))}
              </div>
              {graded !== undefined && (
                <p className={`mt-3 font-semibold ${graded ? "text-emerald-700" : "text-rose-700"}`}>
                  {graded ? t("Correta!", "Correct!") : t("Incorreta.", "Incorrect.")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={finish}
        disabled={submitting || Object.keys(answers).length < questions.length}
        className="mt-6 h-12 rounded-[8px] bg-coral px-6 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? t("Corrigindo…", "Checking your answers…") : t("Finalizar quiz", "Finish quiz")}
      </button>
    </div>
  );
};
