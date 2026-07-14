/*
D.1 — Fila de eventos de aprendizado (xAPI-lite) no cliente.

Mesmo padrão do sync de progresso do OvaReader: os eventos são acumulados em
memória e enviados em LOTE a cada 15 s (e no `pagehide`, com keepalive, para não
perder os últimos ao fechar a aba). Assim um play/pause/seek ou uma resposta de
quiz não vira uma requisição por clique.

Uso:
  import { track } from "../services/events";
  track("opened", "ova", ovaId, { perc: 0 });
  track("answered", "question", questionId, { correct, response_ms });
*/
import { LearningEventInput, postEvents, getToken } from "./api";

const FLUSH_INTERVAL_MS = 15_000;
const MAX_QUEUE = 50; // igual ao limite do backend por requisição

let queue: LearningEventInput[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let listenersBound = false;

function ensureRunning() {
  if (timer === null) {
    timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  }
  if (!listenersBound && typeof window !== "undefined") {
    // pagehide cobre fechar a aba / navegar para fora melhor que unload.
    window.addEventListener("pagehide", () => void flush(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flush(true);
    });
    listenersBound = true;
  }
}

export function track(
  verb: string,
  objectType: string,
  objectId?: number | null,
  context?: Record<string, unknown>
) {
  // Sem sessão não há para quem atribuir o evento (o aluno vem do token).
  if (!getToken()) return;
  queue.push({
    verb,
    object_type: objectType,
    object_id: objectId ?? null,
    context: context ?? null,
    occurred_at: new Date().toISOString()
  });
  ensureRunning();
  // Se encheu o lote, faz flush imediato para não estourar o limite do backend.
  if (queue.length >= MAX_QUEUE) void flush();
}

export async function flush(keepalive = false): Promise<void> {
  if (queue.length === 0 || !getToken()) return;
  const batch = queue.splice(0, MAX_QUEUE);
  try {
    await postEvents(batch, { keepalive });
  } catch {
    // Best-effort: em falha, devolve o lote à fila para tentar no próximo ciclo
    // (a menos que seja o flush final de unload, quando não há próximo ciclo).
    if (!keepalive) queue = batch.concat(queue);
  }
}
