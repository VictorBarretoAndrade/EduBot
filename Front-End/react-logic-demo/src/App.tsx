/*
INTEGRAÇÃO (EduBot Track) — o app deixou de ser um demo isolado em localStorage
e passou a consumir o backend Flask:
  - Sem token -> tela de Login (POST /login)
  - Logado    -> perfil real via GET /student/me alimenta todas as views
O visual original (Lovable) foi mantido; apenas a fonte dos dados mudou.

Plano 6 (B.1) — navegação no modelo Canvas: Minhas matérias → Matéria → Módulo
(conteúdo → atividades → quiz). As abas Dashboard, Conteúdos, Atividades, Quiz e
Professor Mediador foram fundidas; os links antigos são redirecionados.
*/
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Sidebar, STAFF_VIEWS, Topbar } from "./components/Sidebar";
import { Login } from "./components/Login";
import { ConsentModal, CONSENT_FLAG } from "./components/ConsentModal";
import { OnboardingModal, ONBOARDING_FLAG } from "./components/OnboardingModal";
import { LoaderCircle } from "lucide-react";
import { OvaState, Session, StudentProfile, clearSession, getMe, getSession, getToken, hasRecordedConsent } from "./services/api";
import { syncPersonaFromProfile } from "./services/persona";
import { useLanguage, useT } from "./i18n";
import { safeGet, safeSet, safeRemove } from "./services/storage";

// MELHORIA — cada tela vira um chunk separado (React.lazy), então o app só baixa
// o código da aba que o aluno abrir, em vez de tudo (inclusive os gráficos
// pesados do Recharts) no primeiro carregamento.
const CoursesHome = lazy(() => import("./components/CoursesHome").then((m) => ({ default: m.CoursesHome })));
const SubjectPage = lazy(() => import("./components/SubjectPage").then((m) => ({ default: m.SubjectPage })));
const Evolution = lazy(() => import("./components/Evolution").then((m) => ({ default: m.Evolution })));
const Reforco = lazy(() => import("./components/Reforco").then((m) => ({ default: m.Reforco })));
const PrivacyPage = lazy(() => import("./components/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const OvaReader = lazy(() => import("./components/ova/OvaReader").then((m) => ({ default: m.OvaReader })));
const TutorPanel = lazy(() => import("./components/TutorPanel").then((m) => ({ default: m.TutorPanel })));
// Plano 5: detalhe do aluno visto pelo professor (#/aluno/:id) e painel do gestor.
const TutorStudentDetail = lazy(() => import("./components/TutorStudentDetail").then((m) => ({ default: m.TutorStudentDetail })));
const ManagerDashboard = lazy(() => import("./components/ManagerDashboard").then((m) => ({ default: m.ManagerDashboard })));

const ViewFallback = () => {
  const t = useT();
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoaderCircle className="animate-spin text-brand" size={32} aria-hidden="true" />
      {/* VI.2: com reduced-motion o spinner congela — o texto sr-only mantém o sentido. */}
      <span className="sr-only">{t("Carregando", "Loading")}</span>
    </div>
  );
};

// Fase 5 (A17): URLs navegáveis por hash. HashRouting dispensa reescrita no
// Apache (o app é servido em subpath /app/) e dá botão voltar/avançar + links
// compartilháveis. Plano 6: rotas do modelo Canvas + redirecionamento das antigas.
const HOME = "materias";
const STAFF_HOME = "tutor";
const KNOWN_VIEWS = ["materias", "pratica", "progresso", "privacidade", "tutor", "gestor"];
const LEGACY_VIEWS: Record<string, string> = {
  dashboard: "materias",
  contents: "materias",
  exercises: "materias",
  quiz: "materias",
  report: "progresso",
  evolution: "progresso",
  reforco: "pratica"
};
export const MODULE_STEPS = ["conteudo", "atividades", "quiz"] as const;
export type ModuleStep = (typeof MODULE_STEPS)[number];

type Route = { view: string; ovaId?: number; step?: ModuleStep; subjectId?: number; studentId?: number };

const parseHash = (): Route => {
  const m = window.location.hash.match(/^#\/modulo\/(\d+)(?:\/(\w+))?/);
  if (m) {
    const step = MODULE_STEPS.includes(m[2] as ModuleStep) ? (m[2] as ModuleStep) : "conteudo";
    return { view: "module", ovaId: Number(m[1]), step };
  }
  const s = window.location.hash.match(/^#\/materia\/(\d+)/);
  if (s) return { view: "materia", subjectId: Number(s[1]) };
  // Plano 5 (19.2): #/aluno/:id abre o detalhe daquele aluno para o professor.
  const a = window.location.hash.match(/^#\/aluno\/(\d+)/);
  if (a) return { view: "aluno", studentId: Number(a[1]) };
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (LEGACY_VIEWS[raw]) return { view: LEGACY_VIEWS[raw] };
  return { view: KNOWN_VIEWS.includes(raw) ? raw : HOME };
};

const App = () => {
  const [route, setRoute] = useState<Route>(parseHash);
  const [session, setSession] = useState<Session | null>(() => (getToken() ? getSession() : null));
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // D.5: modal de consentimento no primeiro login (flag em localStorage).
  const [needsConsent, setNeedsConsent] = useState<boolean>(
    () => safeGet("local", CONSENT_FLAG) !== "1"
  );
  // U.5: onboarding logo após o consentimento (outra flag em localStorage).
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(
    () => safeGet("local", ONBOARDING_FLAG) !== "1"
  );
  const t = useT();
  const { lang } = useLanguage();

  // (Re)carrega o perfil completo do aluno — chamado no login e após cada
  // ação rastreada (progresso de mídia, quiz, recomendação), mantendo as telas
  // sempre coerentes com o backend.
  const refreshProfile = useCallback(async () => {
    try {
      const me = await getMe();
      setProfile(me);
      // AV.2 (Plano 3): alinha o cache local da persona à fonte da verdade (servidor),
      // para os pontos que a leem antes do perfil (ex.: companheiro no OVA).
      syncPersonaFromProfile(me.estudante.persona);
      setError(null);
    } catch (err) {
      // Token inválido/expirado -> volta para o login
      if ((err as { status?: number }).status === 401) {
        setSession(null);
        setProfile(null);
      } else {
        setError("load_failed");
      }
    }
  }, []);

  // Recarrega também quando o idioma muda: o conteúdo (nomes de matéria, módulos,
  // recursos, competências) vem TRADUZIDO do banco conforme ?lang= (Fase 4 — A12).
  useEffect(() => {
    if (session) refreshProfile();
  }, [session, refreshProfile, lang]);

  // Fase 0 (E0.5) do Plano de Rastreabilidade: a flag local é só cache — quem
  // manda é o backend. Ao autenticar, conferimos se existe consentimento
  // GRAVADO: se não existe (navegador novo, POST que falhou), o modal volta;
  // se existe, gravamos o cache para não piscar o modal nas próximas visitas.
  // Best-effort: se a consulta falhar, mantém o comportamento do cache.
  useEffect(() => {
    if (!session) return;
    let active = true;
    hasRecordedConsent()
      .then((recorded) => {
        if (!active) return;
        if (recorded) safeSet("local", CONSENT_FLAG, "1");
        else safeRemove("local", CONSENT_FLAG);
        setNeedsConsent(!recorded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session]);

  // Toda navegação passa pelo hash: o estado deriva da URL (voltar/avançar, F5 e
  // links colados funcionam em qualquer nível — matéria, módulo, passo).
  const navigate = useCallback((hash: string) => {
    if (window.location.hash !== hash) window.location.hash = hash;
    else setRoute(parseHash());
  }, []);
  const changeView = useCallback((view: string) => navigate(`#/${view}`), [navigate]);

  useEffect(() => {
    const onHashChange = () => {
      const next = parseHash();
      // Link legado (#/report, #/quiz...): troca a URL pela atual sem nova entrada no histórico.
      const raw = window.location.hash.replace(/^#\/?/, "");
      if (LEGACY_VIEWS[raw]) window.history.replaceState(null, "", `#/${next.view}`);
      setRoute(next);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHashChange);
    // Normaliza a URL de entrada (vazia ou legada) sem criar entrada no histórico.
    const initial = parseHash();
    const canonical =
      initial.view === "module" || initial.view === "materia" || initial.view === "aluno"
        ? window.location.hash
        : `#/${initial.view}`;
    if (window.location.hash !== canonical) window.history.replaceState(null, "", canonical);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const logout = () => {
    clearSession();
    setSession(null);
    setProfile(null);
    window.location.hash = `#/${HOME}`;
  };

  // Papel do usuário (staff = tutor/admin). Deriva do perfil carregado.
  const isStaff = profile?.estudante.role === "tutor" || profile?.estudante.role === "admin";

  // Guarda por papel: o staff não usa as telas de aluno (Prática, Meu progresso) —
  // cai em Minha turma; o aluno não acessa Turma/Visão do curso. No 1º carregamento
  // do perfil, o professor que chegou na home de aluno vai para a home dele.
  const landedRef = useRef(false);
  useEffect(() => {
    if (!profile) return;
    const { view } = route;
    const firstLoad = !landedRef.current;
    landedRef.current = true;
    if (isStaff && firstLoad && view === HOME) {
      changeView(STAFF_HOME);
      return;
    }
    if (isStaff) {
      if (!STAFF_VIEWS.includes(view) && !["module", "materia", "aluno"].includes(view)) changeView(STAFF_HOME);
    } else if (view === "tutor" || view === "gestor" || view === "aluno") {
      changeView(HOME);
    }
  }, [profile, isStaff, route, changeView]);

  const openModule = (ova: OvaState, step: ModuleStep = "conteudo") =>
    navigate(step === "conteudo" ? `#/modulo/${ova.ova_id}` : `#/modulo/${ova.ova_id}/${step}`);
  const openSubject = (subjectId: number) => navigate(`#/materia/${subjectId}`);

  if (!session) {
    return <Login onLogged={(logged) => setSession(logged)} />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-muted">
        <LoaderCircle className="animate-spin text-brand" size={40} />
        {error ? (
          <p className="font-semibold text-rose-600">
            {t("Não conseguimos carregar seus dados. Tente de novo em instantes.", "We couldn't load your data. Please try again in a moment.")}
          </p>
        ) : (
          <p>{t("Carregando seu perfil...", "Loading your profile...")}</p>
        )}
      </div>
    );
  }

  const moduleOva = route.view === "module" ? profile.ovas.find((o) => o.ova_id === route.ovaId) : undefined;

  const renderView = () => {
    // Plano 5: detalhe do aluno (professor). O backend também valida (404 fora
    // de escopo), mas o front não monta a tela para quem não é staff.
    if (route.view === "aluno" && route.studentId != null && isStaff) {
      return <TutorStudentDetail studentId={route.studentId} onBack={() => changeView(STAFF_HOME)} />;
    }
    if (route.view === "module" && moduleOva) {
      const backToSubject = () => (moduleOva.subject_id != null ? openSubject(moduleOva.subject_id) : changeView(HOME));
      return (
        <OvaReader
          // AUDITORIA P3: remonta por OVA — zera o estado por-sessão do companheiro
          // (saudação/marcos) e do chat ao navegar de um módulo direto para outro.
          key={moduleOva.ova_id}
          ova={moduleOva}
          studentId={session.student_id}
          persona={profile.estudante.persona}
          companionEnabled={profile.features?.companion ?? true}
          step={route.step ?? "conteudo"}
          onStepChange={(step) => openModule(moduleOva, step)}
          onBack={backToSubject}
          onOpenPractice={() => changeView("pratica")}
          onTracked={refreshProfile}
        />
      );
    }
    if (route.view === "materia" && route.subjectId != null) {
      return (
        <SubjectPage
          profile={profile}
          subjectId={route.subjectId}
          onBack={() => changeView(HOME)}
          onOpenModule={(ova) => openModule(ova)}
          onOpenPractice={() => changeView("pratica")}
        />
      );
    }
    if (route.view === "pratica") return <Reforco profile={profile} onTracked={refreshProfile} />;
    if (route.view === "progresso") return <Evolution profile={profile} />;
    if (route.view === "privacidade") return <PrivacyPage profile={profile} />;
    if (route.view === "tutor" && isStaff) return <TutorPanel />;
    if (route.view === "gestor" && isStaff) return <ManagerDashboard />;
    return (
      <CoursesHome
        profile={profile}
        preview={isStaff}
        onOpenSubject={openSubject}
        onOpenModule={(ova) => openModule(ova)}
        onOpenPractice={() => changeView("pratica")}
      />
    );
  };

  // Aba destacada na barra lateral: matéria e módulo moram "dentro" de Minhas matérias.
  const navView = ["module", "materia"].includes(route.view) ? HOME : route.view === "aluno" ? STAFF_HOME : route.view;

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      {/* NA.3 (Plano 4): pular para o conteúdo. preventDefault + foco programático
          para NÃO tocar no hash (o app usa hash-routing). */}
      <a
        href="#conteudo"
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById("conteudo");
          el?.focus();
          el?.scrollIntoView();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[8px] focus:bg-brand focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        {t("Pular para o conteúdo", "Skip to content")}
      </a>
      {/* D.5 consentimento primeiro; U.5 onboarding logo depois. */}
      {needsConsent ? (
        <ConsentModal onDone={() => setNeedsConsent(false)} />
      ) : (
        needsOnboarding && !isStaff && (
          <OnboardingModal
            studentName={profile.estudante.nome}
            persona={profile.estudante.persona}
            onDone={() => setNeedsOnboarding(false)}
          />
        )
      )}
      <div className="flex">
        <Sidebar activeView={navView} onChangeView={changeView} studentName={profile.estudante.nome} role={profile.estudante.role} onLogout={logout} />
        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <Topbar
            profile={profile}
            onChangeView={changeView}
            onNavigate={navigate}
            activeView={navView}
            studentName={profile.estudante.nome}
            role={profile.estudante.role}
            onLogout={logout}
          />
          <div className="mx-auto max-w-[1200px] px-5 py-8 lg:px-10">
            <Suspense fallback={<ViewFallback />}>{renderView()}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
