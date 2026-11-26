/** Preset Tailwind da identidade "Relevo".
 *
 * Uso em Front-End/react-logic-demo/tailwind.config.js:
 *   import relevo from "../../design/relevo/tailwind.preset.js";
 *   export default { presets: [relevo], content: [...] };
 * e importe design/relevo/tokens.css no styles.css.
 *
 * Os nomes ink, muted e line são os mesmos que o app já usa: as telas atuais
 * trocam de cor sozinhas e ganham o modo escuro. brand, teal e coral (a paleta
 * antiga) viram apelidos da nova; migre aos poucos para os nomes semânticos.
 * Atenção: "bg-brand text-white" não funciona no escuro; use
 * "bg-brand text-on-brand".
 */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: ["variant", ['@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *) }', '&:is([data-theme="dark"] *)']],
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        surface: { DEFAULT: c("surface"), 2: c("surface-2") },
        ink: c("ink"),
        muted: c("muted"),
        line: { DEFAULT: c("line"), strong: c("line-strong") },
        contour: { DEFAULT: c("contour"), em: c("contour-em") },
        trail: { DEFAULT: c("trail"), text: c("trail-text") },
        mata: c("mata"),
        "on-ink": c("on-ink"),
        "on-trail": c("on-trail"),
        // apelidos da paleta antiga (transição)
        brand: c("ink"),
        "on-brand": c("on-ink"),
        teal: c("mata"),
        coral: c("trail"),
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "4px", sm: "2px" },
      transitionTimingFunction: {
        subida: "cubic-bezier(.2,.7,.2,1)",
        trilha: "cubic-bezier(.65,0,.35,1)",
      },
      transitionDuration: { rapido: "150ms", medio: "400ms", desenho: "1400ms" },
      boxShadow: {
        // o relevo vem das linhas; sombra só para camadas flutuantes (menus, toasts)
        soft: "0 1px 0 rgb(var(--line)), 0 12px 32px -16px rgb(0 0 0 / .25)",
      },
    },
  },
};
