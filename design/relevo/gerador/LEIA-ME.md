# Geradores da identidade "Relevo"

As páginas são HTML único e sem build: estes scripts as geram. Edite o script, não o HTML gerado.

| Script | Gera |
|---|---|
| `build_home.py` | `Front-End/files/index.html` (home page da Learnia, PT/EN) |
| `build_guia.py` | `design/relevo/guia.html` e os SVGs de `design/relevo/tutor/` |
| `explorador.py` | o tutor Explorador (importado pelos dois acima) |

Requisitos: Python 3.12 com `numpy` e `contourpy` (curvas de nível). Rodar da raiz do repositório:

```bash
python -I design/relevo/gerador/build_home.py . design/relevo/gerador/wordmark.json
python -I design/relevo/gerador/build_guia.py design/relevo design/relevo/gerador/wordmark.json
```

`wordmark.json` é o texto "learnia" em Geist 700 já convertido em curvas (fontTools).

Home page: o texto em PT fica no HTML; o EN vai no atributo `data-en` de cada elemento-folha
(helper `T(pt, en)`), e o JS troca. O idioma vem de `?lang=`, depois do salvo em
`localStorage["edubot.lang"]` (mesma chave do app React), depois do navegador. O botão Demo leva
a `./app/?demo=1&lang=<idioma>#/`; o app abre a demonstração sozinho (`DemoSignIn.tsx`).
