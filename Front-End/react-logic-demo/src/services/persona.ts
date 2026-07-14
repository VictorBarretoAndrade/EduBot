/*
V.2 — persona do EduBot persistida. O seletor de avatar (Meu Desempenho) resetava
a cada visita; agora a escolha do aluno é lembrada em localStorage e reutilizada
em todos os pontos de fala (coach, cards de intervenção, onboarding).
*/
const PERSONA_KEY = "edubot.persona";

export const getPersona = (): string => localStorage.getItem(PERSONA_KEY) || "edubot";

export const setPersona = (id: string) => localStorage.setItem(PERSONA_KEY, id);
