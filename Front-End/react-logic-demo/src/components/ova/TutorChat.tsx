/*
NOVA FUNCIONALIDADE — Chat de Tutor IA por OVA.

Painel lateral retrátil dentro da página do OVA. O aluno pergunta e recebe
respostas de um tutor que conhece SOMENTE o conteúdo daquele OVA (o material é
enviado como contexto — ver services/ovaContent.ts e backend edubot_agent/
tutor.py). Hoje o "cérebro" é mockado, mas o contrato já é o da LLM real.
*/
import { Bot, BookMarked, LoaderCircle, Send, User, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { TutorMessage, TutorSource, tutorChat } from "../../services/api";
import { useToast } from "../ui/Toast";
import { useT } from "../../i18n";
import { EduBotLogo } from "../brand/EduBotLogo";

// Mensagem do chat com as fontes (seções do OVA) que embasaram a resposta.
type ChatMessage = TutorMessage & { sources?: TutorSource[] };

interface TutorChatProps {
  ovaId: number;
  ovaName: string;
  context: string;
  onClose: () => void;
}

export const TutorChat = ({ ovaId, ovaName, context, onClose }: TutorChatProps) => {
  const t = useT();
  const SUGGESTIONS = [
    t("Resuma os principais pontos deste conteúdo", "Summarize the main points of this content"),
    t("Explique o conceito mais importante com outras palavras", "Explain the most important concept in other words"),
    t("Me dê um exemplo prático do que estudei", "Give me a practical example of what I studied")
  ];
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: t(
        `Olá! Posso conversar com você sobre o que está lendo agora, em "${ovaName}". Pergunte o que quiser sobre este conteúdo. 😊`,
        `Hi! I can talk with you about what you're reading now, in "${ovaName}". Ask anything about this content. 😊`
      )
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    const history: TutorMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      // Envia só o histórico de diálogo (sem a saudação inicial sintética).
      const dialog = history.filter(
        (m, i) => !(i === 0 && m.role === "assistant")
      );
      const { reply, sources } = await tutorChat(ovaId, context, dialog);
      setMessages((current) => [...current, { role: "assistant", content: reply, sources }]);
    } catch {
      toast.error(t("Não foi possível falar com o tutor agora. Tente novamente.", "Couldn't reach the assistant right now. Try again."));
      setMessages((current) => current.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[8px] border border-line bg-white shadow-soft">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-brand to-indigo-500 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 p-1">
            <EduBotLogo size={30} />
          </div>
          <div>
            <div className="font-bold leading-tight">{t("Professor Mediador", "Mediating Professor")}</div>
            <div className="text-xs text-white/80">{t("Conversando sobre", "Talking about")} “{ovaName}”</div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t("Fechar", "Close")}
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/20"
        >
          <X size={18} />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          return (
            <div key={index} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isUser ? "bg-coral text-white" : "bg-brand text-white"
                }`}
              >
                {isUser ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`flex max-w-[80%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                <div
                  className={`whitespace-pre-wrap rounded-[12px] px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? "rounded-tr-none bg-brand text-white"
                      : "rounded-tl-none border border-line bg-white text-slate-700"
                  }`}
                >
                  {message.content}
                </div>
                {/* Referenciação automática: seções do OVA que embasaram a resposta */}
                {!isUser && message.sources && message.sources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {message.sources.map((source, sourceIndex) => (
                      <span
                        key={sourceIndex}
                        title={source.trecho}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-slate-50 px-2.5 py-1 text-xs text-muted"
                      >
                        <BookMarked size={12} className="text-brand" />
                        {source.secao}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <Bot size={16} />
            </div>
            <div className="flex items-center gap-2 rounded-[12px] rounded-tl-none border border-line bg-white px-4 py-2.5 text-sm text-muted">
              <LoaderCircle size={15} className="animate-spin" />
              {t("Pensando...", "Thinking...")}
            </div>
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div className="space-y-2 pt-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("Sugestões", "Suggestions")}</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => ask(suggestion)}
                className="block w-full rounded-[8px] border border-line bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand hover:bg-indigo-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line bg-white p-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("Pergunte sobre este conteúdo...", "Ask about this content...")}
          className="h-11 w-full rounded-[8px] border border-line bg-slate-50 px-4 text-sm text-ink outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label={t("Enviar", "Send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-brand text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
