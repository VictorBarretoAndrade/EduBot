/*
Identidade "Relevo" — o tutor Explorador (design/relevo/gerador/explorador.py).

Um guia de campo, não um robô: chapéu de expedição e bússola no peito, só traço
sobre a cor da Folha (sem tom de pele, gênero ou idade). Usa os tokens, então
troca sozinho no modo escuro. O CSS (.chr) mora em styles.css.

Estados (escolha pelo momento do produto, não pelo humor do texto):
  explicando  — responde uma dúvida
  ouvindo     — o aluno fala por voz ou está digitando
  pensando    — gerando resposta ou montando um percurso (mais de 400 ms)
  encorajando — abaixo da meta: convite para o reforço
  meta        — competência chegou à cota do professor
  revisar     — revisão agendada ou lembrete

Regras: um Explorador animado por tela (os demais com `still`); abaixo de 48 px
use `variant="cabeca"`. Nunca em nota oficial, certificado ou aviso de privacidade,
e nunca falando em nome do professor.
*/
import { useLanguage } from "../../i18n";

export type ExploradorEstado = "explicando" | "ouvindo" | "pensando" | "encorajando" | "meta" | "revisar";

const NOMES: Record<ExploradorEstado, { pt: string; en: string }> = {
  explicando: { pt: "explicando", en: "explaining" },
  ouvindo: { pt: "ouvindo", en: "listening" },
  pensando: { pt: "pensando", en: "thinking" },
  encorajando: { pt: "encorajando", en: "encouraging" },
  meta: { pt: "meta atingida", en: "goal reached" },
  revisar: { pt: "vamos revisar", en: "let's review" }
};

const Olhos = ({ y = 62, x = 51 }: { y?: number; x?: number }) => (
  <g className="eyes">
    <ellipse cx={x} cy={y} rx="2.8" ry="3.8" />
    <ellipse cx={x + 18} cy={y} rx="2.8" ry="3.8" />
  </g>
);
const Sobrancelhas = () => (
  <>
    <path className="ln" d="M45 54 Q51 51 56 53" />
    <path className="ln" d="M64 53 Q69 51 75 54" />
  </>
);

const Rosto = ({ estado }: { estado: ExploradorEstado }) => {
  switch (estado) {
    case "ouvindo":
      return (
        <>
          <path className="ln" d="M45 53 Q51 50.5 56 52.5" />
          <path className="ln" d="M64 52.5 Q69 50.5 75 53" />
          <Olhos />
          <ellipse className="fk" cx="60" cy="74.5" rx="2.6" ry="2.2" />
        </>
      );
    case "pensando":
      return (
        <>
          <path className="ln" d="M45 53.5 Q51 50 56 52.5" />
          <path className="ln" d="M64 55 L75 55" />
          <Olhos x={53} y={60} />
          <path className="ln" d="M55 76 Q60 74.5 64 76" />
        </>
      );
    case "encorajando":
      return (
        <>
          <path className="ln" d="M45 55 L56 53" />
          <path className="ln" d="M64 53 L75 55" />
          <Olhos />
          <path className="ln" d="M53 72.5 Q60 79 67 72.5" />
          <path className="ln" d="M53 72.5 L67 72.5" />
        </>
      );
    case "meta":
      return (
        <>
          <path className="ln" d="M45 53 Q51 50.5 56 52" />
          <path className="ln" d="M64 52 Q69 50.5 75 53" />
          <path className="ln" d="M47 63 Q51 57 55 63" />
          <path className="ln" d="M65 63 Q69 57 73 63" />
          <path className="fk" d="M52 72 Q60 86 68 72 Q60 75 52 72Z" />
        </>
      );
    case "revisar":
      return (
        <>
          <Sobrancelhas />
          <ellipse className="fk" cx="51" cy="62" rx="2.8" ry="3.8" />
          <path className="ln" d="M65 62 Q69 59 73 62" />
          <path className="ln" d="M54 73 Q60 78 66 73" />
        </>
      );
    default:
      return (
        <>
          <Sobrancelhas />
          <Olhos />
          <path className="fk m-a" d="M53 73 Q60 82 67 73 Q60 76 53 73Z" />
          <path className="fk m-b" d="M55.5 74 Q60 78 64.5 74 Q60 75.5 55.5 74Z" />
        </>
      );
  }
};

const BRACO = <path className="fill" d="M89 106 C92 97 94 89 95.5 81 L104.5 82 C103.5 91 101 100 97 110 Z" />;

const Gesto = ({ estado }: { estado: ExploradorEstado }) => {
  if (estado === "explicando")
    return (
      <g className="gs">
        {BRACO}
        <path className="fill" d="M100.5 73 V60.5 a2.4 2.4 0 0 1 4.8 0 V73" />
        <path className="fill" d="M94.5 82 C93 75 95.5 71.5 99.5 71.5 H104 C107 71.5 108 75 107 82 Z" />
        <path className="ln2" d="M97.5 76.5 H101" />
      </g>
    );
  if (estado === "encorajando")
    return (
      <g className="gs">
        {BRACO}
        <path className="fill" d="M94 83 C92.5 75 95 70 100.5 70 C106 70 108.5 75 107 83 Z" />
        <path className="ln2" d="M96 75 H105 M96 79 H105" />
      </g>
    );
  if (estado === "pensando")
    return (
      <g className="gs">
        <g className="think">
          <circle cx="99" cy="33" r="2.6" />
          <circle cx="106" cy="25" r="2" />
          <circle cx="111" cy="17" r="1.5" />
        </g>
      </g>
    );
  if (estado === "ouvindo")
    return (
      <g className="gs">
        <g className="onda">
          <path className="sw" d="M28.5 57 Q25 63 28.5 69" />
          <path className="sw" d="M23.5 53 Q17.5 63 23.5 73" />
        </g>
      </g>
    );
  return null;
};

interface ExploradorProps {
  estado?: ExploradorEstado;
  /** Lado em px. Abaixo de 48 px prefira variant="cabeca". */
  size?: number;
  /** "busto" (padrão) ou "cabeca" (recorte com traço mais grosso, para avatar). */
  variant?: "busto" | "cabeca";
  /** Parado: sem piscar nem gesto. Só um Explorador animado por tela. */
  still?: boolean;
  /** Boca em movimento contínuo enquanto a fala (TTS) toca. */
  falando?: boolean;
  /** Decorativo (aria-hidden). Por padrão o SVG tem rótulo acessível. */
  decorative?: boolean;
  className?: string;
}

export const Explorador = ({
  estado = "explicando",
  size = 96,
  variant = "busto",
  still = false,
  falando = false,
  decorative = false,
  className = ""
}: ExploradorProps) => {
  const { lang } = useLanguage();
  const cab = variant === "cabeca" || size < 48;
  const label = `${lang === "en" ? "Explorer tutor" : "Tutor Explorador"}: ${NOMES[estado][lang === "en" ? "en" : "pt"]}`;
  const cls = ["chr", cab ? "cab" : "", still ? "still" : "", falando ? "falando" : "", className].filter(Boolean).join(" ");
  return (
    <svg
      width={size}
      height={size}
      viewBox={cab ? "21 20 78 78" : "0 0 120 120"}
      className={cls}
      data-expr={estado}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <g className="bodyg">
        <path className="fill" d="M18 121 C20 98 38 88 60 88 C82 88 100 98 102 121" />
        <path className="ln2" d="M50 89 L60 99 L70 89" />
        <path className="ln2" d="M38 93 C40 103 41 112 41 121" />
        <path className="ln2" d="M82 93 C80 103 79 112 79 121" />
        <g className="cmp">
          <circle className="fill" cx="80" cy="106" r="7.5" />
          <g className="ndl">
            <path className="tr-f" d="M80 99.8 L82.4 106 L77.6 106Z" />
            <path className="fk" d="M80 112.2 L82.4 106 L77.6 106Z" />
          </g>
        </g>
        <path className="ln2" d="M53 80 V89 M67 80 V89" />
        <g className="headg">
          <path className="fill" d="M39 60 Q33.5 60 34.5 66 Q36 70.5 40.5 68.5" />
          <path className="fill" d="M81 60 Q86.5 60 85.5 66 Q84 70.5 79.5 68.5" />
          <ellipse className="fill" cx="60" cy="61" rx="21" ry="23" />
          <path className="ln nose" d="M60 64 Q57.5 68.5 60.5 69.5" />
          <Rosto estado={estado} />
          <g className="hat">
            <path className="fill" d="M38 45 C38 25 82 25 82 45" />
            <path className="tr-f" d="M38.7 38 H81.3 V43.5 H38.7Z" />
            <path className="rel" d="M50 33 Q60 28.5 70 33" />
            <path className="rel" d="M54 29.5 Q60 27.5 66 29.5" />
            <path className="fill" d="M23 46 C36 39.5 84 39.5 97 46 C84 50.5 36 50.5 23 46Z" />
          </g>
        </g>
        <Gesto estado={estado} />
      </g>
    </svg>
  );
};

/** Avatar redondo (versão cabeça) para lista, notificação e cabeçalho do chat. */
export const ExploradorAvatar = ({
  size = 40,
  estado = "explicando",
  still = true
}: {
  size?: number;
  estado?: ExploradorEstado;
  still?: boolean;
}) => (
  <span className="xp-av" style={{ width: size, height: size }} aria-hidden="true">
    <Explorador estado={estado} variant="cabeca" size={size} still={still} decorative />
  </span>
);
