/** @type {import('tailwindcss').Config} */
// Identidade "Relevo" (Learnia): cores, fontes, cantos e movimento vêm do preset,
// que lê os tokens de design/relevo/tokens.css (fonte única, claro e escuro).
// No docker compose, ./design é montado em /design no container de build.
import relevo from "../../design/relevo/tailwind.preset.js";

export default {
  presets: [relevo],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  plugins: []
};
