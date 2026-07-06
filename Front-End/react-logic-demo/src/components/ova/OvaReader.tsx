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
*/
import { ArrowLeft, BookOpenText, CheckCircle2, ListChecks, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  OvaResource,
  getOVAResources,
  registerInteraction,
  saveOVAProgress,
  saveResourceProgress
} from "../../services/api";
import { OvaContent, fetchOvaContent, ovaContextText } from "../../services/ovaContent";
import { AudioPlayer } from "../players/AudioPlayer";
import { MediaProgress, VideoPlayer } from "../players/VideoPlayer";
import { useToast } from "../ui/Toast";
import { useLanguage, useT } from "../../i18n";
import { Accordion } from "./Accordion";
import { Carousel } from "./Carousel";
import { OvaQuiz } from "./OvaQuiz";
import { TutorChat } from "./TutorChat";

const COMPLETED_PERC = 90;
const SYNC_INTERVAL_MS = 15000;
// Página que cabe na viewport (não rola) conta como lida após um tempo mínimo
// de permanência (A6) — sem isso, um OVA curto nunca completava (scroll ficava 0).
const SHORT_PAGE_MIN_SECONDS = 20;

interface OvaInfo {
  ova_id: number;
  ova_name: string;
  link: string;
}

interface OvaReaderProps {
  ova: OvaInfo;
  studentId: number;
  onBack: () => void;
  onTracked: () => void;
}

export const OvaReader = ({ ova, studentId, onBack, onTracked }: OvaReaderProps) => {
  const [content, setContent] = useState<OvaContent | null>(null);
  const [error, setError] = useState(false);
  const [resources, setResources] = useState<OvaResource[]>([]);
  // O assistente já aparece aberto na lateral em telas largas (o aluno conversa
  // sobre o que está lendo sem sair do OVA); em telas pequenas começa recolhido.
  const [showTutor, setShowTutor] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  const [progress, setProgress] = useState(0);
  // Elemento do artigo — o scroll de leitura é medido POR CONTEÚDO, não pela
  // janela (A6), para não confundir altura de tela com consumo do texto.
  const contentRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const t = useT();
  const { lang } = useLanguage();

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
      contentScrollable()
        ? maxScrollRef.current >= COMPLETED_PERC
        : sessionSecondsRef.current >= SHORT_PAGE_MIN_SECONDS;

    const persist = (refreshProfile: boolean, keepalive = false) => {
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
      if (contentScrollable()) bumpProgress(readingPerc());
    };

    const ticker = window.setInterval(() => {
      sessionSecondsRef.current += 1;
      unsyncedRef.current += 1;
      // Em página curta o progresso é por tempo (não há scroll a medir)
      if (!contentScrollable()) {
        bumpProgress(Math.min(100, Math.round((sessionSecondsRef.current / SHORT_PAGE_MIN_SECONDS) * 100)));
      }
    }, 1000);
    const syncer = window.setInterval(() => persist(false), SYNC_INTERVAL_MS);
    const onPageHide = () => persist(false, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    onScroll();

    return () => {
      window.clearInterval(ticker);
      window.clearInterval(syncer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      persist(true, true);
    };
  }, [ova.ova_id, onTracked]);

  const tutorContext = useMemo(() => (content ? ovaContextText(content) : ""), [content]);

  const logInteraction = (label: string) => {
    registerInteraction(ova.ova_id, label).catch(() => undefined);
  };

  const trackMedia = (resource: OvaResource) => (state: MediaProgress) => {
    saveResourceProgress({
      resource_id: resource.resource_id,
      perc_consumed: state.perc,
      seconds_consumed: state.seconds,
      completed: state.completed
    })
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
  const hasMedia = videoResources.length + podcastResources.length + activityResources.length > 0;

  return (
    <div className="flex gap-6">
      <div ref={contentRef} className="min-w-0 flex-1">
        {/* Cabeçalho da página do OVA: voltar, título, progresso e Tutor IA */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-line bg-white text-ink transition hover:bg-slate-50"
              aria-label={t("Voltar", "Back")}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="flex items-center gap-2 font-semibold text-brand">
                <BookOpenText size={18} /> {t("Leitura interativa", "Interactive reading")}
              </p>
              <h1 className="text-2xl font-bold text-ink">{ova.ova_name}</h1>
            </div>
          </div>
          <button
            onClick={() => {
              setShowTutor((value) => !value);
              if (!showTutor) logInteraction("Abriu o assistente do OVA");
            }}
            className={`flex h-11 items-center gap-2 rounded-[8px] px-5 font-semibold transition ${
              showTutor ? "bg-indigo-50 text-brand" : "bg-brand text-white hover:bg-indigo-600"
            }`}
          >
            <Sparkles size={18} />
            {showTutor ? t("Ocultar assistente", "Hide assistant") : t("Tirar dúvidas com a IA", "Ask the AI")}
          </button>
        </div>

        {/* Barra de progresso de leitura */}
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>

        {error && (
          <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-6 text-rose-700">
            {t("Não foi possível carregar o conteúdo deste OVA.", "Couldn't load this OVA's content.")}
          </div>
        )}

        {!content && !error && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LoaderCircle className="animate-spin text-brand" size={32} />
          </div>
        )}

        {content && (
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
            {content.sections.map((section) => (
              <section key={section.id} className="rounded-[8px] border border-line bg-white p-7 shadow-soft">
                {section.heading && (
                  <h2 className="mb-5 border-b border-line pb-3 text-2xl font-bold text-ink">
                    {section.heading}
                  </h2>
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

                  {/* Quiz embutido na seção de conclusão */}
                  {section.hasQuiz && (
                    <div className="pt-2">
                      <h3 className="mb-4 text-xl font-bold text-ink">{t("Teste seus conhecimentos", "Test your knowledge")}</h3>
                      <OvaQuiz ovaId={ova.ova_id} studentId={studentId} onTracked={onTracked} />
                    </div>
                  )}
                </div>
              </section>
            ))}

            {/* Recursos adicionais (mídias do banco) */}
            {hasMedia && (
              <section className="rounded-[8px] border border-line bg-white p-7 shadow-soft">
                <h2 className="mb-5 border-b border-line pb-3 text-2xl font-bold text-ink">
                  {t("Recursos adicionais", "Additional resources")}
                </h2>
                <div className="space-y-5">
                  {videoResources.map((resource) => (
                    <VideoPlayer
                      key={resource.resource_id}
                      url={resource.resource_url}
                      mediaType={resource.media_type}
                      title={resource.resource_title}
                      initialPerc={resource.perc_consumed}
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
                      onProgress={trackMedia(resource)}
                    />
                  ))}
                  {activityResources.map((resource) => (
                    <div
                      key={resource.resource_id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-line bg-white p-5"
                    >
                      <div className="flex items-center gap-3">
                        <ListChecks className="text-brand" size={24} />
                        <div>
                          <div className="font-bold text-ink">{resource.resource_title}</div>
                          <div className="text-sm text-muted">{t("Atividade prática", "Practical activity")}</div>
                        </div>
                      </div>
                      {resource.completed ? (
                        <span className="flex items-center gap-2 rounded-[8px] bg-emerald-50 px-4 py-2 font-semibold text-emerald-700">
                          <CheckCircle2 size={18} /> {t("Concluída", "Completed")}
                        </span>
                      ) : (
                        <button
                          onClick={() => completeActivity(resource)}
                          className="h-11 rounded-[8px] bg-teal px-5 font-semibold text-white"
                        >
                          {t("Marcar como concluída", "Mark as completed")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Aba lateral fixa: quando o assistente está recolhido, fica sempre
          visível na lateral para o aluno reabrir e conversar sobre a leitura */}
      {!showTutor && (
        <button
          onClick={() => {
            setShowTutor(true);
            logInteraction("Abriu o assistente do OVA");
          }}
          className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-l-[10px] bg-brand py-4 pl-3 pr-2 font-semibold text-white shadow-soft transition hover:bg-indigo-600 [writing-mode:vertical-rl]"
          aria-label={t("Abrir o assistente do conteúdo", "Open the content assistant")}
        >
          <Sparkles size={18} className="rotate-90" />
          {t("Pergunte à IA", "Ask the AI")}
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
          <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] p-4 lg:static lg:z-auto lg:w-[380px] lg:shrink-0 lg:p-0">
            <div className="h-full lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
              <TutorChat
                ovaId={ova.ova_id}
                ovaName={ova.ova_name}
                context={tutorContext}
                onClose={() => setShowTutor(false)}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
};
