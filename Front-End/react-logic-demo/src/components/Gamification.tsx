/*
G.5 (Plano 2) — Camada de jogo de "Meu Desempenho".

  JourneyHeader      cabeçalho de jornada: avatar + nível com barra de XP,
                     chama da sequência (com escudo) e XP da semana.
  AchievementsShowcase  vitrine: conquistas desbloqueadas coloridas + bloqueadas
                     em silhueta (mostrar o CAMINHO é o que engaja).
  LeaderboardCard    ranking semanal da turma (opt-in com apelido). Quem não
                     participa vê só a própria posição/percentil.

Toda a camada some quando a gamificação está desligada no backend
(`enabled:false`) — a plataforma volta a ser exatamente a atual. Acessível (U.7):
a chama respeita prefers-reduced-motion; posições têm rótulo textual.

Identidade "Relevo": sequência = "rastro", nível = régua de elevação, conquistas em
traço (desbloqueada com borda forte; bloqueada pontilhada, com cadeado).
*/
import {
  CalendarCheck,
  Clapperboard,
  Flag,
  Footprints,
  Lock,
  MessageCircleQuestion,
  Mountain,
  Route,
  Shield,
  Trophy
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AchievementState,
  GamificationMe,
  Leaderboard,
  WeeklyGoal,
  acceptGoal,
  getGamificationMe,
  getGoals,
  getLeaderboard,
  participateRanking,
  setActiveTitle
} from "../services/api";
import { Explorador } from "./brand/Explorador";
import { RelevoLoader } from "./brand/RelevoLoader";
import { Elev, Lab, StatusTag } from "./ui/Relevo";
import { useLanguage, useT } from "../i18n";
import { ordinal, plural } from "../services/format";

// Ícone por conquista (o backend manda só id + nome traduzido). Relevo: ícones de
// traço na cor do texto — sem emoji colorido; a conquista se lê pela forma e palavra.
const ACH_ICON: Record<string, typeof Trophy> = {
  primeiro_modulo: Flag,
  revisor_pontual: CalendarCheck,
  sequencia_7: Footprints,
  mestre_competencia: Mountain,
  curioso: MessageCircleQuestion,
  trilha_completa: Route,
  no_seu_formato: Clapperboard,
  desafiante: Trophy
};

export const GamificationSection = ({ studentName }: { studentName?: string }) => {
  const [me, setMe] = useState<GamificationMe | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getGamificationMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="flex justify-center py-6">
        <RelevoLoader size={36} />
      </div>
    );
  }
  // gamificação desligada no backend -> nada é renderizado
  if (!me || !me.enabled) return null;

  const reload = () => getGamificationMe().then(setMe).catch(() => {});
  return (
    <div className="space-y-6">
      <JourneyHeader me={me} studentName={studentName} onTitleChange={reload} />
      <div className="grid gap-6 lg:grid-cols-2">
        <AchievementsShowcase achievements={me.achievements} />
        <LeaderboardCard onJoined={reload} />
      </div>
    </div>
  );
};

// E.3 — card de metas semanais (usado no Dashboard). Some se a gamificação
// estiver desligada.
export const WeeklyGoalsCard = () => {
  const t = useT();
  const [goals, setGoals] = useState<WeeklyGoal[] | null>(null);
  const [enabled, setEnabled] = useState(true);

  const load = () =>
    getGoals()
      .then((r) => { setEnabled(r.enabled); setGoals(r.goals); })
      .catch(() => setGoals([]));
  useEffect(() => { load(); }, []);

  const accept = async (id: number) => {
    await acceptGoal(id).catch(() => undefined);
    load();
  };

  if (!enabled || !goals || goals.length === 0) return null;

  return (
    <div className="card p-5">
      <Lab as="h3">
        <span>{t("Metas da semana", "Goals this week")}</span>
        <span>{goals.filter((g) => g.status === "cumprida").length}/{goals.length}</span>
      </Lab>
      <div className="-mx-5 divide-y divide-line border-t border-line">
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.round((100 * g.progress) / g.target) : 0;
          const done = g.status === "cumprida";
          return (
            <div key={g.goal_id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{g.titulo}</span>
                {done ? (
                  <StatusTag kind="ok">{t("Cumprida", "Done")}</StatusTag>
                ) : (
                  <span className="num text-[12px] text-muted">{g.progress}/{g.target}</span>
                )}
              </div>
              <div className="track mt-2.5" aria-hidden="true">
                <span style={{ width: `${pct}%`, background: done ? "rgb(var(--mata))" : undefined }} />
              </div>
              {g.status === "sugerida" && (
                <button onClick={() => accept(g.goal_id)} className="btn btn-gh btn-sm mt-3">
                  {t("Aceitar meta", "Accept goal")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const JourneyHeader = ({ me, onTitleChange }: { me: GamificationMe; studentName?: string; onTitleChange: () => void }) => {
  const t = useT();
  const { lang } = useLanguage();
  const pct = me.level_span > 0 ? Math.round((100 * me.into_level) / me.level_span) : 100;
  const toNext = Math.max(0, me.next_level_at - me.xp_total);
  const streak = me.streak.current_days;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-6">
        <Explorador estado={streak > 0 ? "meta" : "encorajando"} size={80} still />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag tag-mid">
              {t("Nível", "Level")} {me.level}
            </span>
            {me.title && <span className="text-sm font-semibold text-ink">· {me.title}</span>}
            {/* R.2 — escolher o título ativo entre os conquistados. AUDITORIA P2:
                seleção por ID (não por rótulo) — o rótulo muda com o idioma da
                UI e o <select> deixava de casar com o título ativo em EN. */}
            {me.available_titles.length > 0 && (
              <select
                value={me.title_id ?? ""}
                onChange={async (e) => {
                  await setActiveTitle(e.target.value || null);
                  onTitleChange();
                }}
                aria-label={t("Escolher título", "Choose title")}
                className="rounded-sm border border-line bg-surface px-2 py-1 text-xs font-semibold text-muted"
              >
                <option value="">{t("Sem título", "No title")}</option>
                {me.available_titles.map((tt) => (
                  <option key={tt.id} value={tt.id}>{tt.titulo}</option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
               aria-label={t(`Progresso do nível: ${pct}%`, `Level progress: ${pct}%`)}>
            <Elev value={pct} />
          </div>
          <p className="num mt-2 text-[11.5px] text-muted">
            {me.xp_total} XP · {t(`faltam ${toNext} XP para o nível ${me.level + 1}`,
                                  `${toNext} XP to level ${me.level + 1}`)}
          </p>
        </div>

        {/* rastro (sequência) e XP da semana — dados em mono */}
        <div className="card flex divide-x divide-line bg-bg">
          <div className="px-4 py-3"
               aria-label={t(`Rastro de ${plural(streak, lang, ["dia", "dias"], ["day", "days"])}`, `${streak}-day streak`)}>
            <div className="k k-muted flex items-center gap-1.5 text-[10.5px]">
              {t("Rastro", "Trail")}
              {me.streak.shield_available && (
                <Shield size={12} aria-label={t("escudo disponível", "shield available")} />
              )}
            </div>
            <div className="num mt-0.5 text-xl font-semibold text-ink">{plural(streak, lang, ["dia", "dias"], ["day", "days"])}</div>
          </div>
          <div className="px-4 py-3">
            <div className="k k-muted text-[10.5px]">{t("XP · semana", "XP · week")}</div>
            <div className="num mt-0.5 text-xl font-semibold text-ink">{me.xp_week}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AchievementsShowcase = ({ achievements }: { achievements: AchievementState[] }) => {
  const t = useT();
  const unlocked = achievements.filter((a) => a.unlocked).length;
  return (
    <div className="card p-6">
      <Lab as="h2">
        <span>{t("Conquistas", "Achievements")}</span>
        <span>{unlocked}/{achievements.length}</span>
      </Lab>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {achievements.map((a) => {
          const Icon = ACH_ICON[a.id] ?? Trophy;
          return (
            <div
              key={a.id}
              title={a.nome}
              className={`flex flex-col items-center gap-2 rounded border p-3 text-center ${
                a.unlocked ? "border-line-strong bg-surface" : "border-dashed border-line-strong/50 bg-bg text-muted"
              }`}
            >
              {a.unlocked ? (
                <Icon size={22} strokeWidth={1.6} className="text-ink" aria-hidden="true" />
              ) : (
                <Lock size={18} strokeWidth={1.6} aria-label={t("bloqueada", "locked")} />
              )}
              <span className={`text-[12px] font-semibold leading-tight ${a.unlocked ? "text-ink" : "text-muted"}`}>{a.nome}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LeaderboardCard = ({ onJoined }: { onJoined: () => void }) => {
  const t = useT();
  const { lang } = useLanguage();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = () => getLeaderboard().then(setBoard).catch(() => setBoard(null));
  useEffect(() => { load(); }, []);

  const join = async () => {
    if (nickname.trim().length < 2) return;
    setSaving(true);
    setJoinError(null);
    try {
      await participateRanking(nickname.trim());
      await load();
      onJoined();
    } catch (err) {
      // 409 = apelido já usado na turma; mostra a mensagem do backend
      try {
        const body = JSON.parse((err as Error).message);
        setJoinError(t("Não foi possível entrar no ranking agora.", "Couldn't join the leaderboard right now."));
      } catch {
        setJoinError(t("Não foi possível entrar agora.", "Couldn't join right now."));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!board || !board.enabled) return null;

  return (
    <div className="card p-6">
      <Lab as="h2">
        <span>{t("Ranking da turma", "Class leaderboard")}</span>
        <span>{t("esta semana", "this week")}</span>
      </Lab>

      {board.me && (
        <p className="num text-[12px] text-muted">
          {board.me.rank
            ? t(`Você está em #${board.me.rank}`, `You're #${board.me.rank}`)
            : t("Estude para entrar no ranking", "Study to get on the leaderboard")}
          {board.me.top_percent != null && ` · ${t("top", "top")} ${board.me.top_percent}%`}
          {` · ${board.me.xp_semana} XP`}
        </p>
      )}

      <div className="mt-4 divide-y divide-line border-y border-line">
        {board.top.map((e, i) => (
          <div
            key={i}
            className={`relative flex items-center justify-between px-3 py-2.5 ${e.eu ? "bg-surface-2 font-semibold" : ""}`}
          >
            {/* "Você está aqui": filete em Trilha. */}
            {e.eu && <span className="absolute inset-y-1.5 left-0 w-[2px] bg-trail" aria-hidden="true" />}
            <span className="flex items-center gap-3">
              <span className="num w-7 text-[12px] text-muted">{ordinal(i + 1, lang)}</span>
              <span className="text-ink">{e.apelido}{e.eu && ` (${t("você", "you")})`}</span>
            </span>
            <span className="num text-[12px] text-muted">{t("Nv", "Lv")} {e.nivel} · {e.xp_semana} XP</span>
          </div>
        ))}
        {board.top.length === 0 && (
          <p className="p-3 text-sm text-muted">
            {t("Ninguém no ranking ainda. Seja o primeiro!", "No one on the leaderboard yet. Be the first!")}
          </p>
        )}
      </div>

      {!board.participando && (
        <div className="mt-4 rounded border border-line-strong bg-bg p-4">
          <p className="text-sm font-semibold text-ink">{t("Participar do ranking", "Join the leaderboard")}</p>
          <p className="mt-1 text-xs text-muted">
            {t("Escolha um apelido. Seus colegas verão o apelido e seu XP — nunca seu nome ou suas notas.",
               "Pick a nickname. Classmates see the nickname and your XP — never your name or grades.")}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={40}
              placeholder={t("Seu apelido", "Your nickname")}
              className="field h-10 flex-1 py-0 text-sm"
            />
            <button
              onClick={join}
              disabled={saving || nickname.trim().length < 2}
              className="btn btn-pri btn-sm"
            >
              {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-ink/40 border-t-on-ink" aria-hidden="true" />}
              {t("Entrar", "Join")}
            </button>
          </div>
          {joinError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-trail-text">{joinError}</p>
          )}
        </div>
      )}
    </div>
  );
};
