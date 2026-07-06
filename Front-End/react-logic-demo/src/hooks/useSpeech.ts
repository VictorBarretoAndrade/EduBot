/*
MELHORIA (Roteiro Cena 3) — Voz do EduBot via Web Speech API do navegador.

Sem depender de serviço externo. Para soar MENOS robótico, escolhemos a melhor
voz disponível no sistema (prioriza vozes "Natural"/"Neural"/"Online" — o Edge e
o Chrome trazem vozes neurais bem naturais em pt-BR e en-US) e ajustamos a
prosódia. Expõe `speaking` para animar a boca do avatar.

Upgrade futuro: trocar por AWS Polly/ElevenLabs (mantendo speak/stop/speaking)
para voz ainda mais natural e lip-sync por visemas — isso exige outra credencial
(a chave da Bedrock não cobre voz).
*/
import { useCallback, useEffect, useRef, useState } from "react";

// Nomes de vozes de melhor qualidade (neurais/online), por prioridade.
const PREFERRED = [
  "natural", "neural", "online", "google",
  // pt-BR de qualidade
  "francisca", "antonio", "luciana", "camila", "vitória", "vitoria", "maria",
  // en-US de qualidade
  "aria", "jenny", "guy", "michelle", "samantha"
];

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const prefix = lang === "en" ? "en" : "pt";
  const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix));
  const pool = inLang.length ? inLang : voices;
  // pontua pelo nome (voz "melhor" primeiro)
  const scored = pool
    .map((v) => {
      const name = v.name.toLowerCase();
      const rank = PREFERRED.findIndex((p) => name.includes(p));
      return { v, score: rank === -1 ? 999 : rank };
    })
    .sort((a, b) => a.score - b.score);
  return scored[0]?.v;
}

export function useSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // As vozes carregam de forma assíncrona no navegador
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  const speak = useCallback(
    (text: string, lang: "pt" | "en") => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "en" ? "en-US" : "pt-BR";
      const voice = pickVoice(voicesRef.current, lang);
      if (voice) utterance.voice = voice;
      // Prosódia mais suave e humana (a padrão soa acelerada/plana)
      utterance.rate = 0.97;
      utterance.pitch = 1.0;
      utterance.volume = 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { speak, stop, speaking, supported };
}
