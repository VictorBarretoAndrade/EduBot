/*
Migration 026 — faixa do modo DEMO ("Student View" do Canvas).

Aparece só nas contas de demonstração que podem trocar de visão (coordenador e
aluno de teste). O botão chama POST /demo/switch, que devolve a sessão da outra
conta do mesmo workspace. "Como funciona?" abre um roteiro curto que mostra como
as peças se ligam: o que o aluno faz vira dado, o modelo de domínio (BKT) e o
risco são recalculados e o Engage-Agent gera alertas no painel do coordenador.
*/
import { ArrowLeftRight, ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { DemoKind, Session, switchDemoView } from "../../services/api";
import { useT } from "../../i18n";
import { safeGet, safeSet } from "../../services/storage";
import { useToast } from "../ui/Toast";

const GUIDE_FLAG = "edubot.demo.guide_seen";

interface DemoBannerProps {
  kind: DemoKind;
  onSwitched: (session: Session) => void;
}

export const DemoBanner = ({ kind, onSwitched }: DemoBannerProps) => {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // O roteiro abre sozinho na primeira visita; depois fica a critério da pessoa.
  const [open, setOpen] = useState(() => safeGet("local", GUIDE_FLAG) !== "1");
  const coord = kind === "coordenador";

  const toggleGuide = () => {
    setOpen((value) => !value);
    safeSet("local", GUIDE_FLAG, "1");
  };

  const switchView = () => {
    setBusy(true);
    safeSet("local", GUIDE_FLAG, "1");
    switchDemoView()
      .then(onSwitched)
      .catch(() => toast.error(t("Não foi possível trocar de visão agora.", "Couldn't switch views right now.")))
      .finally(() => setBusy(false));
  };

  const steps = coord
    ? [
        t("Veja a turma de exemplo: risco, domínio por competência e alertas já foram calculados pelos serviços reais.",
          "Look at the sample class: risk, mastery per learning outcome and alerts were computed by the real services."),
        t("Clique num aluno para ver o desempenho detalhado, ou use “Adicionar aluno” para criar um (com ou sem histórico de exemplo).",
          "Click a student to see detailed performance, or use “Add student” to create one (with or without a sample history)."),
        t("Troque para a visão de aluno, estude um módulo e responda o quiz.", "Switch to the student view, study a module and take the quiz."),
        t("Volte e clique em “Analisar turma”: o Engage-Agent reavalia o seu aluno de teste e o alerta aparece aqui.",
          "Come back and click “Analyze class”: Engage-Agent re-evaluates your test student and the alert shows up here.")
      ]
    : [
        t("Você é o aluno de teste da sua turma de demonstração — começa sem nenhum histórico.",
          "You're the test student of your demo class — you start with no history."),
        t("Abra uma matéria, leia um módulo e faça o quiz: cada ação vira um evento de aprendizagem.",
          "Open a course, read a module and take the quiz: every action becomes a learning event."),
        t("As respostas atualizam o seu domínio por competência (BKT) e o seu risco.",
          "Your answers update your mastery per learning outcome (BKT) and your risk."),
        t("Volte para o coordenador e veja você mesmo na lista da turma.", "Switch back to the coordinator and find yourself in the class list.")
      ];

  return (
    <div className="border-b border-indigo-200 bg-indigo-50 text-ink">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 lg:px-10">
        <span className="rounded-[4px] bg-brand px-2 py-0.5 text-xs font-bold tracking-[0.12em] text-white">DEMO</span>
        <p className="min-w-0 flex-1 text-sm">
          {t("Você está na visão de", "You're viewing as")}{" "}
          <strong>{coord ? t("Coordenador", "Coordinator") : t("Aluno de teste", "Test student")}</strong>
          <span className="hidden text-muted sm:inline">
            {" · "}
            {t("tudo aqui é só seu: alunos e dados de exemplo.", "everything here is yours: sample students and data.")}
          </span>
        </p>
        <button
          type="button"
          onClick={toggleGuide}
          aria-expanded={open}
          aria-controls="demo-guide"
          className="flex h-9 items-center gap-1 rounded-[8px] px-2.5 text-sm font-semibold text-brand transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {t("Como funciona?", "How it works")}
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={switchView}
          disabled={busy}
          className="flex h-9 items-center gap-2 rounded-[8px] bg-brand px-3.5 text-sm font-bold text-white transition hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:bg-slate-400"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <ArrowLeftRight size={16} aria-hidden="true" />}
          {coord ? t("Ver como aluno", "View as student") : t("Voltar para coordenador", "Back to coordinator")}
        </button>
      </div>
      {open && (
        <ol id="demo-guide" className="mx-auto grid max-w-[1400px] gap-2 px-5 pb-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2 rounded-[8px] border border-indigo-100 bg-white p-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-brand" aria-hidden="true">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
