/*
MELHORIA (Migração do OVA para o front novo) — Leitor de OVA NATIVO.

Substitui o leitor legado (iframe + Bootstrap/jQuery, aberto em outra aba) por
uma view React dentro do dashboard, com o design system do app. O conteúdo é
carregado do HTML do OVA (services/ovaContent.ts) e renderizado com componentes
nativos (parágrafos, imagens, Carousel, Accordion), além de:

  - rastreio de leitura (tempo + scroll) -> POST /progress/ova (espelha ova.js);
  - mídias do banco (vídeo/podcast/atividade) -> VideoPlayer/AudioPlayer;
  - quiz embutido corrigido no servidor (OvaQuiz);
  - painel lateral retrátil do Tutor IA (TutorChat), com o material do OVA como
    contexto.

Plano 6 (B.1): a página do módulo vira um stepper Conteúdo → Atividades → Quiz
(#/modulo/:id/:passo). Cada passo é um painel; o progresso de LEITURA só é medido
no passo Conteúdo — pular direto para o quiz não pode contar como leitura (é a
leitura que libera o quiz no backend).
*/
import { ArrowLeft, BookOpenText, CheckCircle2, ClipboardList, ListChecks, LoaderCircle, Sparkles, Trophy, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GamificationAward,
  OvaResource,
  ExternalCourse,
  getExternalCourses,
  getOVAResources,
  registerInteraction,
  saveOVAProgress,
  saveResourceProgress
} from "../../services/api";
import { OvaContent, OvaSection, fetchOvaContent, ovaContextText } from "../../services/ovaContent";
import { track } from "../../services/events";
import { saveMediaProgress } from "../../services/mediaProgress";
import { AudioPlayer } from "../players/AudioPlayer";
import { MediaProgress, VideoPlayer } from "../players/VideoPlayer";
import { useToast } from "../ui/Toast";
import { useLanguage, useT } from "../../i18n";
import { useSpeech } from "../../hooks/useSpeech";
import { useCompanionScript } from "../../hooks/useCompanionScript";
import { useTutorChat } from "../../hooks/useTutorChat";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useSectionTracking } from "../../hooks/useSectionTracking";
import { Accordion } from "./Accordion";
import { Carousel } from "./Carousel";
import { OvaQuiz } from "./OvaQuiz";
import { TutorChat } from "./TutorChat";
import { StudyCompanion } from "./StudyCompanion";
import { ExternalCourseCard } from "../ExternalCourseCard";
import { safeGet, safeSet, safeRemove } from "../../services/storage";

const COMPLETED_PERC = 90;
const SYNC_INTERVAL_MS = 15000;
// Página que cabe na viewport (não rola) conta como lida após um tempo mínimo
// de permanência (A6) — sem isso, um OVA curto nunca completava (scroll ficava 0).
const SHORT_PAGE_MIN_SECONDS = 20;
// A.5: tempo de leitura HONESTO. O ticker antes somava 1s/segundo enquanto o
// componente estivesse montado — aba em segundo plano ou aluno ausente contavam
// como leitura (a métrica central superavaliava). Agora um segundo só conta se a
// aba está visível E houve atividade (scroll/mouse/teclado) nos últimos N seg.
const IDLE_LIMIT_SECONDS = 180;

type ModuleStep = "conteudo" | "atividades" | "quiz";

interface OvaInfo {
  ova_id: number;
  ova_name: string;
  link: string;
  subject_nome?: string;
  perc_scrolled?: number;
  completed?: boolean;
}

interface OvaReaderProps {
  ova: OvaInfo;
  studentId: number;
  // CP.1 (Plano 3): persona do companheiro (vem do perfil) e flag da feature.
  persona: string;
  companionEnabled: boolean;
  // Plano 6: passo atual do stepper (vem da URL) e navegação entre passos.
  step: ModuleStep;
  onStepChange: (step: ModuleStep) => void;
  onBack: () => void;
  onOpenPractice: () => void;
  onTracked: () => void;
}

const COMPANION_HIDDEN_KEY = "edubot.companion.hidden";
// EX.3 (Plano 3): rótulo de interação NEUTRO (independente de idioma) para não
// misturar PT/EN na telemetria. O rótulo PT antigo segue reconhecido nos relatórios.
const OVA_ASSISTANT_OPENED = "ova_assistant_opened";

export const OvaReader = ({ ova, studentId, persona, companionEnabled, step, onStepChange, onBack, onOpenPractice, onTracked }: OvaReaderProps) => {
  // O efeito de rastreio lê o passo por ref (não reinicia o cronômetro a cada troca).
  const stepRef = useRef<ModuleStep>(step);
  stepRef.current = step;
  // Se o CONTEÚDO rola ou não — medido só no passo Conteúdo, para o painel curto
  // do quiz não ser confundido com "página curta" (que completa por tempo).
  const contentScrollableRef = useRef<boolean | null>(null);
  const [content, setContent] = useState<OvaContent | null>(null);
  const [error, setError] = useState(false);
  const [resources, setResources] = useState<OvaResource[]>([]);
  const [externalCourses, setExternalCourses] = useState<ExternalCourse[]>([]);
  // O assistente já aparece aberto na lateral em telas largas (o aluno conversa
  // sobre o que está lendo sem sair do OVA); em telas pequenas começa recolhido.
  const [showTutor, setShowTutor] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  // AC.3 (Plano 4): em telas < lg o painel do tutor é um OVERLAY — vira diálogo
  // modal (foco preso + Esc). Em desktop é um painel lado a lado (sem trap).
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  const asideRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  // Elemento do artigo — o scroll de leitura é medido POR CONTEÚDO, não pela
  // janela (A6), para não confundir altura de tela com consumo do texto.
  const contentRef = useRef<HTMLDivElement>(null);
  // Fase 2 — leitura por seção. O hook não tem cronômetro próprio: o ticker
  // abaixo (que já filtra aba oculta/ociosidade) é quem credita os segundos.
  const { observeSection, creditSecond, flushSections } = useSectionTracking(ova.ova_id);
  const toast = useToast();
  const t = useT();
  const { lang } = useLanguage();

  // --- Companheiro de estudo (CP.1/CP.2), voz (CP.5) e chat do tutor (CP.4) ---
  // O contexto do tutor (material do OVA) é derivado do conteúdo carregado.
  const tutorContext = useMemo(() => (content ? ovaContextText(content) : ""), [content]);
  const { speak, stop, speaking, visemeRef } = useSpeech();
  const companion = useCompanionScript(ova.ova_id);
  // Histórico do chat ELEVADO para cá: fechar/reabrir o painel não perde a conversa.
  const chat = useTutorChat(ova.ova_id, ova.ova_name, tutorContext, persona);
  const [muted, setMuted] = useState(false);
  const [hidden, setHidden] = useState<boolean>(
    () => typeof window !== "undefined" && safeGet("local", COMPANION_HIDDEN_KEY) === "1"
  );
  const hideCompanion = () => { setHidden(true); safeSet("local", COMPANION_HIDDEN_KEY, "1"); };
  const showCompanion = () => { setHidden(false); safeRemove("local", COMPANION_HIDDEN_KEY); };

  // AC.3: acompanha a quebra lg (overlay ↔ painel lado a lado).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // AC.3: no mobile (overlay) o painel do tutor é modal — foco preso + Esc fecha
  // e devolve o foco ao botão que o abriu.
  useFocusTrap(asideRef, { active: showTutor && !isDesktop, onEscape: () => setShowTutor(false) });

  // Abre o tutor com uma pergunta pré-preenchida (Explique esta seção / ajuda no
  // quiz). Reaproveita o MESMO chat — nenhum endpoint novo.
  const askTutor = (question: string) => {
    setShowTutor(true);
    void chat.ask(question);
  };

  // CP.5 — lê uma seção em voz alta, na voz da persona (a boca do avatar anima).
  const readSection = (section: OvaSection) => {
    const parts = [
      section.heading || "",
      ...section.blocks
        .filter((b): b is { kind: "paragraph"; text: string } => b.kind === "paragraph")
        .map((b) => b.text),
    ].filter(Boolean);
    const texto = parts.join(". ").slice(0, 2500);
    if (!texto) return;
    track("played", "ova_section", ova.ova_id, { kind: "tts", secao: section.heading });
    speak(texto, lang, persona);
  };

  const listenCompanion = () => {
    if (!companion.line) return;
    companion.listened();
    speak(companion.line.text, lang, persona);
  };

  // CP.3 — o companheiro reage à correção do quiz (comemora / oferece ajuda).
  const onQuizGraded = ({ correct, gamification }: { correct: boolean; gamification: GamificationAward | null }) => {
    if (!companionEnabled) return;
    if (correct) {
      const novas = gamification?.achievements ?? [];
      if (novas.length > 0) {
        companion.say({
          trigger: "achievement", kind: "celebrating",
          text: t("🏆 Você desbloqueou uma conquista!", "🏆 You unlocked an achievement!"),
        });
      } else {
        const xp = gamification?.xp_awarded ?? 0;
        companion.say({
          trigger: "quiz_ok", kind: "celebrating",
          text: xp > 0
            ? t(`Boa! +${xp} XP 🎉`, `Nice! +${xp} XP 🎉`)
            : t("Boa, resposta certa! 🎉", "Nice, correct answer! 🎉"),
        });
      }
    } else {
      companion.say({
        trigger: "quiz_wrong",
        text: t("Quase! Quer que eu te explique essa parte?", "Almost! Want me to explain this part?"),
        action: {
          label: t("Explicar", "Explain"),
          run: () => askTutor(t(
            "Errei uma questão do quiz. Pode explicar de novo os pontos principais deste conteúdo?",
            "I got a quiz question wrong. Can you re-explain the main points of this content?"
          )),
        },
      });
    }
  };

  // Carrega o conteúdo do OVA (HTML -> modelo estruturado) e os recursos de mídia
  useEffect(() => {
    let active = true;
    setContent(null);
    setError(false);
    fetchOvaContent(ova.link, ova.ova_name, lang)
      .then((data) => active && setContent(data))
      .catch(() => active && setError(true));
    getOVAResources(ova.ova_id)
      .then((data) => active && setResources(data))
      .catch(() => active && setResources([]));
    getExternalCourses()
      .then((data) => active && setExternalCourses(data))
      .catch(() => active && setExternalCourses([]));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ova.ova_id, ova.link, ova.ova_name, lang]);

  // Registra a abertura do OVA como interação (A2). O cálculo de dias_sem_acesso
  // deriva do MAX(interaction_date), mas antes só era alimentado ao abrir o
  // assistente / clicar em carrossel/acordeão — abrir o OVA (ação central do
  // estudo) não gerava sinal. Agora toda sessão de leitura marca presença.
  useEffect(() => {
    registerInteraction(ova.ova_id, "ova_opened").catch(() => undefined);
    // D.1: mesmo sinal no schema unificado de eventos (verbo `opened`). Convive
    // com `interactions` até a aposentadoria (migration futura).
    track("opened", "ova", ova.ova_id);
  }, [ova.ova_id]);

  // Rastreio de leitura (A1/A6/B3).
  //   - Tempo por DELTA: acumula os segundos não sincronizados e os envia como
  //     `seconds_delta`; o servidor SOMA (antes mandava o absoluto e o backend
  //     fazia max(), então dias distintos não somavam).
  //   - Scroll POR CONTEÚDO: mede o avanço dentro do artigo, não da janela.
  //   - Página curta (não rola): completa por tempo mínimo de permanência.
  //   - Flush final com keepalive no unload para não perder os últimos segundos.
  useEffect(() => {
    const unsyncedRef = { current: 0 };   // segundos ainda não enviados (delta)
    const sessionSecondsRef = { current: 0 }; // segundos desta sessão (p/ página curta)
    const maxScrollRef = { current: 0 };
    // A.5: marca a última atividade do aluno (agora); o ticker só conta se a
    // permanência foi recente e a aba está visível.
    const lastActivityRef = { current: Date.now() };
    // Fase 2 (§2.3): janelas de ociosidade viram eventos, para o professor
    // distinguir "ficou 40 min na página" de "leu 40 min".
    const idleRef = { current: false };
    const markActivity = () => {
      // Voltou a interagir depois de um período ocioso: fecha a janela de idle.
      if (idleRef.current) {
        idleRef.current = false;
        track("idle_end", "session", null, {
          ova_id: ova.ova_id,
          idle_seconds: Math.round((Date.now() - lastActivityRef.current) / 1000)
        });
      }
      lastActivityRef.current = Date.now();
    };

    const contentScrollable = () => {
      const el = contentRef.current;
      const h = el ? el.scrollHeight : document.documentElement.scrollHeight;
      return h > window.innerHeight + 8;
    };

    const readingPerc = () => {
      const el = contentRef.current;
      if (!el) return 0;
      const total = el.scrollHeight;
      if (total <= 0) return 0;
      const seen = window.scrollY + window.innerHeight - el.offsetTop;
      return Math.max(0, Math.min(100, Math.round((seen / total) * 100)));
    };

    const bumpProgress = (perc: number) => {
      if (perc > maxScrollRef.current) {
        maxScrollRef.current = perc;
        setProgress(perc);
      }
    };

    const isCompleted = () =>
      contentScrollableRef.current !== false
        ? maxScrollRef.current >= COMPLETED_PERC
        : sessionSecondsRef.current >= SHORT_PAGE_MIN_SECONDS;

    const persist = (refreshProfile: boolean, keepalive = false) => {
      // Fase 2: as seções viajam no MESMO momento de sync do OVA (mesma janela
      // de 15 s / pagehide) — nenhum canal ou cadência nova.
      flushSections(keepalive);
      const delta = unsyncedRef.current;
      unsyncedRef.current = 0;
      saveOVAProgress(
        {
          ova_id: ova.ova_id,
          seconds_delta: delta,
          perc_scrolled: maxScrollRef.current,
          completed: isCompleted()
        },
        { keepalive }
      )
        .then(() => refreshProfile && onTracked())
        // Se falhar (e não for o flush final), devolve o delta para reenviar depois
        .catch(() => {
          if (!keepalive) unsyncedRef.current += delta;
        });
    };

    const onScroll = () => {
      markActivity();
      // Plano 6: só o passo Conteúdo mede leitura.
      if (stepRef.current !== "conteudo") return;
      contentScrollableRef.current = contentScrollable();
      if (contentScrollableRef.current) bumpProgress(readingPerc());
    };

    const ticker = window.setInterval(() => {
      // A.5: só conta o segundo se a aba está visível E o aluno esteve ativo
      // recentemente (não conta aba em background nem ausência prolongada).
      const hidden = document.visibilityState === "hidden";
      const idle = (Date.now() - lastActivityRef.current) / 1000 > IDLE_LIMIT_SECONDS;
      if (idle && !idleRef.current) {
        idleRef.current = true;
        track("idle_start", "session", null, { ova_id: ova.ova_id });
      }
      if (hidden || idle) return;
      sessionSecondsRef.current += 1;
      unsyncedRef.current += 1;
      // Fase 2: o MESMO segundo (já filtrado) é creditado à seção visível.
      creditSecond();
      // Em página curta o progresso é por tempo (não há scroll a medir)
      if (stepRef.current === "conteudo" && !contentScrollable()) {
        contentScrollableRef.current = false;
        bumpProgress(Math.min(100, Math.round((sessionSecondsRef.current / SHORT_PAGE_MIN_SECONDS) * 100)));
      }
    }, 1000);
    const syncer = window.setInterval(() => persist(false), SYNC_INTERVAL_MS);
    const onPageHide = () => persist(false, true);
    // A.5: ao voltar a ficar visível, considera atividade e faz flush; ao ocultar,
    // sincroniza o que já foi lido (não perde delta ao trocar de aba).
    const onVisibility = () => {
      if (document.visibilityState === "visible") markActivity();
      else persist(false);
    };
    const activityEvents = ["mousemove", "keydown", "pointerdown"];
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    activityEvents.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
    onScroll();

    return () => {
      window.clearInterval(ticker);
      window.clearInterval(syncer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      activityEvents.forEach((ev) => window.removeEventListener(ev, markActivity));
      persist(true, true);
    };
  }, [ova.ova_id, onTracked, creditSecond, flushSections]);

  // CP.2 — saudação ao abrir o módulo (retomada se já havia progresso salvo).
  useEffect(() => {
    if (!companionEnabled) return;
    const perc = ova.perc_scrolled ?? 0;
    const text = perc > 5 && !ova.completed
      ? t(`Bem-vindo de volta! Você parou em ${perc}% — vamos continuar? 😊`,
          `Welcome back! You left off at ${perc}% — shall we continue? 😊`)
      : t(`Vamos estudar "${ova.ova_name}" juntos! Eu fico por aqui se precisar. 😊`,
          `Let's study "${ova.ova_name}" together! I'm right here if you need me. 😊`);
    companion.say({ trigger: "open", text, spontaneous: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ova.ova_id]);

  // CP.2 — marcos de leitura (50% e conclusão), derivados do progresso já medido.
  useEffect(() => {
    if (!companionEnabled) return;
    if (progress >= COMPLETED_PERC) {
      companion.say({
        trigger: "done", spontaneous: true,
        text: t("Leitura concluída! Que tal testar no quiz? 💪",
                "Reading complete! Ready to try the quiz? 💪"),
        action: { label: t("Ir para o quiz", "Go to the quiz"), run: () => onStepChange("quiz") },
      });
    } else if (progress >= 50) {
      companion.say({
        trigger: "half", spontaneous: true,
        text: t("Metade do caminho! O que vem agora costuma cair no quiz… 👀",
                "Halfway there! What comes next often shows up in the quiz… 👀"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const logInteraction = (label: string) => {
    registerInteraction(ova.ova_id, label).catch(() => undefined);
  };

  const trackMedia = (resource: OvaResource) => (state: MediaProgress) => {
    saveMediaProgress(resource.resource_id, state)
      .then(onTracked)
      .catch(() => toast.error(t("Não foi possível salvar seu progresso na mídia.", "Couldn't save your media progress.")));
  };

  const completeActivity = (resource: OvaResource) => {
    saveResourceProgress({ resource_id: resource.resource_id, perc_consumed: 100, completed: true })
      .then(() => {
        setResources((current) =>
          current.map((item) =>
            item.resource_id === resource.resource_id ? { ...item, completed: true } : item
          )
        );
        onTracked();
        toast.success(t("Atividade marcada como concluída!", "Activity marked as completed!"));
      })
      .catch(() => toast.error(t("Não foi possível concluir a atividade.", "Couldn't complete the activity.")));
  };

  const videoResources = resources.filter((r) => r.resource_type === "video");
  const podcastResources = resources.filter((r) => r.resource_type === "podcast");
  const activityResources = resources.filter((r) => r.resource_type === "atividade");
  // Plano 6: curso externo com certificado (Cisco) entra no passo Atividades.
  const moduleCourses = externalCourses.filter((c) => c.ova_id === ova.ova_id);
  const hasMedia = videoResources.length + podcastResources.length > 0;
  const activitiesDone = activityResources.filter((r) => r.completed).length;
  // O progresso da sessão começa em 0; para o aluno, vale o maior entre o já salvo e o desta sessão.
  const shownProgress = Math.max(progress, ova.completed ? 100 : ova.perc_scrolled ?? 0);

  // Plano 6: os 3 passos do módulo. "Atividades" some quando o módulo não tem.
  const steps: { id: ModuleStep; label: string; detail: string; icon: typeof BookOpenText }[] = [
    { id: "conteudo", label: t("Conteúdo", "Content"), detail: t(`${shownProgress}% lido`, `${shownProgress}% read`), icon: BookOpenText },
    ...(activityResources.length + moduleCourses.length > 0
      ? [{
          id: "atividades" as ModuleStep,
          label: t("Atividades", "Activities"),
          detail: `${activitiesDone + moduleCourses.filter((c) => c.certificado.status === "aprovado").length}/${activityResources.length + moduleCourses.length}`,
          icon: ClipboardList
        }]
      : []),
    { id: "quiz", label: t("Quiz", "Quiz"), detail: t("teste o que aprendeu", "check what you learned"), icon: Trophy }
  ];
  const nextStep = steps[steps.findIndex((s) => s.id === step) + 1];

  return (
    <div className="flex gap-6">
      <div ref={contentRef} className="min-w-0 flex-1">
        {/* Cabeçalho da página do OVA: voltar, título, progresso e Tutor IA */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-line bg-white text-ink transition hover:bg-slate-50"
              aria-label={t("Voltar para a matéria", "Back to the course")}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="flex items-center gap-2 font-semibold text-brand">
                <BookOpenText size={18} aria-hidden="true" /> {ova.subject_nome ?? t("Módulo", "Module")}
              </p>
              <h1 className="text-2xl font-bold text-ink">{ova.ova_name}</h1>
            </div>
          </div>
          <button
            onClick={() => {
              setShowTutor((value) => !value);
              if (!showTutor) logInteraction(OVA_ASSISTANT_OPENED);
            }}
            className={`flex h-11 items-center gap-2 rounded-[8px] px-5 font-semibold transition ${
              showTutor ? "bg-indigo-50 text-brand" : "bg-brand text-white hover:bg-indigo-600"
            }`}
          >
            <Sparkles size={18} />
            {showTutor ? t("Fechar o chat", "Close chat") : t("Perguntar ao Engage-Agent", "Ask Engage-Agent")}
          </button>
        </div>

        {/* Barra de progresso de leitura (QF.2: perceptível por leitor de tela —
            é ela que destrava o quiz). */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={shownProgress}
          aria-label={t("Progresso de leitura", "Reading progress")}
          className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${shownProgress}%` }} />
        </div>

        {/* Plano 6 (B.1): stepper do módulo — cada passo tem URL própria. */}
        <nav aria-label={t("Passos do módulo", "Module steps")} className="mb-6">
          <ol className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = item.id === step;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onStepChange(item.id)}
                    aria-current={active ? "step" : undefined}
                    className={`flex w-full items-center gap-3 rounded-[8px] border p-3 text-left transition ${
                      active ? "border-brand bg-indigo-50" : "border-line bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold ${
                      active ? "bg-brand text-white" : "bg-slate-100 text-muted"
                    }`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`flex items-center gap-1.5 font-semibold ${active ? "text-indigo-800" : "text-ink"}`}>
                        <Icon size={16} aria-hidden="true" /> {item.label}
                      </span>
                      <span className="block text-xs text-muted">{item.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {error && (
          <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-6 text-rose-700">
            {t("Não foi possível carregar o conteúdo deste módulo.", "Couldn't load this module's content.")}
          </div>
        )}

        {!content && !error && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LoaderCircle className="animate-spin text-brand" size={32} aria-hidden="true" />
            <span className="sr-only">{t("Carregando", "Loading")}</span>
          </div>
        )}

        {content && step === "conteudo" && (
          <div className="space-y-6">
            {/* Hero / introdução */}
            {content.intro && (
              <section className="overflow-hidden rounded-[8px] bg-gradient-to-br from-[#04093b] to-brand p-8 text-white shadow-soft">
                {content.heroLabel && (
                  <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                    {content.heroLabel}
                  </span>
                )}
                <p className="mt-3 text-lg leading-relaxed text-white/90">{content.intro}</p>
              </section>
            )}

            {/* Seções do conteúdo */}
            {content.sections.map((section, sectionIndex) => (
              <section
                key={section.id}
                // Fase 2: o observer usa este nó para saber quando a seção está
                // sendo lida de fato (metade visível por pelo menos 1 s).
                ref={observeSection(section.id, sectionIndex)}
                className="rounded-[8px] border border-line bg-white p-7 shadow-soft"
              >
                {(section.heading || companionEnabled) && (
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                    {section.heading
                      ? <h2 className="text-2xl font-bold text-ink">{section.heading}</h2>
                      : <span />}
                    {companionEnabled && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => readSection(section)}
                          className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-brand transition hover:bg-indigo-50"
                          title={t("Ouvir esta seção", "Listen to this section")}
                        >
                          <Volume2 size={14} /> {t("Ouvir", "Listen")}
                        </button>
                        <button
                          onClick={() => {
                            track("companion_explain", "ova", ova.ova_id, { secao: section.heading });
                            askTutor(t(
                              `Explique a seção "${section.heading ?? "atual"}" com outras palavras.`,
                              `Explain the "${section.heading ?? "current"}" section in other words.`
                            ));
                          }}
                          className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-brand transition hover:bg-indigo-50"
                          title={t("Explicar esta seção", "Explain this section")}
                        >
                          <Sparkles size={14} aria-hidden="true" /> {t("Explicar", "Explain")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-5">
                  {section.blocks.map((block, index) => {
                    if (block.kind === "paragraph") {
                      return (
                        <p key={index} className="leading-relaxed text-slate-700">
                          {block.text}
                        </p>
                      );
                    }
                    if (block.kind === "image") {
                      return (
                        <img
                          key={index}
                          src={block.src}
                          alt={block.alt ?? ""}
                          loading="lazy"
                          className="mx-auto max-h-[420px] w-full rounded-[8px] object-contain"
                        />
                      );
                    }
                    if (block.kind === "carousel") {
                      return <Carousel key={index} items={block.items} onInteract={logInteraction} />;
                    }
                    return <Accordion key={index} items={block.items} onInteract={logInteraction} />;
                  })}

                </div>
              </section>
            ))}

            {/* Vídeos e áudios (mídias do banco) — fazem parte do conteúdo */}
            {hasMedia && (
              <section className="rounded-[8px] border border-line bg-white p-7 shadow-soft">
                <h2 className="mb-5 border-b border-line pb-3 text-2xl font-bold text-ink">
                  {t("Vídeos e áudios", "Videos & audio")}
                </h2>
                <div className="space-y-5">
                  {videoResources.map((resource) => (
                    <VideoPlayer
                      key={resource.resource_id}
                      url={resource.resource_url}
                      mediaType={resource.media_type}
                      title={resource.resource_title}
                      resourceId={resource.resource_id}
                      initialCoverageBitmap={resource.coverage_bitmap}
                      initialCoveragePerc={resource.coverage_perc}
                      onProgress={trackMedia(resource)}
                    />
                  ))}
                  {podcastResources.map((resource) => (
                    <AudioPlayer
                      key={resource.resource_id}
                      url={resource.resource_url}
                      title={resource.resource_title}
                      durationSeconds={resource.duration_seconds}
                      initialSeconds={resource.seconds_consumed}
                      resourceId={resource.resource_id}
                      onProgress={trackMedia(resource)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Passo 2 — atividades do módulo */}
        {step === "atividades" && (
          <section className="space-y-4 rounded-[8px] border border-line bg-white p-7 shadow-soft">
            <h2 className="border-b border-line pb-3 text-2xl font-bold text-ink">{t("Atividades", "Activities")}</h2>
            <p className="text-muted">
              {t("Coloque em prática o que você leu. Marque cada atividade quando terminar.",
                 "Put what you read into practice. Mark each activity when you're done.")}
            </p>
            {activityResources.map((resource) => (
              <div
                key={resource.resource_id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-line bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  <ListChecks className="text-brand" size={24} aria-hidden="true" />
                  <div className="font-bold text-ink">{resource.resource_title}</div>
                </div>
                {resource.completed ? (
                  <span className="flex items-center gap-2 rounded-[8px] bg-emerald-50 px-4 py-2 font-semibold text-emerald-700">
                    <CheckCircle2 size={18} aria-hidden="true" /> {t("Concluída", "Done")}
                  </span>
                ) : (
                  <button
                    onClick={() => completeActivity(resource)}
                    className="h-11 rounded-[8px] bg-teal px-5 font-semibold text-white"
                  >
                    {t("Marcar como concluída", "Mark as done")}
                  </button>
                )}
              </div>
            ))}
            {moduleCourses.map((course) => (
              <ExternalCourseCard key={course.resource_id} course={course} onApproved={onTracked} />
            ))}
          </section>
        )}

        {/* Passo 3 — quiz do módulo (com o modo desafio que morava na aba Quiz) */}
        {step === "quiz" && (
          <section className="rounded-[8px] border border-line bg-white p-7 shadow-soft">
            <h2 className="mb-5 border-b border-line pb-3 text-2xl font-bold text-ink">{t("Teste seus conhecimentos", "Test your knowledge")}</h2>
            <OvaQuiz
              ovaId={ova.ova_id}
              studentId={studentId}
              onTracked={onTracked}
              onGraded={onQuizGraded}
              onGoToContent={() => onStepChange("conteudo")}
              onOpenPractice={onOpenPractice}
            />
          </section>
        )}

        {/* Próximo passo — o aluno não precisa voltar ao topo para avançar */}
        {content && nextStep && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => onStepChange(nextStep.id)}
              className="h-11 rounded-[8px] bg-brand px-5 font-semibold text-white transition hover:bg-indigo-600"
            >
              {t(`Próximo: ${nextStep.label}`, `Next: ${nextStep.label}`)}
            </button>
          </div>
        )}
      </div>

      {/* Aba lateral fixa: quando o assistente está recolhido, fica sempre
          visível na lateral para o aluno reabrir e conversar sobre a leitura */}
      {!showTutor && (
        <button
          onClick={() => {
            setShowTutor(true);
            logInteraction(OVA_ASSISTANT_OPENED);
          }}
          className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-l-[10px] bg-brand py-4 pl-3 pr-2 font-semibold text-white shadow-soft transition hover:bg-indigo-600 [writing-mode:vertical-rl]"
          aria-label={t("Perguntar ao Engage-Agent", "Ask Engage-Agent")}
        >
          <Sparkles size={18} className="rotate-90" aria-hidden="true" />
          {t("Perguntar", "Ask")}
        </button>
      )}

      {/* Painel lateral retrátil do assistente do conteúdo */}
      {showTutor && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setShowTutor(false)}
            aria-hidden
          />
          <aside
            ref={asideRef}
            role={isDesktop ? undefined : "dialog"}
            aria-modal={isDesktop ? undefined : true}
            aria-label={isDesktop ? undefined : t("Chat do Engage-Agent", "Engage-Agent chat")}
            className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] p-4 lg:static lg:z-auto lg:w-[380px] lg:shrink-0 lg:p-0"
          >
            <div className="h-full lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
              <TutorChat
                ovaName={ova.ova_name}
                personaId={persona}
                messages={chat.messages}
                loading={chat.loading}
                onAsk={chat.ask}
                onClose={() => setShowTutor(false)}
              />
            </div>
          </aside>
        </>
      )}

      {/* CP.1 — companheiro de estudo flutuante (canto inferior-esquerdo). */}
      {companionEnabled && (
        <StudyCompanion
          personaId={persona}
          line={companion.line}
          speaking={speaking}
          visemeRef={visemeRef}
          muted={muted}
          hidden={hidden}
          onListen={listenCompanion}
          onStop={stop}
          onToggleMute={() => setMuted((m) => !m)}
          onDismiss={companion.dismiss}
          onHide={hideCompanion}
          onShow={showCompanion}
          onOpenTutor={() => setShowTutor(true)}
        />
      )}
    </div>
  );
};
