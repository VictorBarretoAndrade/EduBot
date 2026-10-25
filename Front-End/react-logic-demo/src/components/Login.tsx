/*
INTEGRAÇÃO (4.2) — Tela de login do frontend React.
Autentica RA (ou nome de usuário) + senha no POST /login do backend; o token
devolvido é guardado pelo api.ts e enviado em todas as chamadas seguintes.

Plano 6 — usabilidade:
  - "Esqueci minha senha": não há e-mail cadastrado nem envio de e-mail; o pedido
    vira um alerta para a coordenação da turma, que gera uma senha temporária.
  - "Esqueci meu RA ou usuário": onde encontrar o RA e o login pelo nome.
  - mostrar/ocultar senha, aviso de Caps Lock, PT/EN já na entrada, autocomplete
    do navegador e mensagem própria para "muitas tentativas" (429).
*/
import { ArrowLeft, Eye, EyeOff, Languages, LoaderCircle, MailCheck } from "lucide-react";
import { FormEvent, KeyboardEvent, useState } from "react";
import { ApiError, Session, login, requestPasswordReset } from "../services/api";
import { track } from "../services/events";
import { useLanguage, useT } from "../i18n";
import { EduBotLogo } from "./brand/EduBotLogo";

interface LoginProps {
  onLogged: (session: Session) => void;
}

type Mode = "login" | "forgotPassword" | "forgotId" | "resetSent";

const inputClass =
  "h-12 w-full rounded-[8px] border border-line px-4 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const linkClass =
  "rounded-[4px] text-sm font-semibold text-brand underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export const Login = ({ onLogged }: LoginProps) => {
  const t = useT();
  const { lang, toggle } = useLanguage();
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-700 via-brand to-violet-500 p-4">
      <main className="w-full max-w-md rounded-[8px] bg-white p-8 shadow-soft">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <EduBotLogo size={52} />
            <div>
              <div className="text-2xl font-bold leading-none text-ink">Engage-Agent</div>
              <div className="mt-1 text-sm tracking-[0.18em] text-muted">{t("APRENDIZAGEM · IA", "LEARNING · AI")}</div>
            </div>
          </div>
          {/* Idioma já na entrada: quem não lê português não precisa entrar para trocar. */}
          <button
            type="button"
            onClick={toggle}
            aria-label={lang === "pt" ? "Switch to English" : "Mudar para português"}
            className="flex h-9 items-center gap-1.5 rounded-[8px] border border-line px-2.5 text-sm font-bold text-ink transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Languages size={16} className="text-brand" aria-hidden="true" />
            {lang === "pt" ? "EN" : "PT"}
          </button>
        </div>

        {mode === "login" && (
          <>
            <h1 className="text-2xl font-bold text-ink">{t("Entrar na plataforma", "Sign in to the platform")}</h1>
            <p className="mt-1 text-muted">{t("Use seu RA (ou usuário) e a senha da instituição.", "Use your student ID (or username) and school password.")}</p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="ra" className="mb-1 block text-sm font-semibold text-ink">{t("RA ou usuário", "Student ID or username")}</label>
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
                <div className="mb-1 flex items-center justify-between">
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
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-[6px] text-muted transition hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {capsLock && (
                  <p id="caps-warning" className="mt-1.5 text-sm font-semibold text-amber-700">
                    {t("Caps Lock está ativado.", "Caps Lock is on.")}
                  </p>
                )}
              </div>

              {error && <p id="login-error" role="alert" className="rounded-[8px] bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

              <button
                type="submit"
                disabled={loading || !ra.trim() || !password}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-brand font-bold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading && <LoaderCircle className="animate-spin" size={20} aria-hidden="true" />}
                {t("Entrar", "Sign in")}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>{t("Não sabe seu RA?", "Don't know your student ID?")}</span>
              <button type="button" onClick={() => go("forgotId")} className={linkClass}>
                {t("Esqueci meu RA ou usuário", "Forgot your ID or username?")}
              </button>
            </div>
          </>
        )}

        {mode === "forgotPassword" && (
          <>
            <h1 className="text-2xl font-bold text-ink">{t("Esqueci minha senha", "Forgot your password?")}</h1>
            <p className="mt-2 text-muted">
              {t(
                "Informe seu RA ou usuário. O pedido vai para a coordenação da sua turma, que gera uma senha temporária e entrega a você.",
                "Enter your student ID or username. Your request goes to your class coordinator, who will create a temporary password and give it to you."
              )}
            </p>
            <form onSubmit={submitReset} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="reset-ra" className="mb-1 block text-sm font-semibold text-ink">{t("RA ou usuário", "Student ID or username")}</label>
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
              {error && <p id="reset-error" role="alert" className="rounded-[8px] bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={loading || !ra.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-brand font-bold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading && <LoaderCircle className="animate-spin" size={20} aria-hidden="true" />}
                {t("Pedir nova senha", "Request a new password")}
              </button>
            </form>
            {backToLogin}
          </>
        )}

        {mode === "resetSent" && (
          <div role="status">
            <MailCheck size={40} className="text-teal" aria-hidden="true" />
            <h1 className="mt-3 text-2xl font-bold text-ink">{t("Pedido enviado", "Request sent")}</h1>
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
            <h1 className="text-2xl font-bold text-ink">{t("Esqueci meu RA ou usuário", "Forgot your ID or username?")}</h1>
            <ul className="mt-4 space-y-3 text-slate-700">
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

        <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
          {t("Depois de entrar, você escolhe como seus dados de estudo são usados (LGPD/GDPR).",
             "After you sign in, you choose how your study data is used (GDPR/LGPD).")}
        </p>
      </main>
    </div>
  );
};
