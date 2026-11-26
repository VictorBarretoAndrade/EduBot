/*
Plano 5 (19.3) — bloco de GRÁFICOS de desempenho reutilizável.

Extraído do `Evolution` para ser usado também no detalhe do aluno visto pelo
professor (`TutorStudentDetail`), sem duplicar o código do Recharts. Recebe um
`StudentProfile` (o mesmo shape vindo de /student/me OU de /tutor/student/<id>) e
desenha: teia de competências (radar), leitura por OVA e consumo por tipo.

`radarExtra` é um slot opcional renderizado dentro do card da teia — o aluno usa
para a "Tendência (7 dias)"; o professor não passa nada (aquele sinal é só do
aluno logado). Assim o visual do aluno fica idêntico ao de antes.
*/
import { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StudentProfile } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { competencyStatusLabel, resourceTypeLabel } from "../services/labels";
import { COTA, DomainMountains, kindOf, masteryOf } from "./ui/DomainMountains";
import { C, axisProps, barRadius, cotaLineProps, gridProps, legendProps, tooltipProps } from "./ui/chartTheme";

interface PerformanceChartsProps {
  profile: StudentProfile;
  radarExtra?: ReactNode;
}

export const PerformanceCharts = ({ profile, radarExtra }: PerformanceChartsProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const kRead = t("percentual lido", "percent read");
  const kMin = t("minutos de leitura", "reading minutes");
  const kConsumed = t("consumidos", "completed");
  const kTotal = t("total", "total");

  // D.2: quando há domínio estimado por BKT, a teia usa esse sinal (mais estável
  // que %acertos); senão, cai na razão acertos/total.
  const competencyData = profile.competencias.map((item, index) => ({
    nome: `Comp. ${index + 1}`,
    completo: item.nome,
    score: item.dominio_estimado != null
      ? Math.round(item.dominio_estimado * 100)
      : (item.total_questoes ? Math.round((100 * item.acertos) / item.total_questoes) : 0),
    status: item.status,
    kind: kindOf(item)
  }));

  const typeData = Object.entries(profile.recursos.por_tipo).map(([tipo, stats]) => ({
    tipo: resourceTypeLabel(tipo, lang),
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
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Relevo: "Domínio por competência" — cada competência é um morro, a cota
          (80, limiar do BKT para "desenvolvida") é a linha tracejada. Substitui a
          antiga teia (radar): o mesmo dado, na peça-assinatura do guia. */}
      <div className="card p-6 xl:col-span-2">
        <h2 className="lab">
          <span>{t("Domínio por competência", "Mastery by learning outcome")}</span>
          <span>{t("atualizado a cada resposta", "updated with every answer")}</span>
        </h2>
        <p className="-mt-1 mb-5 text-sm text-muted">{t("Cada morro é uma competência; a altitude é o seu domínio estimado. A linha tracejada é a cota.", "Each hill is a learning outcome; its altitude is your estimated mastery. The dashed line is the goal.")}</p>
        <DomainMountains
          peaks={profile.competencias.map((c) => ({ id: c.competency_id, nome: c.nome, valor: masteryOf(c), kind: kindOf(c) }))}
        />
        {radarExtra}
      </div>

      <div className="card p-6">
        <h2 className="lab">{t("Leitura por módulo", "Reading by module")}</h2>
        <div className="mt-5 h-72">
          <ResponsiveContainer>
            <BarChart data={ovaData}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="nome" interval={0} {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Legend {...legendProps} />
              <Bar dataKey={kRead} fill={C.ink} radius={barRadius} />
              <Bar dataKey={kMin} fill={C.trail} radius={barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="lab">{t("Consumo por tipo de recurso", "Progress by resource type")}</h2>
        <div className="mt-5 h-72">
          <ResponsiveContainer>
            <BarChart data={typeData}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="tipo" interval={0} {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Legend {...legendProps} />
              <Bar dataKey={kConsumed} fill={C.ink} radius={barRadius} />
              <Bar dataKey={kTotal} fill={C.surface2} stroke={C.lineStrong} radius={barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Competências desenvolvidas (barras) — o mesmo score do radar, em barra */}
      <div className="card p-6 xl:col-span-2">
        <h2 className="lab">{t("Competências desenvolvidas", "Mastered learning outcomes")}</h2>
        <div className="mt-5 h-80">
          <ResponsiveContainer>
            <BarChart data={competencyData}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="nome" interval={0} height={50} {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip
                {...tooltipProps}
                formatter={(value: number) => [`${value}%`, t("acertos", "correct")]}
                labelFormatter={(label: string) => {
                  const item = competencyData.find((entry) => entry.nome === label);
                  return item ? `${item.completo} (${competencyStatusLabel(item.status, lang)})` : label;
                }}
              />
              <ReferenceLine {...cotaLineProps(COTA, t(`cota ${COTA}`, `goal ${COTA}`))} />
              {/* Status pela cor E pela linha da cota: na cota (Mata), a caminho (Basalto), abaixo (Trilha). */}
              <Bar dataKey="score" radius={barRadius}>
                {competencyData.map((entry) => (
                  <Cell key={entry.nome} fill={entry.kind === "ok" ? C.mata : entry.kind === "low" ? C.trail : C.ink} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
