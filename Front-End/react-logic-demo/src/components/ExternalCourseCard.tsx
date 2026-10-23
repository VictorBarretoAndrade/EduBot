/*
Plano 6 — curso externo com certificado (Cisco Networking Academy).

O aluno abre o curso no site da Cisco, conclui e envia o certificado em PDF. O
Engage-Agent avalia o arquivo (hoje de forma simulada, ver services/certificates
no backend) e, se for o certificado certo, o recurso conta como concluído.
*/
import { Award, CheckCircle2, ExternalLink, FileUp, LoaderCircle, XCircle } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { ApiError, CertificateState, ExternalCourse, uploadCertificate } from "../services/api";
import { useLanguage, useT } from "../i18n";
import { formatDate } from "../services/format";

interface ExternalCourseCardProps {
  course: ExternalCourse;
  onApproved?: () => void;
}

export const ExternalCourseCard = ({ course, onApproved }: ExternalCourseCardProps) => {
  const t = useT();
  const { lang } = useLanguage();
  const [cert, setCert] = useState<CertificateState>(course.certificado);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const approved = cert.status === "aprovado";

  const send = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (file.type && file.type !== "application/pdf") {
      setError(t("Envie o certificado em PDF.", "Please upload the certificate as a PDF."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("O PDF passa de 5 MB.", "The PDF is larger than 5 MB."));
      return;
    }
    setSending(true);
    try {
      const result = await uploadCertificate(course.resource_id, file);
      setCert(result);
      if (result.status === "aprovado") onApproved?.();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 413
        ? t("O PDF passa de 5 MB.", "The PDF is larger than 5 MB.")
        : t("Não foi possível enviar agora. Tente de novo.", "Couldn't upload right now. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`rounded-[8px] border bg-white p-5 ${approved ? "border-emerald-300" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Award className="mt-0.5 shrink-0 text-brand" size={24} aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-bold text-ink">{course.titulo}</div>
            <div className="text-sm text-muted">
              {t("Curso gratuito da Cisco Networking Academy, com certificado.",
                 "Free Cisco Networking Academy course with a certificate.")}
            </div>
          </div>
        </div>
        {approved && (
          <span className="flex items-center gap-1.5 rounded-[8px] bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} aria-hidden="true" /> {t("Certificado aprovado", "Certificate approved")}
          </span>
        )}
      </div>

      {!approved && (
        <ol className="mt-4 space-y-1 text-sm text-slate-700">
          <li>1. {t("Faça o curso no site da Cisco (é gratuito).", "Take the course on Cisco's website (it's free).")}</li>
          <li>2. {t("Ao terminar, baixe o certificado em PDF.", "When you finish, download your certificate as a PDF.")}</li>
          <li>3. {t("Envie o PDF aqui — o Engage-Agent confere o certificado.", "Upload the PDF here — Engage-Agent will check it.")}</li>
        </ol>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {course.url && (
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-2 rounded-[8px] border border-brand px-4 text-sm font-semibold text-brand transition hover:bg-indigo-50"
          >
            <ExternalLink size={16} aria-hidden="true" /> {t("Abrir curso na Cisco", "Open course on Cisco")}
          </a>
        )}
        {!approved && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={send}
              aria-label={t(`Enviar certificado de ${course.titulo}`, `Upload certificate for ${course.titulo}`)}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={sending}
              className="flex h-10 items-center gap-2 rounded-[8px] bg-brand px-4 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:bg-slate-300"
            >
              {sending ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
              {sending ? t("Conferindo certificado…", "Checking certificate…") : t("Enviar certificado (PDF)", "Upload certificate (PDF)")}
            </button>
          </>
        )}
      </div>

      {(cert.feedback || error) && (
        <p
          role="status"
          className={`mt-3 flex items-start gap-2 rounded-[8px] p-3 text-sm ${
            error || cert.status === "recusado" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || cert.status === "recusado"
            ? <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            : <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span>
            {error ?? cert.feedback}
            {!error && cert.enviado_em && (
              <span className="block text-xs opacity-80">
                {t("Enviado em", "Submitted on")} {formatDate(cert.enviado_em.slice(0, 10), lang)}
                {cert.mock ? t(" · avaliação de demonstração", " · demo review") : ""}
              </span>
            )}
          </span>
        </p>
      )}
    </div>
  );
};
