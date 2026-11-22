/*
Migration 026 — "Adicionar aluno" no painel do coordenador do modo DEMO.

Cria o aluno na turma de demonstração (POST /tutor/students). O perfil opcional
gera um histórico de exemplo pelos serviços reais (tentativas → BKT, regras da
proatividade → alerta), para o coordenador ver o aluno entrar no painel já com
risco e domínio calculados. RA e senha aparecem UMA vez: com eles dá para entrar
como esse aluno pela tela de login normal.
*/
import { Copy, LoaderCircle, UserPlus, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { ApiError, DemoProfile, createTutorStudent } from "../../services/api";
import { useT } from "../../i18n";
import { useToast } from "../ui/Toast";

interface AddStudentFormProps {
  onClose: () => void;
  onCreated: () => void;
}

export const AddStudentForm = ({ onClose, onCreated }: AddStudentFormProps) => {
  const t = useT();
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<DemoProfile | "">("em_risco");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ nome: string; ra: string; senha: string } | null>(null);

  const profiles: { value: DemoProfile | ""; label: string }[] = [
    { value: "", label: t("Sem histórico (começa do zero)", "No history (starts from scratch)") },
    { value: "destaque", label: t("Destaque — acerta quase tudo", "Top performer — gets almost everything right") },
    { value: "mediano", label: t("Mediano — oscila entre acertos e erros", "Average — mixed results") },
    { value: "em_risco", label: t("Em risco — erra muito", "At risk — many wrong answers") },
    { value: "inativo", label: t("Inativo — sumiu há quase duas semanas", "Inactive — gone for almost two weeks") }
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!nome.trim()) return;
    setError(null);
    setBusy(true);
    createTutorStudent(nome.trim(), perfil || null)
      .then((r) => {
        setCreated({ nome: r.aluno.nome, ra: r.ra, senha: r.senha });
        setNome("");
        onCreated();
      })
      .catch((err) => {
        let msg = t("Não foi possível criar o aluno agora.", "Couldn't create the student right now.");
        if (err instanceof ApiError && err.status === 400) {
          try {
            msg = JSON.parse(err.message).Error ?? msg;
          } catch {
            /* corpo não-JSON */
          }
        }
        setError(msg);
      })
      .finally(() => setBusy(false));
  };

  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(() => toast.success(t("Copiado.", "Copied.")));

  return (
    <section aria-labelledby="add-student-title" className="rounded-[8px] border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <h2 id="add-student-title" className="flex items-center gap-2 text-lg font-bold text-ink">
          <UserPlus size={18} className="text-brand" aria-hidden="true" /> {t("Adicionar aluno", "Add student")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Fechar", "Close")}
          className="rounded-[6px] p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end" noValidate>
        <div>
          <label htmlFor="new-student-name" className="mb-1 block text-sm font-semibold text-ink">{t("Nome", "Name")}</label>
          <input
            id="new-student-name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            maxLength={100}
            autoFocus
            className="h-11 w-full rounded-[8px] border border-line px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label htmlFor="new-student-profile" className="mb-1 block text-sm font-semibold text-ink">{t("Histórico de exemplo", "Sample history")}</label>
          <select
            id="new-student-profile"
            value={perfil}
            onChange={(event) => setPerfil(event.target.value as DemoProfile | "")}
            className="h-11 w-full rounded-[8px] border border-line bg-white px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {profiles.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy || !nome.trim()}
          className="flex h-11 items-center justify-center gap-2 rounded-[8px] bg-brand px-5 font-bold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
          {t("Criar", "Create")}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 rounded-[8px] bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

      {created && (
        <div role="status" className="mt-4 rounded-[8px] border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">{t(`${created.nome} entrou na turma.`, `${created.nome} joined the class.`)}</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {[
              { label: t("RA", "ID"), value: created.ra },
              { label: t("Senha", "Password"), value: created.senha }
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                {item.label}:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-base font-bold tracking-wider">{item.value}</code>
                <button
                  type="button"
                  onClick={() => copy(item.value)}
                  aria-label={t(`Copiar ${item.label}`, `Copy ${item.label}`)}
                  className="rounded-[6px] p-1 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs">
            {t("Anote agora: a senha só aparece aqui. Com ela você entra como esse aluno pela tela de login.",
               "Write it down now: the password is only shown here. Use it on the sign-in screen to enter as this student.")}
          </p>
        </div>
      )}
    </section>
  );
};
