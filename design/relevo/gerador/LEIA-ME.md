# Geradores da identidade "Relevo"

As páginas são HTML único e sem build: estes scripts as geram. Edite o script, não o HTML gerado.

| Script | Gera |
|---|---|
| `build_home.py` | `Front-End/files/index.html` (home page da Learnia, PT/EN) |
| `build_guia.py` | `design/relevo/guia.html` e os SVGs de `design/relevo/tutor/` |
| `explorador.py` | o tutor Explorador (importado pelos dois acima) |
| `build_app.py` | `Front-End/react-logic-demo/src/components/brand/relevoTopo.ts` (curvas de nível do app React) |

Requisitos: Python 3.12 com `numpy` e `contourpy` (curvas de nível). Rodar da raiz do repositório:

```bash
python -I design/relevo/gerador/build_home.py . design/relevo/gerador/wordmark.json
python -I design/relevo/gerador/build_guia.py design/relevo design/relevo/gerador/wordmark.json
python -I design/relevo/gerador/build_app.py .
```

## App React

O app (`Front-End/react-logic-demo`) usa a identidade direto da fonte: `tailwind.config.js`
importa `design/relevo/tailwind.preset.js` e `src/styles.css` importa `design/relevo/tokens.css`
(no docker compose, `./design` é montado em `/design` no container de build). O que é desenho
vira componente React, não arquivo copiado:

| Peça | Onde |
|---|---|
| Logo (símbolo e horizontal) | `src/components/brand/LearniaLogo.tsx` (mesmas curvas do `wordmark.json`) |
| Tutor Explorador (6 estados, busto e cabeça) | `src/components/brand/Explorador.tsx` + CSS `.chr` em `styles.css` (porte do `explorador.py`) |
| Curvas de nível de fundo, trilha do login | `src/components/brand/TopoMap.tsx` + `relevoTopo.ts` (gerado) |
| Carregamento (ondas a partir do cume) | `src/components/brand/RelevoLoader.tsx` |
| Domínio por competência (morros + cota) | `src/components/ui/DomainMountains.tsx` — cota 80 = `DEVELOPED_THRESHOLD` do BKT |
| Status ✓ ◐ ▲, régua de elevação, rótulo | `src/components/ui/Relevo.tsx` + `.tag`, `.elev`, `.lab` em `styles.css` |
| Gráficos (Recharts) | `src/components/ui/chartTheme.ts` |
| Tema claro/escuro e PT/EN no topo | `src/components/ui/ShellControls.tsx` (tema em `localStorage["learnia-tema"]`, a mesma chave da home) |

`wordmark.json` é o texto "learnia" em Geist 700 já convertido em curvas (fontTools).

Home page: o texto em PT fica no HTML; o EN vai no atributo `data-en` de cada elemento-folha
(helper `T(pt, en)`), e o JS troca. O idioma vem de `?lang=`, depois do salvo em
`localStorage["edubot.lang"]` (mesma chave do app React), depois do navegador. O botão Demo leva
a `./app/?demo=1&lang=<idioma>#/`; o app abre a demonstração sozinho (`DemoSignIn.tsx`).
