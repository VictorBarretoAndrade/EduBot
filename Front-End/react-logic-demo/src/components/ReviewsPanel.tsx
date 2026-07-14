/*
D.3 — "Revisões desta semana". Mostra a agenda de revisão espaçada do aluno
(revisões vencidas em destaque + as que vencem nos próximos dias). O canal
principal de cobrança é a intervenção do EduBot; este painel dá a visão geral.
*/
import { CalendarClock, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ReviewItem, getReviews } from "../services/api";
import { useT } from "../i18n";

export const ReviewsPanel = () => {
  const t = useT();
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);

  useEffect(() => {
    getReviews().then((r) => setReviews(r.reviews)).catch(() => setReviews([]));
  }, []);

  return (
    <div className="rounded-[8px] border border-line bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarClock size={20} className="text-brand" />
        <h2 className="text-xl font-bold text-ink">{t("Revisões desta semana", "Reviews this week")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t("Revisar no intervalo certo consolida o que você já dominou.",
           "Reviewing at the right interval consolidates what you've mastered.")}
      </p>

      {reviews === null ? (
        <div className="flex justify-center py-6"><LoaderCircle className="animate-spin text-brand" size={20} /></div>
      ) : reviews.length === 0 ? (
        <p className="mt-4 rounded-[8px] bg-slate-50 p-4 text-sm text-muted">
          {t("Nenhuma revisão agendada — continue avançando nos módulos!",
             "No reviews scheduled — keep moving through the modules!")}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {reviews.map((r) => (
            <li
              key={r.review_id}
              className={`flex items-center justify-between rounded-[8px] border p-4 ${
                r.vencida ? "border-amber-300 bg-amber-50" : "border-line bg-white"
              }`}
            >
              <span className="font-semibold text-ink">{r.competencia}</span>
              <span className={`text-sm font-semibold ${r.vencida ? "text-amber-700" : "text-muted"}`}>
                {r.vencida ? t("Revisar agora", "Review now") : t(`vence ${r.due_date}`, `due ${r.due_date}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
