/*
INTEGRAÇÃO (4.2) — Tela de login do frontend React.
Autentica RA (ou nome de usuário) + senha no POST /login do backend; o token
devolvido é guardado pelo api.ts e enviado em todas as chamadas seguintes.

Migration 026 — "Entrar com Google" abre o modo DEMO (components/demoMode/DemoSignIn).

Plano 6 — usabilidade:
  - "Esqueci minha senha": não há e-mail cadastrado nem envio de e-mail; o pedido
    vira um alerta para a coordenação da turma, que gera uma senha temporária.
  - "Esqueci meu RA ou usuário": onde encontrar o RA e o login pelo nome.
  - mostrar/ocultar senha, aviso de Caps Lock, PT/EN já na entrada, autocomplete
    do navegador e mensagem própria para "muitas tentativas" (429).
*/
import { ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { FormEvent, KeyboardEvent, useState } from "react";
import { ApiError, Session, login, requestPasswordReset } from "../services/api";
import { track } from "../services/events";
import { useT } from "../i18n";
import { LearniaLogo } from "./brand/LearniaLogo";
import { TopoMap } from "./brand/TopoMap";
import { LangSwitch, ThemeToggle } from "./ui/ShellControls";
import { DemoSignIn } from "./demoMode/DemoSignIn";

interface LoginProps {
  onLogged: (session: Session) => void;
}

type Mode = "login" | "forgotPassword" | "forgotId" | "resetSent";

// Identidade "Relevo": campo com borda forte (3:1), links em Trilha (texto).
const inputClass = "field h-11";
const linkClass =
  "rounded-sm text-sm font-semibold text-trail-text underline decoration-1 underline-offset-[3px] hover:decoration-2";

export const Login = ({ onLogged }: LoginProps) => {
  const t = useT();
  const [mode, setMode] = useState<Mode>("login");
  const [ra, setRa] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const go = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  const errorMessage = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return t("RA/usuário ou senha incorretos.", "Wrong ID/username or password.");
    if (err instanceof ApiError && err.status === 429)
      return t("Muitas tentativas seguidas. Aguarde um minuto e tente de novo.", "Too many attempts in a row. Please wait a minute and try again.");
    return t("Não conseguimos conectar. Tente de novo em instantes.", "We couldn't connect. Please try again in a moment.");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(ra.trim(), password);
      // D.1: evento de sessão iniciada (o token já foi armazenado por login()).
      track("logged_in", "session", session.student_id);
      onLogged(session);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(ra.trim());
      setMode("resetSent");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onPasswordKey = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  const backToLogin = (
    <button type="button" onClick={() => go("login")} className={`mt-6 flex items-center gap-1.5 ${linkClass}`}>
      <ArrowLeft size={16} aria-hidden="true" /> {t("Voltar para o login", "Back to sign in")}
    </button>
  );

  return (
    <div className="min-h-screen bg-bg text-ink lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(440px,1fr)]">
      {/* Mapa (só desktop): curvas de nível, a trilha até o cume e a promessa da home. */}
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <TopoMap variant="login" trilha />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <LearniaLogo height={30} />
          <div className="max-w-[560px]">
            <div className="k k-muted">S 12°58′ · O 38°30′ · SALVADOR, BAHIA</div>
            <p className="mt-4 text-[44px] font-bold leading-[1.02] tracking-[-0.045em] xl:text-[52px]">
              {t("Todo aluno tem um relevo. A Learnia traça a trilha até a meta.", "Every student has a terrain. Learnia draws the trail to the goal.")}
            </p>
            <p className="mt-4 max-w-[460px] text-[17px] leading-[1.55] text-muted">
              {t(
                "Cada interação vira um ponto no mapa. O professor define a cota; a Learnia mostra o caminho mais curto para chegar lá.",
                "Every interaction becomes a point on the map. The teacher sets the goal; Learnia shows the shortest path to get there."
              )}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-line px-5 lg:border-0 lg:px-10">
          <span className="lg:invisible">
            <LearniaLogo height={26} />
          </span>
          {/* Idioma já na entrada: quem não lê português não precisa entrar para trocar. */}
          <div className="flex items-center gap-2.5">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-10">
        {mode === "login" && (
          <>
            <div className="k">{t("Entrar", "Sign in")}</div>
            <h1 className="mt-2 text-[32px] font-bold leading-[1.05] tracking-[-0.04em] text-ink">{t("Entrar na plataforma", "Sign in to the platform")}</h1>
            <p className="mt-2 text-muted">{t("Use seu RA (ou usuário) e a senha da instituição.", "Use your student ID (or username) and school password.")}</p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="ra" className="mb-1.5 block text-sm font-semibold text-ink">{t("RA ou usuário", "Student ID or username")}</label>
                <input
                  id="ra"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={ra}
                  onChange={(event) => setRa(event.target.value)}
                  className={inputClass}
                  placeholder={t("Ex.: 1", "e.g. 1")}
                  autoFocus
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-ink">{t("Senha", "Password")}</label>
                  <button type="button" onClick={() => go("forgotPassword")} className={linkClass}>
                    {t("Esqueci minha senha", "Forgot password?")}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyUp={onPasswordKey}
                    onKeyDown={onPasswordKey}
                    onBlur={() => setCapsLock(false)}
                    className={`${inputClass} pr-12`}
                    placeholder="••••••"
                    aria-invalid={Boolean(error)}
                    aria-describedby={[error ? "login-error" : "", capsLock ? "caps-warning" : ""].filter(Boolean).join(" ") || undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? t("Ocultar senha", "Hide password") : t("Mostrar senha", "Show password")}
                    className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded text-muted transition-colors duration-rapido hover:bg-surface-2 hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {capsLock && (
                  <p id="caps-warning" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-trail-text">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2l6.5 12h-13z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 6.5v3.5M8 11.6v.4" stroke="currentColor" strokeWidth="2" /></svg>
                    {t("Caps Lock está ativado.", "Caps Lock is on.")}
                  </p>
                )}
              </div>

              {error && (
                <p id="login-error" role="alert" className="border-l-2 border-trail py-1 pl-3 text-sm font-semibold text-trail-text">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading || !ra.trim() || !password} className="btn btn-pri h-12 w-full">
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-ink/40 border-t-on-ink" aria-hidden="true" />}
                {t("Entrar", "Sign in")}
                {!loading && <ArrowRight size={18} className="arw" aria-hidden="true" />}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>{t("Não sabe seu RA?", "Don't know your student ID?")}</span>
              <button type="button" onClick={() => go("forgotId")} className={linkClass}>
                {t("Esqueci meu RA ou usuário", "Forgot your ID or username?")}
              </button>
            </div>

            {/* Migration 026: login com Google → workspace DEMO. Some sozinho se o
                backend não tiver client id configurado. */}
            <DemoSignIn
              onLogged={(session) => {
                track("logged_in", "session", session.student_id);
                onLogged(session);
              }}
            />
          </>
        )}

        {mode === "forgotPassword" && (
          <>
            <h1 className="text-[28px] font-bold leading-[1.08] tracking-[-0.04em] text-ink">{t("Esqueci minha senha", "Forgot your password?")}</h1>
            <p className="mt-2 text-muted">
              {t(
                "Informe seu RA ou usuário. O pedido vai para a coordenação da sua turma, que gera uma senha temporária e entrega a você.",
                "Enter your student ID or username. Your request goes to your class coordinator, who will create a temporary password and give it to you."
              )}
            </p>
            <form onSubmit={submitReset} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="reset-ra" className="mb-1.5 block text-sm font-semibold text-ink">{t("RA ou usuário", "Student ID or username")}</label>
                <input
                  id="reset-ra"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={ra}
                  onChange={(event) => setRa(event.target.value)}
                  className={inputClass}
                  autoFocus
                  aria-describedby={error ? "reset-error" : undefined}
                />
              </div>
              {error && (
                <p id="reset-error" role="alert" className="border-l-2 border-trail py-1 pl-3 text-sm font-semibold text-trail-text">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading || !ra.trim()} className="btn btn-pri h-12 w-full">
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-ink/40 border-t-on-ink" aria-hidden="true" />}
                {t("Pedir nova senha", "Request a new password")}
              </button>
            </form>
            {backToLogin}
          </>
        )}

        {mode === "resetSent" && (
          <div role="status">
            <span className="tag tag-ok">
              <MailCheck aria-hidden="true" /> {t("Pedido enviado", "Request sent")}
            </span>
            <h1 className="mt-4 text-[28px] font-bold leading-[1.08] tracking-[-0.04em] text-ink">{t("Pedido enviado", "Request sent")}</h1>
            <p className="mt-2 text-muted">
              {t(
                "Se encontrarmos sua conta, a coordenação da sua turma recebe o pedido e entrega uma senha temporária a você. Depois de entrar, você continua de onde parou.",
                "If we find your account, your class coordinator will get the request and give you a temporary password. Once you sign in, you'll pick up right where you left off."
              )}
            </p>
            {backToLogin}
          </div>
        )}

        {mode === "forgotId" && (
          <>
            <h1 className="text-[28px] font-bold leading-[1.08] tracking-[-0.04em] text-ink">{t("Esqueci meu RA ou usuário", "Forgot your ID or username?")}</h1>
            <ul className="mt-5 divide-y divide-line border-y border-line text-ink [&>li]:py-3">
              <li>
                <strong>{t("Seu RA", "Your student ID")}</strong>{" "}
                {t("é o número de matrícula: está na sua carteirinha de estudante e no portal acadêmico da instituição.",
                   "is your enrollment number: you'll find it on your student ID card and in your school's academic portal.")}
              </li>
              <li>
                <strong>{t("Você também pode entrar com seu nome", "You can also sign in with your name")}</strong>{" "}
                {t("completo, do jeito que está no cadastro, no lugar do RA.",
                   "— your full name, exactly as registered — instead of the ID.")}
              </li>
              <li>
                {t("Ainda sem acesso? Procure a secretaria acadêmica ou o professor da sua turma.",
                   "Still can't get in? Contact the registrar's office or your class teacher.")}
              </li>
            </ul>
            {backToLogin}
          </>
        )}

        <p className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          {t("Depois de entrar, você escolhe como seus dados de estudo são usados (LGPD/GDPR).",
             "After you sign in, you choose how your study data is used (GDPR/LGPD).")}
        </p>
      </main>
      </div>
    </div>
  );
};
