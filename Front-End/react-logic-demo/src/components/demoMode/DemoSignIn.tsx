/*
Migration 026 — entrada no modo DEMO pela tela de login.

"Entrar com Google" usa o botão oficial do Google Identity Services (GIS): o
Google devolve um ID token ao navegador e o backend o valida (POST /auth/google).
Quem entra ganha um workspace de demonstração: é coordenador de uma turma de
exemplo e pode trocar para a visão de aluno a qualquer momento.

O botão "Entrar no Demo" (EDUBOT_DEMO_SEM_LOGIN=1) dispensa qualquer login: cada
navegador ganha a própria turma e a reabre ao voltar. O Google é opcional e serve
para guardar a turma na conta da pessoa (outro computador, outro navegador).
Tudo vem do backend (GET /auth/config); sem nenhum dos dois, o bloco não aparece.
*/
import { LoaderCircle, PlayCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, AuthConfig, Session, getAuthConfig, loginDemo, loginWithGoogle } from "../../services/api";
import { useLanguage, useT } from "../../i18n";

const GIS_SRC = "https://accounts.google.com/gsi/client";

interface GoogleId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let gisPromise: Promise<GoogleId> | null = null;
const loadGis = (): Promise<GoogleId> => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("gis")));
      script.onerror = () => {
        gisPromise = null;
        reject(new Error("gis"));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
};

// A home page (Front-End/files/index.html) leva o botão "Demo" para /app/?demo=1:
// a demonstração abre sozinha, sem passar pelo clique daqui. O parâmetro é lido
// uma vez ao carregar o app e sai da URL, para o demo não reabrir sozinho depois
// de um logout. Já logado, ele é só descartado.
let demoIntent = (() => {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("demo") !== "1") return false;
    url.searchParams.delete("demo");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
})();

interface DemoSignInProps {
  onLogged: (session: Session) => void;
}

export const DemoSignIn = ({ onLogged }: DemoSignInProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [gisFailed, setGisFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  // O callback do GIS é registrado uma vez; a ref mantém o onLogged/t atuais.
  const handlerRef = useRef<(credential: string) => void>(() => undefined);

  useEffect(() => {
    getAuthConfig()
      .then(setConfig)
      .catch(() => setConfig({ google_client_id: null, demo_sem_login: false }));
  }, []);

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 429)
      setError(t("Muitas tentativas seguidas. Aguarde um minuto e tente de novo.", "Too many attempts in a row. Please wait a minute and try again."));
    else if (err instanceof ApiError && err.status === 401)
      setError(t("O Google não confirmou sua conta. Tente de novo.", "Google couldn't confirm your account. Please try again."));
    else setError(t("Não conseguimos abrir a demonstração agora. Tente de novo em instantes.", "We couldn't open the demo right now. Please try again in a moment."));
  };

  handlerRef.current = (credential: string) => {
    setError(null);
    setBusy(true);
    loginWithGoogle(credential)
      .then(onLogged)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const clientId = config?.google_client_id;
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGis()
      .then((gis) => {
        if (!active || !buttonRef.current) return;
        gis.initialize({
          client_id: clientId,
          callback: (response) => response.credential && handlerRef.current(response.credential),
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true
        });
        buttonRef.current.innerHTML = "";
        gis.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          // O GIS aceita largura entre 200 e 400 px.
          width: Math.min(400, Math.max(200, buttonRef.current.offsetWidth || 320)),
          locale: lang === "en" ? "en" : "pt-BR"
        });
      })
      .catch(() => active && setGisFailed(true));
    return () => {
      active = false;
    };
  }, [clientId, lang]);

  const enterDemo = () => {
    setError(null);
    setBusy(true);
    loginDemo()
      .then(onLogged)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  // Veio do botão "Demo" da home: entra direto (se o demo sem login estiver ligado;
  // senão a pessoa vê o bloco do Google normalmente).
  useEffect(() => {
    if (!config || !demoIntent) return;
    demoIntent = false;
    if (config.demo_sem_login) enterDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  if (!config || (!config.google_client_id && !config.demo_sem_login)) return null;

  return (
    <section aria-labelledby="demo-title" className="mt-6">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t("ou", "or")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-5 rounded-[8px] border border-indigo-200 bg-indigo-50/60 p-4">
        <h2 id="demo-title" className="flex items-center gap-2 font-bold text-ink">
          <Sparkles size={18} className="text-brand" aria-hidden="true" />
          {t("Experimente a versão DEMO", "Try the DEMO")}
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          {t(
            "Ganhe uma turma de demonstração só sua: você é o coordenador, cria alunos e acompanha o painel — e pode trocar para a visão de aluno quando quiser.",
            "Get a demo class of your own: you're the coordinator, you can add students and follow the dashboard — and switch to the student view anytime."
          )}
        </p>

        {config.demo_sem_login && (
          <>
            <button
              type="button"
              onClick={enterDemo}
              disabled={busy}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-ink font-bold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:bg-slate-400"
            >
              <PlayCircle size={20} aria-hidden="true" />
              {t("Entrar no Demo", "Enter the demo")}
            </button>
            <p className="mt-1.5 text-center text-xs text-muted">
              {t("Sem cadastro. Sua turma fica salva neste navegador.", "No sign-up. Your class is saved in this browser.")}
            </p>
          </>
        )}

        {config.google_client_id && (
          <div className="mt-4">
            {config.demo_sem_login && (
              <p className="mb-2 text-center text-xs text-muted">
                {t("Ou entre com o Google para abrir sua turma em qualquer computador:", "Or sign in with Google to open your class on any computer:")}
              </p>
            )}
            <div ref={buttonRef} className="flex min-h-[44px] w-full justify-center" />
            {gisFailed && (
              <p className="mt-2 text-sm text-rose-700">
                {t("Não foi possível carregar o botão do Google (bloqueador de conteúdo?).", "Couldn't load the Google button (content blocker?).")}
              </p>
            )}
          </div>
        )}

        {busy && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            {t("Preparando sua turma de demonstração...", "Setting up your demo class...")}
          </p>
        )}
        {error && <p role="alert" className="mt-3 rounded-[8px] bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      </div>
    </section>
  );
};
