/*
MELHORIA — Sistema de toasts (avisos não-bloqueantes).

Antes, falhas ao salvar progresso viravam um silencioso `console.error`: se a API
caísse, o aluno achava que tinha progredido. Agora qualquer tela pode chamar
`useToast()` para dar feedback visível de sucesso/erro. Provider montado uma vez
em main.tsx, envolvendo o App.
*/
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
};

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info
};

const STYLES: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-line bg-white text-ink"
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (message: string) => notify(message, "success"),
      error: (message: string) => notify(message, "error")
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex w-80 max-w-[90vw] flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div
              key={toast.id}
              role="status"
              className={`flex items-start gap-3 rounded-[8px] border p-4 shadow-soft ${STYLES[toast.kind]}`}
            >
              <Icon size={20} className="mt-0.5 shrink-0" />
              <span className="flex-1 text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 opacity-60 transition hover:opacity-100"
                aria-label="Fechar aviso"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
