/*
Plano 6 (T5) — rótulos PT/EN para os CÓDIGOS que o backend devolve (tipo de
aviso, status de competência, prioridade, severidade, tipo de recurso). Antes
eles iam crus para a tela ("revisao_espacada", "em desenvolvimento", "alta") e
ficavam em português mesmo com o app em inglês. Código desconhecido cai num
rótulo legível (underscores viram espaço) — nunca quebra a tela.
*/
import { Lang } from "../i18n";

type Pair = [pt: string, en: string];

const NOTICE_TYPES: Record<string, Pair> = {
  plano_retomada: ["Retomar os estudos", "Get back on track"],
  trilha_minima: ["Trilha essencial", "Essentials path"],
  revisao_alternativa: ["Revisar de outro jeito", "Review another way"],
  recomendacao_formato: ["No seu formato", "In your format"],
  checklist_execucao: ["Concluir atividade", "Finish your activity"],
  aprofundamento: ["Ir mais fundo", "Go deeper"],
  revisao_espacada: ["Revisão", "Review time"],
  meta_semanal: ["Meta da semana", "Weekly goal"],
  mensagem_tutor: ["Recado do professor", "Message from your teacher"],
  mensagem_proposta: ["Recado do professor", "Message from your teacher"],
  ova_personalizada: ["Prática personalizada", "Personalized practice"],
  reforco: ["Prática personalizada", "Personalized practice"],
  inatividade: ["Sentimos sua falta", "We miss you"],
  risco_evasao: ["Risco de evasão", "Dropout risk"],
  erro_quiz: ["Muitos erros no quiz", "Struggling on quizzes"],
  em_risco: ["Em risco", "At risk"]
};

const COMPETENCY_STATUS: Record<string, Pair> = {
  "não iniciada": ["não iniciada", "not started"],
  "em desenvolvimento": ["em desenvolvimento", "in progress"],
  "desenvolvida": ["desenvolvida", "mastered"]
};

const LEVELS: Record<string, Pair> = {
  alta: ["alta", "high"],
  media: ["média", "medium"],
  baixa: ["baixa", "low"]
};

const RESOURCE_TYPES: Record<string, Pair> = {
  texto: ["texto", "reading"],
  video: ["vídeo", "video"],
  podcast: ["podcast", "podcast"],
  atividade: ["atividade", "activity"],
  curso_externo: ["curso com certificado", "certificate course"],
  quiz: ["quiz", "quiz"]
};

const pick = (table: Record<string, Pair>, code: string | null | undefined, lang: Lang): string => {
  if (!code) return "";
  const pair = table[code];
  if (pair) return lang === "en" ? pair[1] : pair[0];
  return code.replace(/_/g, " ");
};

export const noticeTypeLabel = (code: string | null | undefined, lang: Lang) => pick(NOTICE_TYPES, code, lang);
export const competencyStatusLabel = (code: string | null | undefined, lang: Lang) => pick(COMPETENCY_STATUS, code, lang);
export const levelLabel = (code: string | null | undefined, lang: Lang) => pick(LEVELS, code, lang);
export const resourceTypeLabel = (code: string | null | undefined, lang: Lang) => pick(RESOURCE_TYPES, code, lang);
