/*
Tutor IA por OVA — o PERSONAGEM conversa com o aluno sobre o conteúdo.

CP.4 (Plano 3):
  - o estado do chat vive no OvaReader (hook useTutorChat) — fechar/reabrir o painel
    NÃO perde a conversa (M6); este componente é a UI (input + render);
  - o header mostra a PERSONA escolhida (avatar + nome) em vez do logo genérico (M7);
  - cada resposta pode ser OUVIDA na voz da persona (▶), com a boca do avatar animada.

O tutor continua preso ao material do OVA (grounding no backend); a persona muda só
o TOM. As "Fontes" (seções que embasaram a resposta) seguem exibidas.
*/
import { ArrowRight, Pause, Play, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage } from "../../hooks/useTutorChat";
import { useToast } from "../ui/Toast";
import { useLanguage, useT } from "../../i18n";
import { CompanionAvatar } from "../brand/CompanionAvatar";
import { Explorador } from "../brand/Explorador";
import { AVATAR_PERSONAS, personaName } from "../brand/avatars";
import { useSpeech } from "../../hooks/useSpeech";

interface TutorChatProps {
  ovaName: string;
  personaId: string;
  messages: ChatMessage[];
  loading: boolean;
  onAsk: (question: string) => Promise<boolean>;
  onClose: () => void;
}

function tutorName(personaId: string, lang: "pt" | "en", t: (pt: string, en: string) => string): string {
  const p = AVATAR_PERSONAS.find((x) => x.id === personaId);
  return p ? personaName(p, lang) : lang === "en" ? "Learnia tutor" : "Tutor Learnia";
}

export const TutorChat = ({ ovaName, personaId, messages, loading, onAsk, onClose }: TutorChatProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const { speak, stop, speaking, visemeRef } = useSpeech();
  const [input, setInput] = useState("");
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  // VI.3 (Plano 4): trecho da fonte que está expandido (chave "msgIdx-srcIdx").
  // Substitui o `title` (invisível a teclado/touch) por um bloco expansível.
  const [openSource, setOpenSource] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const SUGGESTIONS = [
    t("Resuma os principais pontos deste conteúdo", "Summarize the main points of this content"),
    t("Explique o conceito mais importante com outras palavras", "Explain the most important concept in other words"),
    t("Me dê um exemplo prático do que estudei", "Give me a real-world example of what I studied"),
  ];

  useEffect(() => {
    // VI.2: `scroll-behavior: auto` do CSS não afeta o `behavior` explícito do
    // scrollTo — respeitamos a preferência aqui.
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, loading]);

  // AC.3 (Plano 4): região viva DEDICADA — anuncia só a última fala relevante
  // (o "pensando" enquanto carrega, ou a resposta do tutor ao chegar). Um
  // aria-live na lista rolável faria o leitor de tela repetir mensagens antigas
  // a cada re-render do React.
  const liveMessage = useMemo(() => {
    if (loading) return t("O tutor está pensando...", "The tutor is thinking...");
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") return messages[i].content;
    }
    return "";
  }, [messages, loading, t]);

  // Quando a fala termina (speaking cai), limpa o índice em reprodução.
  useEffect(() => {
    if (!speaking) setSpeakingIdx(null);
  }, [speaking]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    setInput("");
    const ok = await onAsk(text);
    if (!ok) {
      toast.error(t("Não foi possível falar com o tutor agora. Tente novamente.", "Couldn't reach the assistant right now. Try again."));
      setInput(text);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  const listen = (idx: number, content: string) => {
    setSpeakingIdx(idx);
    speak(content, lang, personaId); // voz da persona (AV.4)
  };

  // Relevo: o Explorador muda de expressão pelo MOMENTO da conversa — pensando
  // (gerando resposta), ouvindo (o aluno digita), explicando (respondeu).
  const estado = loading ? "pensando" : input.trim() ? "ouvindo" : "explicando";
  const name = tutorName(personaId, lang, t);

  return (
    <div className="flex h-full flex-col overflow-hidden card">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="xp-av h-10 w-10">
            <CompanionAvatar personaId={personaId} speaking={speaking} visemeRef={visemeRef} size={40} estado={estado} still={false} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight text-ink">{name}</div>
            <div className="truncate text-[12px] text-muted">
              {t("Explorador · conversando sobre", "Explorer · talking about")} “{ovaName}”
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t("Fechar", "Close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted transition-colors duration-rapido hover:bg-surface-2 hover:text-ink"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {/* AC.3: região viva dedicada (invisível) — leitor de tela anuncia a resposta do tutor. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveMessage}</div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto bg-bg px-4 py-5">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          if (isUser) {
            return (
              <div key={index} className="msg-q text-ink">
                <span className="sr-only">{t("Você:", "You:")} </span>
                {message.content}
              </div>
            );
          }
          return (
            <div key={index} className="max-w-[94%]">
              {/* Relevo: "Tutor Learnia" em mono; resposta com filete em Trilha. */}
              <div className="msg-who" aria-hidden="true">{name}</div>
              <div className="msg-a whitespace-pre-wrap text-ink">
                <span className="sr-only">{name}: </span>
                {message.content}
              </div>

              {/* Ouvir a resposta na voz da persona (não na saudação inicial) +
                  fontes: seções do OVA que embasaram a resposta (VI.3: o trecho
                  abre num bloco expansível, acessível por teclado e toque). */}
              {((index > 0) || (message.sources && message.sources.length > 0)) && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[15px]">
                  {index > 0 && (
                    <button
                      onClick={() => (speakingIdx === index ? stop() : listen(index, message.content))}
                      className="chip"
                    >
                      {speakingIdx === index ? <Pause size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
                      {speakingIdx === index ? t("Parar", "Stop") : t("Ouvir", "Listen")}
                    </button>
                  )}
                  {message.sources?.map((source, sourceIndex) => {
                    const key = `${index}-${sourceIndex}`;
                    const isOpen = openSource === key;
                    return (
                      <button
                        key={sourceIndex}
                        type="button"
                        onClick={() => setOpenSource(isOpen ? null : key)}
                        aria-expanded={isOpen}
                        className={`chip ${isOpen ? "border-ink bg-surface-2" : ""}`}
                      >
                        <span aria-hidden="true">◆</span>
                        {source.secao}
                      </button>
                    );
                  })}
                </div>
              )}
              {message.sources?.map((source, sourceIndex) =>
                openSource === `${index}-${sourceIndex}` ? (
                  <p
                    key={`trecho-${sourceIndex}`}
                    className="ml-[15px] mt-2 card px-3 py-2 text-[13px] leading-relaxed text-muted"
                  >
                    {source.trecho}
                  </p>
                ) : null
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <span className="xp-av h-8 w-8">
              <Explorador estado="pensando" variant="cabeca" size={32} decorative />
            </span>
            <span className="num text-[12px] text-muted">{t("Lendo o seu rastro…", "Reading your trail…")}</span>
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div className="space-y-2 pt-1">
            <p className="k k-muted">{t("Sugestões", "Suggestions")}</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => ask(suggestion)}
                className="block w-full card px-3 py-2.5 text-left text-sm text-ink transition-colors duration-rapido hover:border-ink"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("Pergunte sobre este conteúdo...", "Ask about this content...")}
            aria-label={t("Pergunte sobre este conteúdo", "Ask about this content")}
            className="field h-11 py-0 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label={t("Enviar", "Send")}
            className="btn btn-acc h-11 w-11 shrink-0 p-0"
          >
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
        {/* O tutor responde preso ao material do módulo (grounding no backend). */}
        <p className="num mt-2 text-[10.5px] text-muted">
          {t("Respostas a partir do material deste módulo", "Answers drawn from this module's material")}
        </p>
      </form>
    </div>
  );
};
