/*
Identidade "Relevo" — logo da Learnia (design/relevo/logo/).

Três anéis são o terreno de uma competência; a trilha pontilhada é o rastro do
aluno; o ponto no centro é a cota que o professor definiu. Os anéis e o texto
usam a cor do texto (Basalto no claro, Papel no escuro); a trilha é sempre a
Trilha. O texto "learnia" (Geist 700) já vem convertido em curvas
(design/relevo/gerador/wordmark.json), igual à home.

Regras do guia: não preencher os anéis, não usar gradiente, não girar, não
trocar a cor da trilha. Símbolo com no mínimo 20 px; horizontal com 96 px.
*/

const RINGS = [
  "M6 30 C4 18 14 7 26 7 C38 7 44 16 42 27 C40 38 30 43 20 42 C11 41 7 37 6 30Z",
  "M14 29 C13 21 19 14 27 14 C34 14 37 20 35 26 C33 32 27 35 21 34 C17 33 14.5 32 14 29Z",
  "M22 25.5 C22 21.5 25 19.5 28 20 C31 20.5 31.5 23.5 30 26 C28.5 28.5 23 29 22 25.5Z"
];

export const RING_OUTER = RINGS[0];

const MarkInner = () => (
  <>
    <g fill="none" stroke="rgb(var(--ink))" strokeWidth={2.2} strokeLinejoin="round">
      {RINGS.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
    <path
      d="M3 46 L10 38 L15 36 L19 30 L26 24.5"
      fill="none"
      stroke="rgb(var(--trail))"
      strokeWidth={2.2}
      strokeDasharray="0.1 4.2"
      strokeLinecap="round"
    />
    <circle cx={26.5} cy={24} r={3} fill="rgb(var(--trail))" />
  </>
);

/** Só o símbolo (quadrado). Use a partir de 20 px. */
export const LearniaMark = ({ size = 32, className, title = "Learnia" }: { size?: number; className?: string; title?: string | null }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    className={className}
    role={title ? "img" : undefined}
    aria-label={title ?? undefined}
    aria-hidden={title ? undefined : true}
  >
    <MarkInner />
  </svg>
);

/** Símbolo + "learnia". `height` controla o tamanho; a largura segue a proporção. */
export const LearniaLogo = ({ height = 28, className }: { height?: number; className?: string }) => (
  <svg
    height={height}
    width={Math.round((height * 416.3) / 86)}
    viewBox="0 0 416.3 86"
    className={className}
    role="img"
    aria-label="Learnia"
  >
    <g transform="scale(1.75)">
      <MarkInner />
    </g>
    <path transform="translate(104 -20.50)" fill="rgb(var(--ink))" d="M20.6 100.5Q14.0 100.5 10.3 97.2Q6.60 93.9 6.60 86.5V29.5H21.6V84.9Q21.6 87.3 22.70 88.3Q23.8 89.3 25.90 89.3H29.5V100.5Z M57.0 101.7Q48.8 101.7 42.75 98.25Q36.7 94.8 33.35 88.5Q30.0 82.2 30.0 73.7Q30.0 65.19 33.35 58.94Q36.7 52.69 42.7 49.19Q48.7 45.69 56.90 45.69Q64.9 45.69 70.80 49.19Q76.7 52.69 79.95 59.19Q83.2 65.69 83.2 74.7V77.7H45.5Q45.8 84.1 48.95 87.19Q52.1 90.3 57.3 90.3Q61.10 90.3 63.65 88.69Q66.2 87.1 67.3 83.8L82.4 84.7Q80.3 92.7 73.5 97.2Q66.7 101.7 57.0 101.7ZM45.5 68.5H67.8Q67.5 62.6 64.55 59.7Q61.60 56.8 56.90 56.8Q52.2 56.8 49.15 59.84Q46.1 62.9 45.5 68.5Z M104.3 101.7Q96.0 101.7 90.75 97.85Q85.5 94.0 85.5 87.1Q85.5 80.0 89.95 76.15Q94.4 72.3 103.1 70.5L120.4 67.1Q120.4 61.9 118.05 59.25Q115.69 56.59 111.3 56.59Q107.0 56.59 104.6 58.55Q102.2 60.5 101.5 64.3L86.39 63.6Q87.89 54.8 94.35 50.25Q100.8 45.69 111.3 45.69Q123.3 45.69 129.35 51.39Q135.4 57.09 135.4 68.1V86.4Q135.4 88.7 136.15 89.45Q136.9 90.2 138.4 90.2H139.9V100.5Q139.2 100.7 137.64 100.9Q136.1 101.1 134.6 101.1Q131.4 101.1 128.65 100.0Q125.9 98.9 124.2 96.25Q122.5 93.6 122.5 88.7L123.8 89.7Q122.8 93.3 120.25 96.0Q117.69 98.7 113.64 100.2Q109.6 101.7 104.3 101.7ZM107.9 91.4Q111.6 91.4 114.39 89.95Q117.19 88.5 118.8 85.7Q120.4 82.9 120.4 79.1V76.5L108.2 79.1Q104.6 79.8 102.75 81.44Q100.9 83.1 100.9 85.7Q100.9 88.4 102.7 89.9Q104.5 91.4 107.9 91.4Z M142.79 100.5V46.9H157.0L157.5 62.5L156.39 62.19Q157.7 54.09 161.0 50.5Q164.29 46.9 170.1 46.9H175.0V59.3H170.1Q165.89 59.3 163.2 60.4Q160.5 61.5 159.14 63.9Q157.79 66.3 157.79 70.4V100.5Z M180.29 100.5V46.9H193.79L194.39 62.6L192.5 62.09Q193.29 56.09 195.75 52.5Q198.2 48.9 201.89 47.3Q205.6 45.69 210.0 45.69Q215.79 45.69 219.84 48.19Q223.89 50.69 226.04 55.25Q228.2 59.8 228.2 66.0V100.5H213.2V71.0Q213.2 66.69 212.5 63.69Q211.79 60.69 210.0 59.14Q208.2 57.59 205.0 57.59Q200.29 57.59 197.79 61.05Q195.29 64.5 195.29 71.0V100.5Z M236.39 100.5V46.9H251.39V100.5ZM236.09 40.3V28.29H251.59V40.3Z M275.4 101.7Q267.09 101.7 261.84 97.85Q256.59 94.0 256.59 87.1Q256.59 80.0 261.04 76.15Q265.5 72.3 274.2 70.5L291.5 67.1Q291.5 61.9 289.15 59.25Q286.79 56.59 282.4 56.59Q278.09 56.59 275.69 58.55Q273.29 60.5 272.59 64.3L257.5 63.6Q259.0 54.8 265.45 50.25Q271.9 45.69 282.4 45.69Q294.4 45.69 300.45 51.39Q306.5 57.09 306.5 68.1V86.4Q306.5 88.7 307.25 89.45Q308.0 90.2 309.5 90.2H311.0V100.5Q310.29 100.7 308.75 100.9Q307.2 101.1 305.7 101.1Q302.5 101.1 299.75 100.0Q297.0 98.9 295.29 96.25Q293.59 93.6 293.59 88.7L294.9 89.7Q293.9 93.3 291.34 96.0Q288.79 98.7 284.75 100.2Q280.7 101.7 275.4 101.7ZM279.0 91.4Q282.7 91.4 285.5 89.95Q288.29 88.5 289.9 85.7Q291.5 82.9 291.5 79.1V76.5L279.29 79.1Q275.7 79.8 273.85 81.44Q272.0 83.1 272.0 85.7Q272.0 88.4 273.79 89.9Q275.59 91.4 279.0 91.4Z" />
  </svg>
);
