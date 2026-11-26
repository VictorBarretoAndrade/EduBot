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
import { ArrowLeft, ArrowRight, ClipboardCheck, ExternalLink, FileText, GraduationCap, Square, Volume2 } from "lucide-react";
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
import { RelevoLoader } from "./brand/RelevoLoader";
import { Explorador } from "./brand/Explorador";
import { TopoMap } from "./brand/TopoMap";
import { StatusIcon } from "./ui/Relevo";

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
    setFeedback(t("A Learnia está diagnosticando e montando sua trilha de prática...", "Learnia is diagnosing and building your practice path..."));
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

        <div className="card relative overflow-hidden p-8">
          <TopoMap variant="faixa" className="opacity-50" />
          <div className="relative">
          <p className="k">{t("Trilha de reforço", "Practice path")}</p>
          <h1 className="h-display mt-1.5 text-ink">{active.titulo}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {active.competencia && (
              <span className="tag tag-low">
                <StatusIcon kind="low" />
                {t("Foco:", "Focus:")} {active.competencia.nome}
              </span>
            )}
            {/* P.2 — a trilha começa pelo formato em que o aluno mais aprende. */}
            {active.formato_preferido && (
              <span className="tag tag-mid">
                {t("No seu formato:", "Preferred format:")} {formatChip(active.formato_preferido, t)}
              </span>
            )}
          </div>
          {/* EX.2 — o PERSONAGEM entrega a trilha que o agente montou. Relevo: o
              Explorador encorajando (abaixo da meta), com a fala no filete em Trilha. */}
          {active.mensagem_aluno && (
            <div className="mt-6 flex items-start gap-4 border-t border-line pt-6">
              <div className="shrink-0">
                <CompanionAvatar personaId={persona} size={72} speaking={speaking} visemeRef={visemeRef} estado="encorajando" />
              </div>
              <div className="min-w-0">
                <div className="msg-who">{t("Tutor Learnia", "Learnia tutor")}</div>
                <p className="msg-a text-[17px] leading-[1.55] text-ink">{active.mensagem_aluno}</p>
                {supported && (
                  <button
                    onClick={() => (speaking ? stop() : speak(active.mensagem_aluno as string, lang, persona))}
                    className="btn btn-gh btn-sm ml-[15px] mt-3"
                  >
                    {speaking ? <Square size={16} /> : <Volume2 size={16} />}
                    {speaking ? t("Parar", "Stop") : t("Ouvir", "Listen")}
                  </button>
                )}
              </div>
            </div>
          )}
          </div>
        </div>

        <div>
          <h2 className="h-sec mb-3 text-ink">{t("Conteúdo de reforço", "Practice material")}</h2>
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
                    className="flex items-center justify-between card p-5"
                  >
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <FileText size={20} className="text-ink" />
                      {resource.resource_title}
                    </span>
                    <a
                      href={resource.resource_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => saveProgress(resource, { perc: 100, completed: true })}
                      className="btn btn-gh btn-sm"
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
              <p className="card p-6 text-muted">{t("Nenhum recurso nesta trilha.", "No resources in this path.")}</p>
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
      {/* Relevo (voz): o reforço é a TRILHA — o caminho mais curto até a cota. */}
      <div className="card relative overflow-hidden">
        <TopoMap variant="faixa" className="opacity-70" />
        <div className="relative flex flex-wrap items-center gap-6 p-7">
          <Explorador estado={generating ? "pensando" : "encorajando"} size={96} />
          <div className="min-w-[260px] flex-1">
            <p className="k">{t("Trilha de reforço", "Practice path")}</p>
            <h1 className="h-display mt-1.5 text-ink">{t("Prática personalizada", "Personalized practice")}</h1>
            <p className="mt-2 max-w-[560px] text-muted">
              {t(
                "A Learnia identifica o assunto em que você foi pior e monta uma trilha de prática só para você.",
                "Learnia identifies the topic where you need the most help and builds a practice path just for you."
              )}
            </p>
          </div>
          <button onClick={generate} disabled={generating} className="btn btn-acc">
            {generating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-trail/40 border-t-on-trail" aria-hidden="true" />}
            {t("Montar minha prática", "Build my practice path")}
            {!generating && <ArrowRight size={18} className="arw" aria-hidden="true" />}
          </button>
        </div>
        {generating && feedback ? (
          <div className="relative border-t border-line px-7 py-4">
            <RelevoLoader size={36} label={t("Lendo o seu rastro…", "Reading your trail…")} hint={t("montando o percurso de reforço", "building your practice path")} />
          </div>
        ) : feedback ? (
          <p className="relative border-t border-line px-7 py-4 text-ink">{feedback}</p>
        ) : null}
        {error && <p className="relative border-t border-line px-7 py-4 font-semibold text-trail-text">{error}</p>}
      </div>

      <div className="space-y-3">
        {ovas.map((pova) => (
          <button
            key={pova.personalized_ova_id}
            onClick={() => open(pova.personalized_ova_id)}
            className="card group flex w-full items-center justify-between gap-4 p-5 text-left transition-colors duration-rapido hover:border-ink"
          >
            <span className="min-w-0">
              <span className="k">{t("Trilha", "Path")}</span>
              <span className="mt-1 block font-semibold text-ink">{pova.titulo}</span>
              {pova.competencia && <span className="mt-0.5 block text-sm text-muted">{pova.competencia}</span>}
            </span>
            {loadingId === pova.personalized_ova_id ? (
              <RelevoLoader size={32} />
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 font-semibold text-ink">
                {t("Abrir", "Open")}
                <ArrowRight size={16} className="transition-transform duration-medio ease-subida group-hover:translate-x-1" aria-hidden="true" />
              </span>
            )}
          </button>
        ))}
        {ovas.length === 0 && (
          <p className="rounded border border-dashed border-line-strong/60 p-6 text-muted">
            {t("Nenhuma trilha ainda — clique em", "No practice paths yet — click")} <strong className="text-ink">"{t("Montar minha prática", "Build my practice path")}"</strong>.
          </p>
        )}
      </div>

      {externalCourses.length > 0 && (
        <div className="space-y-3">
          <h2 className="h-sec text-ink">{t("Cursos com certificado", "Courses with a certificate")}</h2>
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
        <RelevoLoader size={28} label={t("Buscando materiais externos…", "Searching external materials…")} />
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="h-sec mb-1 flex items-center gap-2 text-ink">
        <GraduationCap size={20} className="text-ink" /> {t("Materiais externos", "External materials")}
      </h2>
      <p className="mb-3 text-sm text-muted">{t("Artigos científicos relacionados a este assunto (fonte: Crossref).", "Scientific articles related to this topic (source: Crossref).")}</p>
      <div className="space-y-3">
        {items.map((item, index) => (
          <a
            key={index}
            href={item.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-4 card p-5 transition hover:border-ink"
          >
            <span>
              <span className="font-semibold text-ink">{item.titulo}</span>
              <span className="mt-1 block text-sm text-muted">
                {item.fonte}
                {item.ano ? ` · ${item.ano}` : ""}
              </span>
            </span>
            <ExternalLink size={18} className="mt-1 shrink-0 text-ink" />
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
    <div className="flex items-center justify-between card p-5">
      <span className="flex items-center gap-2 font-semibold text-ink">
        <ClipboardCheck size={20} className="text-ink" />
        {resource.resource_title}
      </span>
      <button
        disabled={done}
        onClick={() => {
          onComplete();
          setDone(true);
        }}
        className={done ? "tag tag-ok" : "btn btn-gh btn-sm"}
      >
        {done ? t("✓ Concluída", "✓ Completed") : t("Marcar como concluída", "Mark as done")}
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
      <h2 className="h-sec mb-3 text-ink">{t("Quiz de fixação", "Practice quiz")}</h2>
      <div className="space-y-5">
        {questions.map((question, index) => {
          const graded = feedback[question.question_id];
          return (
            <div
              key={question.question_id}
              className={`rounded border bg-surface p-6 ${
                graded === undefined ? "border-line" : graded ? "border-mata" : "border-trail"
              }`}
            >
              <div className="k k-muted">{t("Questão", "Question")} {index + 1} / {questions.length}</div>
              <h3 className="mt-1.5 text-[17px] font-semibold leading-snug text-ink">{question.statement}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {question.alternatives.map((option, optionIndex) => (
                  <label
                    key={option}
                    className={`flex min-h-12 cursor-pointer items-center rounded border px-4 py-3 transition-colors duration-rapido ${
                      answers[question.question_id] === optionIndex ? "border-ink bg-surface-2" : "border-line-strong/40 bg-surface hover:border-ink"
                    }`}
                  >
                    <input
                      className="mr-3 accent-[rgb(var(--ink))]"
                      type="radio"
                      checked={answers[question.question_id] === optionIndex}
                      onChange={() => setAnswers((current) => ({ ...current, [question.question_id]: optionIndex }))}
                    />
                    <span className="num mr-2 text-[12px] font-semibold text-muted">{LETTERS[optionIndex]}</span>
                    {option}
                  </label>
                ))}
              </div>
              {graded !== undefined && (
                <p className={`tag mt-4 ${graded ? "tag-ok" : "tag-low"}`}>
                  <StatusIcon kind={graded ? "ok" : "low"} />
                  {graded ? t("Correta", "Correct") : t("Incorreta", "Incorrect")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={finish}
        disabled={submitting || Object.keys(answers).length < questions.length}
        className="btn btn-pri btn-lg mt-6"
      >
        {submitting ? t("Corrigindo…", "Checking your answers…") : t("Finalizar quiz", "Finish quiz")}
      </button>
    </div>
  );
};
