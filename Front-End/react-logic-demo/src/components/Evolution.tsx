/*
INTEGRAÇÃO — Gráficos gerados a partir do perfil real (GET /student/me):
competências (acertos/total por competência) e consumo por tipo de recurso
(texto/vídeo/podcast/quiz/atividade). Mantém o Recharts do protótipo.
*/
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { MasteryTrendItem, StudentProfile, getMasteryTrend } from "../services/api";
import { useT } from "../i18n";
import { PerformanceCoach } from "./PerformanceCoach";
import { ReviewsPanel } from "./ReviewsPanel";
import { GamificationSection } from "./Gamification";

interface EvolutionProps {
  profile: StudentProfile;
}

export const Evolution = ({ profile }: EvolutionProps) => {
  const t = useT();
  // H.1 (Plano 2) — tendência de domínio (setas): só aparece após o backend
  // acumular snapshots diários; vazio no começo é esperado (degrada em silêncio).
  const [trend, setTrend] = useState<MasteryTrendItem[]>([]);
  useEffect(() => {
    getMasteryTrend().then((r) => setTrend(r.trend)).catch(() => setTrend([]));
  }, []);
  const rising = trend.filter((x) => x.direcao !== "flat");
  // Rótulos das séries (aparecem na legenda dos gráficos)
  const kRead = t("percentual lido", "percent read");
  const kMin = t("minutos de leitura", "reading minutes");
  const kConsumed = t("consumidos", "consumed");
  const kTotal = t("total", "total");

  // D.2: quando há domínio estimado por BKT, a teia usa esse sinal (mais
  // estável que %acertos); senão, cai na razão acertos/total.
  const competencyData = profile.competencias.map((item, index) => ({
    nome: `Comp. ${index + 1}`,
    completo: item.nome,
    score: item.dominio_estimado != null
      ? Math.round(item.dominio_estimado * 100)
      : (item.total_questoes ? Math.round((100 * item.acertos) / item.total_questoes) : 0),
    status: item.status
  }));

  const typeData = Object.entries(profile.recursos.por_tipo).map(([tipo, stats]) => ({
    tipo,
    [kConsumed]: stats.consumidos,
    [kTotal]: stats.total
  }));

  const ovaData = profile.ovas.map((ova) => {
    const nome = ova.ova_name;
    return {
      nome: nome.length > 18 ? `${nome.slice(0, 18)}…` : nome,
      [kRead]: ova.perc_scrolled || 0,
      [kMin]: Math.round((ova.read_time || 0) / 60)
    };
  });

  return (
    <section>
      <h1 className="text-3xl font-bold text-ink">{t("Evolução do Aluno", "Student Progress")}</h1>
      <p className="mt-2 text-muted">{t("Gráficos gerados a partir dos dados rastreados no backend.", "Charts generated from the data tracked in the backend.")}</p>

      {/* G.5 — camada de jogo: nível, sequência, conquistas, ranking (some se
          a gamificação estiver desligada no backend). */}
      <div className="mt-6">
        <GamificationSection studentName={profile.estudante.nome} />
      </div>

      {/* Personagem virtualizado do EduBot falando sobre o progresso (Cena 3) */}
      <div className="mt-6">
        <PerformanceCoach profile={profile} />
      </div>

      {/* D.3 — agenda de revisão espaçada */}
      <div className="mt-6">
        <ReviewsPanel />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Teia de competências (gráfico radar) — visão do domínio do aluno */}
        <div className="rounded-[8px] border border-line bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-xl font-bold text-ink">{t("Teia de competências", "Competency web")}</h2>
          <p className="mt-1 text-sm text-muted">{t("Domínio estimado por competência (quanto mais cheia a teia, melhor o domínio).", "Estimated mastery per competency (the fuller the web, the better the mastery).")}</p>
          <div className="mt-5 h-96">
            <ResponsiveContainer>
              <RadarChart data={competencyData} outerRadius="72%">
                <PolarGrid />
                <PolarAngleAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, t("domínio estimado", "estimated mastery")]}
                  labelFormatter={(label: string) => {
                    const item = competencyData.find((entry) => entry.nome === label);
                    return item ? `${item.completo} (${item.status})` : label;
                  }}
                />
                <Radar name={t("Domínio", "Mastery")} dataKey="score" stroke="#604fd8" fill="#604fd8" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* H.1 — tendência dos últimos 7 dias (aparece quando há histórico). */}
          {rising.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-sm font-semibold text-ink">{t("Tendência (7 dias)", "Trend (7 days)")}</p>
              <div className="flex flex-wrap gap-2">
                {rising.map((x) => {
                  const up = x.direcao === "up";
                  const pts = Math.round(Math.abs(x.delta) * 100);
                  return (
                    <span
                      key={x.competency_id}
                      className={`flex items-center gap-1 rounded-[8px] px-3 py-1 text-sm font-semibold ${
                        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}
                      aria-label={t(
                        `${x.competencia}: ${up ? "subiu" : "caiu"} ${pts} pontos`,
                        `${x.competencia}: ${up ? "up" : "down"} ${pts} points`
                      )}
                    >
                      {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      {x.competencia} {up ? "+" : "−"}{pts}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[8px] border border-line bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-ink">{t("Leitura por OVA", "Reading per OVA")}</h2>
          <div className="mt-5 h-72">
            <ResponsiveContainer>
              <BarChart data={ovaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" interval={0} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey={kRead} fill="#604fd8" radius={[8, 8, 0, 0]} />
                <Bar dataKey={kMin} fill="#ff7b65" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[8px] border border-line bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-ink">{t("Consumo por tipo de recurso", "Consumption by resource type")}</h2>
          <div className="mt-5 h-72">
            <ResponsiveContainer>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" interval={0} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey={kConsumed} fill="#15beb5" radius={[8, 8, 0, 0]} />
                <Bar dataKey={kTotal} fill="#dfe5ef" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[8px] border border-line bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-xl font-bold text-ink">{t("Competências desenvolvidas", "Developed competencies")}</h2>
          <div className="mt-5 h-80">
            <ResponsiveContainer>
              <BarChart data={competencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" interval={0} height={50} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, t("acertos", "correct")]}
                  labelFormatter={(label: string) => {
                    const item = competencyData.find((entry) => entry.nome === label);
                    return item ? `${item.completo} (${item.status})` : label;
                  }}
                />
                <Bar dataKey="score" fill="#15beb5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
