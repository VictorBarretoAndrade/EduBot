/*
Plano 6 (C3.7) — "Privacidade e dados", aberta pelo menu da conta. O painel
"Meus dados" (LGPD) morava dentro do antigo Professor Mediador, sem relação com
o resto daquela página.
*/
import { StudentProfile } from "../services/api";
import { useT } from "../i18n";
import { MyDataPanel } from "./MyDataPanel";

export const PrivacyPage = ({ profile }: { profile: StudentProfile }) => {
  const t = useT();
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold text-ink">{t("Privacidade e dados", "Privacy & data")}</h1>
      <p className="text-muted">
        {t("Escolha como seus dados de estudo são usados. Você pode mudar isso quando quiser.",
           "Choose how your study data is used. You can change this at any time.")}
      </p>
      <MyDataPanel profile={profile} />
    </section>
  );
};
