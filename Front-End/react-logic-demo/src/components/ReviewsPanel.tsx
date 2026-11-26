/*
D.3 — "Revisões desta semana". Mostra a agenda de revisão espaçada do aluno
(revisões vencidas em destaque + as que vencem nos próximos dias). O canal
principal de cobrança é a intervenção do EduBot; este painel dá a visão geral.
*/
import { PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ReviewItem, getReviews } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { RelevoLoader } from "./brand/RelevoLoader";
import { formatDate } from "../services/format";

export const ReviewsPanel = () => {
  const t = useT();
  const { lang } = useLanguage();
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);

  useEffect(() => {
    getReviews().then((r) => setReviews(r.reviews)).catch(() => setReviews([]));
  }, [lang]);

  // "Revisar": abre o passo Quiz do módulo da competência (Plano 6 — o quiz vive
  // dentro do módulo). Revisar = responder de novo as questões da competência.
  const revisar = (ovaId: number) => {
    window.location.hash = `#/modulo/${ovaId}/quiz`;
  };

  return (
    <div className="card p-6">
      <h2 className="lab">
        <span>{t("Revisões desta semana", "Reviews this week")}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t("Revisar no intervalo certo consolida o que você já dominou.",
           "Reviewing at the right interval consolidates what you've mastered.")}
      </p>

      {reviews === null ? (
        <div className="flex justify-center py-6"><RelevoLoader size={32} /></div>
      ) : reviews.length === 0 ? (
        <p className="mt-4 rounded bg-bg p-4 text-sm text-muted">
          {t("Nenhuma revisão agendada — continue avançando nos módulos!",
             "No reviews scheduled — keep moving through the modules!")}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {reviews.map((r) => (
            <li
              key={r.review_id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded border p-4 ${
                r.vencida ? "border-line-strong bg-surface-2" : "border-line bg-surface"
              }`}
            >
              <div className="min-w-0">
                <span className="font-semibold text-ink">{r.competencia}</span>
                <span className={`block text-sm font-semibold ${r.vencida ? "text-ink" : "text-muted"}`}>
                  {r.vencida ? t("Revisar agora", "Review now") : t(`vence em ${formatDate(r.due_date, lang)}`, `due ${formatDate(r.due_date, lang)}`)}
                </span>
              </div>
              {r.ova_id != null && (
                <button
                  onClick={() => revisar(r.ova_id!)}
                  className={`flex shrink-0 items-center gap-1.5 rounded px-4 py-2 text-sm font-bold text-on-ink transition ${
                    r.vencida ? "bg-ink hover:bg-ink/85" : "bg-ink hover:bg-ink/85"
                  }`}
                  aria-label={t(`Revisar ${r.competencia} no quiz`, `Review ${r.competencia} in the quiz`)}
                >
                  <PlayCircle size={16} aria-hidden="true" /> {t("Revisar", "Review")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
