/*
AV.3 (Plano 3) — CompanionAvatar: UM componente para o companheiro de estudo.

Recebe `personaId` e resolve sozinho o que renderizar:
  - "edubot" (padrão)   -> o tutor Explorador da identidade "Relevo" (SVG leve,
                           troca de tema sozinho, sempre disponível);
  - "einstein"/"curie"  -> cientista 3D (Avatar3D); se o WebGL falhar, cai no Explorador.

O id "edubot" continua o mesmo no banco (students.persona); só o desenho mudou.

Aceita `visemeRef` (do useSpeech) para lip-sync REAL no 3D. No Explorador, `speaking`
mantém a boca em movimento enquanto a fala toca; `estado` escolhe a expressão pelo
momento do produto (explicando, ouvindo, pensando, encorajando, meta, revisar).
*/
import { MutableRefObject, Suspense, lazy, useEffect, useState } from "react";
import { Explorador, ExploradorEstado } from "./Explorador";
import { AVATAR_PERSONAS } from "./avatars";

// O Avatar3D arrasta o three.js (~800 kB). Carregado sob demanda: quem usa o
// Explorador (padrão) NUNCA baixa o three.js; só ao escolher Einstein/Curie.
const Avatar3D = lazy(() => import("./Avatar3D").then((m) => ({ default: m.Avatar3D })));

interface CompanionAvatarProps {
  personaId: string;
  speaking?: boolean;
  visemeRef?: MutableRefObject<string>;
  /** Lado do Explorador; o 3D deriva daqui uma proporção ~retrato. */
  size?: number;
  /** Expressão do Explorador (ignorada pelas personas 3D). */
  estado?: ExploradorEstado;
  /** Explorador parado — só um animado por tela. */
  still?: boolean;
}

export function CompanionAvatar({ personaId, speaking = false, visemeRef, size = 120, estado, still }: CompanionAvatarProps) {
  const persona = AVATAR_PERSONAS.find((p) => p.id === personaId);
  const [threeFailed, setThreeFailed] = useState(false);

  // Trocar para uma persona 3D depois de uma falha de WebGL deve permitir nova
  // tentativa (a falha anterior era da persona antiga).
  useEffect(() => setThreeFailed(false), [personaId]);

  const explorador = (
    <Explorador
      estado={estado ?? (speaking ? "explicando" : "explicando")}
      size={size}
      falando={speaking}
      still={still ?? (!speaking && size < 48)}
    />
  );

  if (!persona || threeFailed) return explorador;
  return (
    // Fallback = Explorador enquanto o chunk do three.js carrega (ou se falhar).
    <Suspense fallback={explorador}>
      <Avatar3D
        persona={persona}
        speaking={speaking}
        visemeRef={visemeRef}
        width={size}
        height={Math.round(size * 1.26)}
        onError={() => setThreeFailed(true)}
      />
    </Suspense>
  );
}
