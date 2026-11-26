# Curvas de nível do app React (identidade "Relevo").
# Gera Front-End/react-logic-demo/src/components/brand/relevoTopo.ts — edite este
# script, não o .ts gerado. Mesma técnica da home (build_home.py: topo()).
#
#   python -I design/relevo/gerador/build_app.py .
import json
import pathlib
import sys

import contourpy
import numpy as np


def topo(w, h, peaks, n=12, seed=5, res=(200, 120), step=3):
    """Lista de (d, mestra) com as curvas de nível do relevo descrito por `peaks`."""
    xs = np.linspace(0, w, res[0]); ys = np.linspace(0, h, res[1]); X, Y = np.meshgrid(xs, ys)
    Z = np.zeros_like(X)
    for (px, py, a, sx, sy) in peaks:
        Z += a * np.exp(-(((X - px) / sx) ** 2 + ((Y - py) / sy) ** 2))
    Z += 0.06 * np.sin(X / 51 + seed) * np.cos(Y / 41) + 0.04 * np.sin(X / 23 + Y / 31 + seed)
    gen = contourpy.contour_generator(X, Y, Z)
    out = []
    for i in range(n):
        lv = 0.08 + i * 0.072
        for line in gen.lines(lv):
            if len(line) < 6:
                continue
            pts = line[::step]
            d = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts)
            out.append({"d": d, "em": i % 5 == 4})
    return out


# Entrada (login): cume à direita, onde a trilha termina.
LOGIN = topo(1200, 900, [(860, 330, 1.0, 230, 200), (1120, 800, .5, 170, 140), (300, 820, .42, 240, 150),
                         (180, 160, .35, 220, 150)], n=14, seed=7)
# Cabeçalho de módulo / cartões largos.
FAIXA = topo(1200, 260, [(930, 90, 1.0, 220, 120), (180, 240, .45, 200, 110)], n=11, seed=3, res=(200, 60))
# Trilha do login: da base até o cume, com marcos.
TRILHA = [(250, 900), (360, 790), (470, 720), (560, 640), (640, 560), (720, 470), (800, 400), (856, 336)]

repo = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
dest = repo / "Front-End/react-logic-demo/src/components/brand/relevoTopo.ts"
ts = (
    "// GERADO por design/relevo/gerador/build_app.py — não edite à mão.\n"
    "// Curvas de nível (identidade \"Relevo\"): { d, em } — em = curva mestra (a cada 5).\n"
    "export type Curva = { d: string; em: boolean };\n"
    f"export const TOPO_LOGIN: Curva[] = {json.dumps(LOGIN)};\n"
    f"export const TOPO_FAIXA: Curva[] = {json.dumps(FAIXA)};\n"
    f"export const TRILHA_LOGIN: [number, number][] = {json.dumps(TRILHA)};\n"
)
dest.write_text(ts, encoding="utf-8", newline="\n")
print(f"{dest} · {len(ts) // 1024} KB · login {len(LOGIN)} curvas · faixa {len(FAIXA)} curvas")
