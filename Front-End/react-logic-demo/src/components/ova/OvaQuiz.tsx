/*
MELHORIA (OVA nativo) — Quiz embutido na própria página do OVA (espelha o que o
make.js fazia no leitor legado, dentro da seção "Conclusão").

As questões vêm de POST /question/ova (SEM gabarito) e a correção é server-side
em POST /question/answer — o gabarito nunca chega ao navegador.

Plano 6 (B.2): a aba Quiz global foi aposentada; o modo desafio (R.3) e o
resultado com o próximo passo vieram para cá — o quiz vive só dentro do módulo.
*/
import { ArrowRight, Lock, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GamificationAward, OvaQuestion, QuizLock, answerQuestion, getChallengeQuestions, getOVAQuestions, quizLockFromError, registerInteraction } from "../../services/api";
import { useToast } from "../ui/Toast";
import { useT } from "../../i18n";
import { Explorador } from "../brand/Explorador";
import { StatusIcon } from "../ui/Relevo";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

interface OvaQuizProps {
  ovaId: number;
  studentId: number;
  onTracked: () => void;
  // CP.3: cada correção devolve o ganho (XP/conquistas) e se acertou — o
  // OvaReader usa isso para o companheiro reagir (comemorar / oferecer ajuda).
  onGraded?: (result: { correct: boolean; gamification: GamificationAward | null }) => void;
  // Plano 6: atalhos do resultado (voltar ao conteúdo / praticar o que errou).
  onGoToContent?: () => void;
  onOpenPractice?: () => void;
}

export const OvaQuiz = ({ ovaId, studentId, onTracked, onGraded, onGoToContent, onOpenPractice }: OvaQuizProps) => {
  const t = useT();
  const [questions, setQuestions] = useState<OvaQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  // QF.1 (Plano 4): resumo da correção anunciado por leitor de tela (um submit com
  // N questões dispara N status por questão; o resumo dá o quadro geral).
  const [summary, setSummary] = useState("");
  // U.1: quiz do módulo bloqueado até ler o conteúdo (gate do backend).
  const [lock, setLock] = useState<QuizLock | null>(null);
  // R.3: modo desafio (só questões difíceis de competência dominada).
  const [challenge, setChallenge] = useState(false);
  const [challengeLocked, setChallengeLocked] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  // Última alternativa submetida por questão — evita reenviar a mesma resposta a
  // cada clique em "Verificar", que gravava tentativas em dobro no servidor (A7).
  const submittedRef = useRef<Record<number, number>>({});
  // D.1: instante em que as questões carregaram — base do response_ms (esforço).
  const loadedAtRef = useRef<number>(Date.now());
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setAnswers({});
    setFeedback({});
    setResult(null);
    setChallengeLocked(false);
    submittedRef.current = {};
    (challenge ? getChallengeQuestions(ovaId) : getOVAQuestions(ovaId))
      .then((data) => {
        if (!active) return;
        setQuestions(data);
        setLock(null);
        loadedAtRef.current = Date.now();
      })
      .catch((err) => {
        if (!active) return;
        setQuestions([]);
        // AUDITORIA P2 (R.3): o gate de leitura também devolve 403 — o corpo
        // distingue: quiz_locked traz {gate, perc}; challenge_locked não.
        const gateLock = quizLockFromError(err);
        if (gateLock) setLock(gateLock);
        else if (challenge && (err as { status?: number }).status === 403) setChallengeLocked(true);
      });
    return () => {
      active = false;
    };
  }, [ovaId, challenge]);

  const verify = async () => {
    setSubmitting(true);
    const next: Record<number, boolean> = { ...feedback };
    let failed = false;
    let submittedAny = false;
    for (const question of questions) {
      const selected = answers[question.question_id];
      if (selected === undefined) continue;
      // Só reenvia se a resposta mudou desde a última submissão (A7)
      if (submittedRef.current[question.question_id] === selected) continue;
      try {
        const responseMs = Date.now() - loadedAtRef.current;
        const graded = await answerQuestion(question.question_id, LETTERS[selected], responseMs);
        next[question.question_id] = graded.is_correct;
        submittedRef.current[question.question_id] = selected;
        submittedAny = true;
        // M9: base individual — reinicia o cronômetro após cada submissão, para o
        // response_ms das questões seguintes não incluir o tempo das anteriores.
        loadedAtRef.current = Date.now();
        // CP.3: o companheiro reage a esta correção (acerto/erro + XP/conquista).
        onGraded?.({ correct: graded.is_correct, gamification: graded.gamification });
      } catch {
        failed = true;
      }
    }
    setFeedback(next);
    setSubmitting(false);
    const gradedVals = Object.values(next);
    const acertos = gradedVals.filter(Boolean).length;
    setSummary(t(`Correção concluída: ${acertos} de ${gradedVals.length} corretas.`, `Grading complete: ${acertos} of ${gradedVals.length} correct.`));
    setResult({ correct: questions.filter((q) => next[q.question_id]).length, total: questions.length });
    if (failed) toast.error(t("Algumas respostas não puderam ser corrigidas. Verifique a conexão.", "Some answers couldn't be graded. Check your connection."));
    // Só atualiza o perfil se algo novo foi de fato submetido (A7/A9)
    if (submittedAny) {
      registerInteraction(ovaId, "quiz_submitted").catch(() => undefined);
      onTracked();
    }
  };

  if (lock) {
    return (
      <div role="status" className="flex items-start gap-4 rounded border border-dashed border-line-strong bg-bg p-5 text-ink">
        <Lock size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <div>
          <p className="k k-muted">{t("Quiz bloqueado", "Quiz locked")}</p>
          <p className="mt-1.5 text-sm">
            {t(
              `Leia pelo menos ${lock.gate}% do conteúdo para liberar o quiz — você está em ${lock.perc}%.`,
              `Read at least ${lock.gate}% of the content to unlock the quiz — you're at ${lock.perc}%.`
            )}
          </p>
          {onGoToContent && (
            <button onClick={onGoToContent} className="btn btn-pri btn-sm mt-3">
              {t("Continuar a leitura", "Keep reading")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  const challengeToggle = (
    <button
      onClick={() => setChallenge((c) => !c)}
      aria-pressed={challenge}
      className={`btn btn-sm ${challenge ? "btn-pri" : "btn-gh"}`}
    >
      <Trophy size={16} aria-hidden="true" /> {challenge ? t("Modo desafio ativado", "Challenge mode on") : t("Modo desafio", "Challenge mode")}
    </button>
  );

  if (challengeLocked) {
    return (
      <div className="space-y-4">
        {challengeToggle}
        <div role="status" className="rounded border border-dashed border-line-strong bg-bg p-5 text-ink">
          <p className="k k-muted flex items-center gap-2"><Lock size={14} aria-hidden="true" /> {t("Desafio bloqueado", "Challenge locked")}</p>
          <p className="mt-1 text-sm">
            {t("Domine um resultado de aprendizagem deste módulo (chegue a 80%) para liberar as questões-desafio.",
               "Master a learning outcome in this module (reach 80%) to unlock the challenge questions.")}
          </p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return <p className="text-muted">{t("Este módulo ainda não tem questões.", "This module doesn't have questions yet.")}</p>;
  }

  return (
    <div className="space-y-5">
      {challengeToggle}
      {questions.map((question, index) => {
        const graded = feedback[question.question_id];
        return (
          <div
            key={question.question_id}
            className={`rounded border bg-surface p-5 ${
              graded === undefined ? "border-line" : graded ? "border-mata" : "border-trail"
            }`}
          >
            <p className="k k-muted">{t(`Questão ${index + 1} de ${questions.length}`, `Question ${index + 1} of ${questions.length}`)}</p>
            <h4 id={`q-${question.question_id}-label`} className="mt-1.5 text-[17px] font-semibold leading-snug text-ink">
              {question.statement}
            </h4>
            <div
              role="radiogroup"
              aria-labelledby={`q-${question.question_id}-label`}
              className="mt-4 grid gap-2 sm:grid-cols-2"
            >
              {question.alternatives.map((option, optionIndex) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center rounded border px-4 py-3 text-[15px] transition-colors duration-rapido ${
                    answers[question.question_id] === optionIndex
                      ? "border-ink bg-surface-2"
                      : "border-line-strong/40 bg-surface hover:border-ink"
                  }`}
                >
                  <input
                    className="mr-3 accent-[rgb(var(--ink))]"
                    type="radio"
                    name={`q-${question.question_id}`}
                    checked={answers[question.question_id] === optionIndex}
                    onChange={() =>
                      setAnswers((current) => ({ ...current, [question.question_id]: optionIndex }))
                    }
                  />
                  <span className="num mr-2 text-[12px] font-semibold text-muted">{LETTERS[optionIndex]}</span>
                  {option}
                </label>
              ))}
            </div>
            {graded !== undefined && (
              <p
                role="status"
                className={`tag mt-4 ${graded ? "tag-ok" : "tag-low"}`}
              >
                <StatusIcon kind={graded ? "ok" : "low"} />
                {graded ? t("Correta", "Correct") : t("Incorreta", "Incorrect")}
              </p>
            )}
          </div>
        );
      })}

      <div className="space-y-2">
        <button
          onClick={verify}
          disabled={submitting || answeredCount < questions.length}
          aria-describedby={answeredCount < questions.length ? `quiz-remaining-${ovaId}` : undefined}
          className="btn btn-pri btn-lg"
        >
          {submitting ? t("Corrigindo…", "Checking your answers…") : t("Verificar respostas", "Check answers")}
        </button>
        {/* QF.1: por que o botão está desabilitado (ajuda todo mundo, não só leitor de tela).
            AUDITORIA P4: id escopado por ovaId — se um OVA tiver mais de uma seção com
            quiz (hasQuiz vem do HTML-fonte), evita colisão entre instâncias na mesma página. */}
        {answeredCount < questions.length && (
          <p id={`quiz-remaining-${ovaId}`} className="num text-[12px] text-muted">
            {questions.length - answeredCount === 1
              ? t("Falta 1 questão para poder verificar.", "1 question left before you can check.")
              : t(`Faltam ${questions.length - answeredCount} questões para poder verificar.`, `${questions.length - answeredCount} questions left before you can check.`)}
          </p>
        )}
      </div>

      {/* Plano 6 (C3.6): o resultado traz o próximo passo ali mesmo. */}
      {result && (
        <div className="card flex items-start gap-4 p-5">
          <Explorador estado={result.correct === result.total ? "meta" : "encorajando"} size={72} />
          <div className="min-w-0">
          <p className="k">{t("Resultado", "Result")}</p>
          <p className="h-sec mt-1 text-ink">
            {t(`Você acertou ${result.correct} de ${result.total}.`, `You got ${result.correct} out of ${result.total} right.`)}
          </p>
          {result.correct < result.total ? (
            <>
              <p className="mt-1 text-sm text-ink">
                {t("A Learnia pode montar uma prática curta com o que você errou.",
                   "Learnia can build a short practice set around what you missed.")}
              </p>
              {onOpenPractice && (
                <button onClick={onOpenPractice} className="btn btn-acc btn-sm mt-3">
                  {t("Ver trilha de reforço", "See practice path")}
                  <ArrowRight size={16} className="arw" aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-ink">{t("Excelente! Você dominou este módulo.", "Excellent! You've nailed this module.")}</p>
          )}
          </div>
        </div>
      )}

      {/* QF.1: resumo da correção só para leitor de tela. */}
      <p role="status" className="sr-only">{summary}</p>
    </div>
  );
};
