/*
MELHORIA (OVA nativo) — Quiz embutido na própria página do OVA (espelha o que o
make.js fazia no leitor legado, dentro da seção "Conclusão").

As questões vêm de POST /question/ova (SEM gabarito) e a correção é server-side
em POST /question/answer — o gabarito nunca chega ao navegador.

Plano 6 (B.2): a aba Quiz global foi aposentada; o modo desafio (R.3) e o
resultado com o próximo passo vieram para cá — o quiz vive só dentro do módulo.
*/
import { CheckCircle2, Lock, Trophy, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GamificationAward, OvaQuestion, QuizLock, answerQuestion, getChallengeQuestions, getOVAQuestions, quizLockFromError, registerInteraction } from "../../services/api";
import { useToast } from "../ui/Toast";
import { useT } from "../../i18n";

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
      <div role="status" className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-5 text-amber-800">
        <Lock size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t("Quiz bloqueado", "Quiz locked")}</p>
          <p className="mt-1 text-sm">
            {t(
              `Leia pelo menos ${lock.gate}% do conteúdo para liberar o quiz — você está em ${lock.perc}%.`,
              `Read at least ${lock.gate}% of the content to unlock the quiz — you're at ${lock.perc}%.`
            )}
          </p>
          {onGoToContent && (
            <button onClick={onGoToContent} className="mt-3 h-10 rounded-[8px] bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700">
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
      className={`flex h-10 items-center gap-2 rounded-[8px] border px-4 text-sm font-semibold transition ${
        challenge ? "border-amber-400 bg-amber-50 text-amber-800" : "border-line bg-white text-muted hover:bg-slate-50"
      }`}
    >
      <Trophy size={16} aria-hidden="true" /> {challenge ? t("Modo desafio ativado", "Challenge mode on") : t("Modo desafio", "Challenge mode")}
    </button>
  );

  if (challengeLocked) {
    return (
      <div className="space-y-4">
        {challengeToggle}
        <div role="status" className="rounded-[8px] border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <p className="flex items-center gap-2 font-semibold"><Trophy size={18} aria-hidden="true" /> {t("Desafio bloqueado", "Challenge locked")}</p>
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
            className={`rounded-[8px] border bg-white p-5 ${
              graded === undefined ? "border-line" : graded ? "border-emerald-300" : "border-rose-300"
            }`}
          >
            <h4 id={`q-${question.question_id}-label`} className="font-bold text-ink">
              {index + 1}. {question.statement}
            </h4>
            <div
              role="radiogroup"
              aria-labelledby={`q-${question.question_id}-label`}
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              {question.alternatives.map((option, optionIndex) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center rounded-[8px] border px-4 py-2.5 text-sm transition ${
                    answers[question.question_id] === optionIndex
                      ? "border-brand bg-indigo-50"
                      : "border-line bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    className="mr-3"
                    type="radio"
                    name={`q-${question.question_id}`}
                    checked={answers[question.question_id] === optionIndex}
                    onChange={() =>
                      setAnswers((current) => ({ ...current, [question.question_id]: optionIndex }))
                    }
                  />
                  <span className="mr-1.5 font-bold text-muted">{LETTERS[optionIndex]})</span>
                  {option}
                </label>
              ))}
            </div>
            {graded !== undefined && (
              <p
                role="status"
                className={`mt-3 flex items-center gap-2 font-semibold ${
                  graded ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {graded ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
                {graded ? t("Correta!", "Correct!") : t("Incorreta.", "Incorrect.")}
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
          className="h-12 rounded-[8px] bg-coral px-6 font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? t("Corrigindo…", "Checking your answers…") : t("Verificar respostas", "Check answers")}
        </button>
        {/* QF.1: por que o botão está desabilitado (ajuda todo mundo, não só leitor de tela).
            AUDITORIA P4: id escopado por ovaId — se um OVA tiver mais de uma seção com
            quiz (hasQuiz vem do HTML-fonte), evita colisão entre instâncias na mesma página. */}
        {answeredCount < questions.length && (
          <p id={`quiz-remaining-${ovaId}`} className="text-sm text-muted">
            {questions.length - answeredCount === 1
              ? t("Falta 1 questão para poder verificar.", "1 question left before you can check.")
              : t(`Faltam ${questions.length - answeredCount} questões para poder verificar.`, `${questions.length - answeredCount} questions left before you can check.`)}
          </p>
        )}
      </div>

      {/* Plano 6 (C3.6): o resultado traz o próximo passo ali mesmo. */}
      {result && (
        <div className={`rounded-[8px] border p-5 ${result.correct === result.total ? "border-emerald-200 bg-emerald-50" : "border-indigo-200 bg-indigo-50"}`}>
          <p className="text-lg font-bold text-ink">
            {t(`Você acertou ${result.correct} de ${result.total}.`, `You got ${result.correct} out of ${result.total} right.`)}
          </p>
          {result.correct < result.total ? (
            <>
              <p className="mt-1 text-sm text-slate-700">
                {t("O Engage-Agent pode montar uma prática curta com o que você errou.",
                   "Engage-Agent can build a short practice set around what you missed.")}
              </p>
              {onOpenPractice && (
                <button onClick={onOpenPractice} className="mt-3 h-10 rounded-[8px] bg-brand px-4 text-sm font-semibold text-white transition hover:bg-indigo-600">
                  {t("Praticar o que errei", "Practice what I missed")}
                </button>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-700">{t("Excelente! Você dominou este módulo.", "Excellent! You've nailed this module.")}</p>
          )}
        </div>
      )}

      {/* QF.1: resumo da correção só para leitor de tela. */}
      <p role="status" className="sr-only">{summary}</p>
    </div>
  );
};
