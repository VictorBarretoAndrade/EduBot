/*
CP.1 (Plano 3) — Widget do companheiro de estudo no leitor de OVA.

Personagem flutuante no canto inferior-ESQUERDO (o botão do tutor fica à direita):
o avatar escolhido (CompanionAvatar, com lip-sync) + um balão de fala com as
mensagens do motor de gatilhos (useCompanionScript).

Interação (feedback do usuário): CLICAR no personagem abre um MENU de ações — o
gesto natural "clico nele e vejo o que dá pra fazer": tirar dúvida com o tutor,
ouvir a dica atual, silenciar e ocultar. O balão de fala continua aparecendo
sozinho nos gatilhos (abrir/50%/concluir/quiz) com ▶ ouvir e dispensar.

A11y: o balão é aria-live="polite"; o avatar é um botão com aria-haspopup;
respeita prefers-reduced-motion (via CompanionAvatar/CSS).
*/
import { MutableRefObject, useState } from "react";
import { Bot, EyeOff, MessageCircle, MoreHorizontal, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { CompanionAvatar } from "../brand/CompanionAvatar";
import { CompanionLine } from "../../hooks/useCompanionScript";
import { useT } from "../../i18n";

interface StudyCompanionProps {
  personaId: string;
  line: CompanionLine | null;
  speaking: boolean;
  visemeRef: MutableRefObject<string>;
  muted: boolean;
  hidden: boolean;
  onListen: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  onDismiss: () => void;
  onHide: () => void;
  onShow: () => void;
  onOpenTutor: () => void;
}

export const StudyCompanion = ({
  personaId, line, speaking, visemeRef, muted, hidden,
  onListen, onStop, onToggleMute, onDismiss, onHide, onShow, onOpenTutor,
}: StudyCompanionProps) => {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  // Oculto: só um botão discreto para reabrir (nunca vira um beco sem saída).
  if (hidden) {
    return (
      <button
        onClick={onShow}
        className="fixed bottom-4 left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-soft transition hover:bg-indigo-600"
        aria-label={t("Mostrar o EduBot", "Show EduBot")}
        title={t("Mostrar o EduBot", "Show EduBot")}
      >
        <Bot size={22} />
      </button>
    );
  }

  const menuItem = "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-indigo-50";

  return (
    <div className="fixed bottom-4 left-4 z-30 flex max-w-[min(340px,calc(100vw-2rem))] items-end gap-2">
      <style>{`
        @keyframes ebPop { 0%{transform:scale(0.96);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes ebCeleb { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} 55%{transform:translateY(0)} 75%{transform:translateY(-4px)} }
        .eb-pop { animation: ebPop .18s ease-out; }
        .eb-celeb { animation: ebCeleb .7s ease-in-out; }
        @media (prefers-reduced-motion: reduce) { .eb-pop, .eb-celeb { animation: none !important; } }
      `}</style>

      {/* Avatar CLICÁVEL: abre o menu de ações. */}
      <div className="relative shrink-0">
        {menuOpen && (
          <>
            {/* clique fora fecha o menu */}
            <div className="fixed inset-0 z-0" onClick={close} aria-hidden />
            <div
              role="menu"
              className="eb-pop absolute bottom-full left-0 z-10 mb-2 w-56 overflow-hidden rounded-[12px] border border-line bg-white py-1 shadow-soft"
            >
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t("O que posso fazer por você?", "What can I do for you?")}
              </div>
              <button role="menuitem" className={menuItem} onClick={() => { onOpenTutor(); close(); }}>
                <MessageCircle size={16} className="text-brand" /> {t("Tirar uma dúvida", "Ask a question")}
              </button>
              {line && !muted && (
                <button role="menuitem" className={menuItem} onClick={() => { onListen(); close(); }}>
                  <Play size={16} className="text-brand" /> {t("Ouvir a dica atual", "Listen to the current tip")}
                </button>
              )}
              <button role="menuitem" className={menuItem} onClick={() => { onToggleMute(); close(); }}>
                {muted ? <VolumeX size={16} className="text-brand" /> : <Volume2 size={16} className="text-brand" />}
                {muted ? t("Reativar a voz", "Unmute voice") : t("Silenciar a voz", "Mute voice")}
              </button>
              <button role="menuitem" className={menuItem} onClick={() => { onHide(); close(); }}>
                <EyeOff size={16} className="text-brand" /> {t("Ocultar o EduBot", "Hide EduBot")}
              </button>
            </div>
          </>
        )}

        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={t("Clique para ver o que posso fazer", "Click to see what I can do")}
          className={`relative rounded-2xl outline-none ring-brand/30 transition hover:ring-4 focus-visible:ring-4 ${line?.kind === "celebrating" ? "eb-celeb" : ""}`}
        >
          <CompanionAvatar personaId={personaId} speaking={speaking} visemeRef={visemeRef} size={92} />
          {/* dica visual de que o boneco é clicável (abre menu) */}
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-brand shadow-sm">
            <MoreHorizontal size={14} />
          </span>
        </button>
      </div>

      {/* Balão de fala (aparece nos gatilhos): texto + ação + ▶ ouvir. */}
      {line && (
        <div className="mb-1 min-w-0 flex-1">
          <div
            className="eb-pop relative rounded-[14px] rounded-bl-none border border-line bg-white p-3 shadow-soft"
            role="status"
            aria-live="polite"
          >
            <button
              onClick={onDismiss}
              aria-label={t("Dispensar", "Dismiss")}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-muted shadow-sm transition hover:bg-slate-50"
            >
              <X size={12} />
            </button>
            <p className="text-sm leading-snug text-slate-800">{line.text}</p>

            {line.action && (
              <button
                onClick={line.action.run}
                className="mt-2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-600"
              >
                {line.action.label}
              </button>
            )}

            {!muted && (
              <div className="mt-2">
                {speaking ? (
                  <button
                    onClick={onStop}
                    className="flex items-center gap-1 rounded-full border border-line bg-slate-50 px-2 py-1 text-[11px] font-semibold text-brand"
                  >
                    <Pause size={12} /> {t("Parar", "Stop")}
                  </button>
                ) : (
                  <button
                    onClick={onListen}
                    className="flex items-center gap-1 rounded-full border border-line bg-slate-50 px-2 py-1 text-[11px] font-semibold text-brand transition hover:bg-indigo-50"
                  >
                    <Play size={12} /> {t("Ouvir", "Listen")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
