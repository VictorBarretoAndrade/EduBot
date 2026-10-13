/*
MELHORIA — Endpoints configuráveis por ambiente.

Antes, a porta da API (5010) e a URL do leitor clássico (8010) estavam chumbadas
no código, o que quebrava qualquer deploy fora de localhost. Agora vêm de
variáveis Vite (VITE_API_URL / VITE_CLASSIC_URL). Os fallbacks reproduzem o
comportamento atual — em desenvolvimento local (Docker) nada precisa ser
configurado. Veja .env.example.
*/
const host = window.location.hostname || "localhost";
const isHttps = window.location.protocol === "https:";

// URL base da API Flask (perfil, progresso, quiz, EduBot).
// Em HTTPS (produção/Azure), usa o mesmo domínio seguro sem portas extras.
// Em HTTP (dev local), mantém o fallback na porta 5010.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? (isHttps ? "" : `http://${host}:5010`);

// URL base do Apache que serve o leitor clássico de OVAs (iframe.html).
export const CLASSIC_BASE_URL =
  import.meta.env.VITE_CLASSIC_URL ?? (isHttps ? "" : `http://${host}:8010`);

