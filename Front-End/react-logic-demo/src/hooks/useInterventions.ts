/*
E.2 (Plano 2) — fonte ÚNICA das intervenções pendentes do EduBot.

Antes, o sino da topbar lia `profile.historico_intervencoes` (inclui lidas) e o
card do dashboard lia `/edubot/interventions` (só não lidas) — duas fontes,
contagens incoerentes. Este hook centraliza as NÃO LIDAS; o badge do sino e o
card passam a bater. Dispensar (`ack`) remove local + no backend.
*/
import { useCallback, useEffect, useState } from "react";
import { UnreadIntervention, ackIntervention, getInterventions } from "../services/api";
import { useLanguage } from "../i18n";

export function useInterventions() {
  // Plano 6: recarrega ao trocar o idioma (o texto vem traduzido do backend).
  const { lang } = useLanguage();
  const [items, setItems] = useState<UnreadIntervention[]>([]);

  const reload = useCallback(() => {
    getInterventions()
      .then((r) => setItems(r.interventions))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    let active = true;
    getInterventions()
      .then((r) => active && setItems(r.interventions))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [lang]);

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((i) => i.intervention_id !== id));
    ackIntervention(id).catch(() => undefined);
  }, []);

  return { items, dismiss, reload };
}
