# Gera design/relevo/guia.html — guia vivo da identidade "Relevo" (claro/escuro + movimento)
import sys, pathlib, json
import numpy as np, contourpy
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import explorador as EX

ROOT = pathlib.Path(sys.argv[1])            # .../design/relevo
OUT = ROOT / "guia.html"
TOKENS = (ROOT / "tokens.css").read_text(encoding="utf-8")
LOGO = ROOT / "logo"

def topo(w, h, peaks, n=14, seed=5, res=(240, 120)):
    xs = np.linspace(0, w, res[0]); ys = np.linspace(0, h, res[1]); X, Y = np.meshgrid(xs, ys)
    Z = np.zeros_like(X)
    for (px, py, a, sx, sy) in peaks: Z += a * np.exp(-(((X - px) / sx) ** 2 + ((Y - py) / sy) ** 2))
    Z += 0.06 * np.sin(X / 51 + seed) * np.cos(Y / 41) + 0.04 * np.sin(X / 23 + Y / 31 + seed)
    gen = contourpy.contour_generator(X, Y, Z); out = []
    for i in range(n):
        lv = 0.08 + i * 0.072
        for line in gen.lines(lv):
            if len(line) < 6: continue
            d = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in line[::2])
            out.append(f'<path d="{d}"{" class=\"em\"" if i % 5 == 4 else ""}/>')
    return "".join(out)

HERO_TOPO = topo(1600, 760, [(1180, 300, 1.0, 260, 190), (1460, 660, .5, 170, 140), (820, 730, .45, 220, 130), (380, 150, .38, 260, 160), (110, 600, .3, 180, 150)], n=15)
CARD_TOPO = topo(600, 300, [(420, 120, 1.0, 140, 100), (90, 250, .5, 120, 90)], n=11, seed=2)

RINGS = ['M6 30 C4 18 14 7 26 7 C38 7 44 16 42 27 C40 38 30 43 20 42 C11 41 7 37 6 30Z',
         'M14 29 C13 21 19 14 27 14 C34 14 37 20 35 26 C33 32 27 35 21 34 C17 33 14.5 32 14 29Z',
         'M22 25.5 C22 21.5 25 19.5 28 20 C31 20.5 31.5 23.5 30 26 C28.5 28.5 23 29 22 25.5Z']
TRAIL = 'M3 46 L10 38 L15 36 L19 30 L26 24.5'

def mark(cls="mk", sw=2.2, anim=False, uid="m"):
    rings = "".join(f'<path pathLength="1" d="{d}" style="--i:{i}"/>' for i, d in enumerate(RINGS))
    if anim:
        tr = (f'<mask id="{uid}-tm"><path d="{TRAIL}" pathLength="1" class="tmask" stroke="#fff" stroke-width="6" fill="none"/></mask>'
              f'<path d="{TRAIL}" class="tr" mask="url(#{uid}-tm)"/>')
    else:
        tr = f'<path d="{TRAIL}" class="tr"/>'
    return (f'<svg viewBox="0 0 48 48" class="{cls}" aria-hidden="true"><g class="rings" stroke-width="{sw}">{rings}</g>'
            f'{tr}<circle cx="26.5" cy="24" r="3" class="sum"/></svg>')

WORD = json.loads(pathlib.Path(sys.argv[2]).read_text())
def wordmark(cls="wm"):
    y0 = WORD["baseline"] - 80
    return (f'<svg viewBox="0 0 {104 + WORD["width"]:.0f} 86" class="{cls}" role="img" aria-label="Learnia">'
            f'<g transform="scale(1.75)">{mark("mk-in")[len("<svg viewBox=\"0 0 48 48\" class=\"mk-in\" aria-hidden=\"true\">"):-6]}</g>'
            f'<path transform="translate(104 {-y0:.2f})" class="wmt" d="{WORD["d"]}"/></svg>')

ARROW = '<svg viewBox="0 0 20 20" class="arw" aria-hidden="true"><path d="M3 10h13M11 5l5 5-5 5"/></svg>'
IC = {
 "ok":  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
 "mid": '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/></svg>',
 "low": '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l6.5 12h-13z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 6.5v3.5M8 11.6v.4" stroke="currentColor" stroke-width="2"/></svg>',
}

# ---------- trilha do hero ----------
TR_PTS = [(600, 770), (720, 700), (830, 650), (930, 590), (1000, 525), (1060, 450), (1120, 375), (1170, 310)]
TR_D = "M" + " L".join(f"{x} {y}" for x, y in TR_PTS)
WPS = [(720, 700, "QUIZ · 51", "w1"), (930, 590, "VÍDEO IA · 4 MIN", "w2"), (1060, 450, "CONVERSA GUIADA", "w3"), (1176, 304, "META 70 · COTA ATINGIDA", "w4 top")]
WP_SVG = "".join(f'<g class="wp {c}"><circle cx="{x}" cy="{y}" r="{11 if "top" in c else 8}"/><text x="{x+20}" y="{y+5}">{t}</text></g>' for x, y, t, c in WPS)

# ---------- montanhas ----------
def mountains():
    data = [("Princípios", 82, "ok"), ("Aplicações", 68, "mid"), ("Desafios", 51, "low")]
    w, h = 400, 230; base = h - 42; top = 18
    y = lambda v: base - (base - top) * v / 100
    out, defs = "", ""
    for i, (n, v, s) in enumerate(data):
        cx = 72 + i * 128; px = y(v)
        d = f"M{cx-76} {base} C{cx-42} {base} {cx-28} {px:.1f} {cx} {px:.1f} C{cx+28} {px:.1f} {cx+42} {base} {cx+76} {base} Z"
        defs += f'<clipPath id="mc{i}"><path d="{d}"/></clipPath>'
        lines = "".join(f'<line x1="0" x2="{w}" y1="{y(t):.1f}" y2="{y(t):.1f}"/>' for t in range(8, 100, 8))
        out += (f'<g class="mt {s}" style="--i:{i}"><path d="{d}" class="body"/><g clip-path="url(#mc{i})" class="cl">{lines}</g>'
                f'<text x="{cx}" y="{px-10:.1f}" class="pv" data-to="{v}">{v}</text></g>'
                f'<text x="{cx}" y="{h-20}" class="nm">{n}</text>')
    out += (f'<line x1="8" x2="{w-8}" y1="{y(70):.1f}" y2="{y(70):.1f}" class="goal" pathLength="1"/>'
            f'<text x="{w-8}" y="{y(70)-7:.1f}" class="gl">cota 70</text><line x1="0" x2="{w}" y1="{base}" y2="{base}" class="base"/>')
    return f'<svg viewBox="0 0 {w} {h}" class="mts" role="img" aria-label="Domínio: Princípios 82, Aplicações 68, Desafios 51; meta 70"><defs>{defs}</defs>{out}</svg>'

# ---------- perfil de elevação ----------
def profile():
    past = [30, 38, 46, 51]; fut = [58, 64, 72, 74]
    labs = ["sem 1", "sem 2", "sem 3", "quiz", "vídeo IA", "conversa", "prática", "revisão"]
    w, h = 720, 300; pl, pb, pt = 40, 44, 26; step = (w - pl - 34) / 7
    y = lambda v: pt + (h - pt - pb) * (1 - v / 100)
    xs = [pl + i * step for i in range(8)]; pts = list(zip(xs, past + fut))
    def sm(p):
        d = f"M{p[0][0]:.1f} {y(p[0][1]):.1f}"
        for i in range(1, len(p)):
            (x0, v0), (x1, v1) = p[i-1], p[i]; c = (x0 + x1) / 2
            d += f" C{c:.1f} {y(v0):.1f} {c:.1f} {y(v1):.1f} {x1:.1f} {y(v1):.1f}"
        return d
    area = sm(pts) + f" L{xs[-1]:.1f} {y(0):.1f} L{xs[0]:.1f} {y(0):.1f} Z"
    hl = "".join(f'<line x1="{pl}" x2="{w-20}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>' for v in range(10, 100, 10))
    lab = "".join(f'<text x="{x:.1f}" y="{h-16}"{" class=\"now\"" if i==3 else ""}>{l}</text>' for i, (x, l) in enumerate(zip(xs, labs)))
    dots = "".join(f'<circle cx="{x:.1f}" cy="{y(v):.1f}" r="{7 if i==3 else 4}" class="{"pn" if i==3 else ("pp" if i<3 else "pf")}" style="--i:{i}"/>' for i, (x, v) in enumerate(pts))
    return f'''<svg viewBox="0 0 {w} {h}" class="prof" role="img" aria-label="Perfil de elevação: domínio em Desafios subiu de 30 para 51; a trilha prevista chega a 74, acima da meta 70">
      <defs><clipPath id="par"><path d="{area}"/></clipPath></defs>
      <path d="{area}" class="area"/><g clip-path="url(#par)" class="cl">{hl}</g>
      <line x1="{pl}" x2="{w-20}" y1="{y(70):.1f}" y2="{y(70):.1f}" class="goal"/>
      <text x="{pl+4}" y="{y(70)-9:.1f}" class="gl">cota 70 · meta do professor</text>
      <path d="{sm(pts[:4])}" class="past" pathLength="1"/><path d="{sm(pts[3:])}" class="fut"/>
      {dots}
      <g class="pin"><rect x="{xs[3]-64}" y="{y(51)+16:.1f}" width="128" height="24" rx="2"/><text x="{xs[3]:.1f}" y="{y(51)+32:.1f}">você está aqui · 51</text></g>
      {lab}</svg>'''

# ---------- rastro da semana ----------
def week():
    days = [("S", "done"), ("T", "done"), ("Q", "miss"), ("Q", "done"), ("S", "today"), ("S", "fut"), ("D", "fut")]
    w, h = 460, 92; xs = [24 + i * 68 for i in range(7)]; ys = [58, 44, 50, 34, 24, 30, 22]
    d = "M" + " L".join(f"{x} {y}" for x, y in zip(xs[:5], ys[:5]))
    dfut = "M" + " L".join(f"{x} {y}" for x, y in zip(xs[4:], ys[4:]))
    pts = "".join(f'<g class="dp {s}" style="--i:{i}"><circle cx="{x}" cy="{y}" r="{9 if s=="today" else 6}"/><text x="{x}" y="{h-4}">{l}</text></g>' for i, ((l, s), x, y) in enumerate(zip(days, xs, ys)))
    return f'<svg viewBox="0 0 {w} {h}" class="wk" role="img" aria-label="Rastro da semana: 4 de 7 dias"><path d="{d}" class="wl" pathLength="1"/><path d="{dfut}" class="wf"/>{pts}</svg>'

def swatches(theme, rows):
    r = "".join(f'''<div class="sw-row"><span class="chip" style="background:{h}"></span><div><b>{n}</b><code>--{tok}</code></div><span class="hex">{h}</span><span class="use">{u}</span><span class="ctr">{c}</span></div>''' for n, tok, h, u, c in rows)
    return f'<div class="pal pal-{theme}"><div class="pal-h">{"Claro · papel de mapa" if theme=="claro" else "Escuro · mapa noturno"}</div>{r}</div>'

PAL_CLARO = [("Papel de mapa","bg","#F1EEE4","fundo",""),("Folha","surface","#FBFAF5","cartões",""),("Basalto","ink","#14161A","texto, botão primário","15,6:1"),
             ("Grafite","muted","#5A5C61","texto secundário","5,8:1"),("Curva","contour","#C9C1AA","curvas de nível","decorativo"),
             ("Trilha","trail","#E2501B","gráficos, botão de destaque","3,4:1 gráfico"),("Trilha texto","trail-text","#B23C10","texto de alerta, links","5,1:1"),("Mata","mata","#1E6B52","na meta","5,5:1")]
PAL_ESCURO = [("Mapa noturno","bg","#0E1013","fundo",""),("Folha","surface","#171A1F","cartões",""),("Papel","ink","#ECE8DC","texto, botão primário","15,6:1"),
              ("Névoa","muted","#A3A39B","texto secundário","7,5:1"),("Curva","contour","#2B3036","curvas de nível","decorativo"),
              ("Trilha","trail","#FF6A33","gráficos, botão de destaque","6,7:1"),("Trilha texto","trail-text","#FF8656","texto de alerta, links","8,0:1"),("Mata","mata","#45BC8F","na meta","8,0:1")]

LOGO_H_CLARO = (LOGO / "learnia-horizontal-claro.svg").read_text(encoding="utf-8")
LOGO_H_ESCURO = (LOGO / "learnia-horizontal-escuro.svg").read_text(encoding="utf-8")
APP_ICON = (LOGO / "learnia-app-icon.svg").read_text(encoding="utf-8")
FAVICON = (LOGO / "favicon.svg").read_text(encoding="utf-8")

def dont(label, inner, extra=""):
    return f'<figure class="dont"><div class="dbox">{inner}</div><figcaption><span class="x" aria-hidden="true">✕</span>{label}</figcaption></figure>'

def mark_static(ink, trail, style="", fill="none", grad=False):
    g = ('<defs><linearGradient id="bad" x1="0" x2="1"><stop offset="0" stop-color="#4F7BFF"/><stop offset="1" stop-color="#9B5CFF"/></linearGradient></defs>' if grad else "")
    st = "url(#bad)" if grad else ink
    rings = "".join(f'<path d="{d}"/>' for d in RINGS)
    return (f'<svg viewBox="0 0 48 48" style="{style}">{g}<g fill="{fill}" stroke="{st}" stroke-width="2.2">{rings}</g>'
            f'<path d="{TRAIL}" fill="none" stroke="{trail}" stroke-width="2.2" stroke-dasharray="0.1 4.2" stroke-linecap="round"/><circle cx="26.5" cy="24" r="3" fill="{trail}"/></svg>')

DONTS = "".join([
    dont("Não preencher os anéis", mark_static("#14161A", "#E2501B", fill="#14161A")),
    dont("Não usar gradiente", mark_static("", "#9B5CFF", grad=True)),
    dont("Não girar nem inclinar", mark_static("#14161A", "#E2501B", style="transform:rotate(28deg)")),
    dont("Não trocar a cor da trilha", mark_static("#14161A", "#2B7BFF")),
])

CSS = r'''
*{box-sizing:border-box;margin:0;padding:0}
html{background:rgb(var(--bg));color:rgb(var(--ink));font-family:var(--font-sans);-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
body{background:rgb(var(--bg));transition:background-color var(--dur-medio) var(--ease-subida),color var(--dur-medio) var(--ease-subida)}
svg{display:block}
a{color:inherit}
.wrap{max-width:1200px;margin:0 auto;padding:0 32px}
.k{font:500 12px var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:rgb(var(--trail-text))}
h2.sec{font:700 44px/1.02 var(--font-sans);letter-spacing:-.045em;margin:10px 0 12px}
.lead{font-size:17px;line-height:1.55;color:rgb(var(--muted));max-width:680px}
section.s{padding:96px 0;border-top:1px solid rgb(var(--line))}
.card{background:rgb(var(--surface));border:1px solid rgb(var(--line));border-radius:var(--radius)}
:focus-visible{outline:2px solid rgb(var(--trail));outline-offset:2px}

/* barra superior */
.top{position:sticky;top:0;z-index:20;background:rgb(var(--bg)/.86);backdrop-filter:saturate(1.2) blur(8px);border-bottom:1px solid rgb(var(--line))}
.top .wrap{display:flex;align-items:center;gap:28px;height:64px}
.top .wm{height:28px;width:auto}
.top nav{display:flex;gap:22px;font-size:14px;color:rgb(var(--muted));margin-left:auto}
.top nav a{text-decoration:none}.top nav a:hover{color:rgb(var(--ink))}
.seg{display:inline-flex;border:1px solid rgb(var(--line-strong));border-radius:var(--radius);overflow:hidden}
.seg button{font:500 12px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;padding:7px 10px;background:none;border:0;color:rgb(var(--muted));cursor:pointer}
.seg button[aria-pressed="true"]{background:rgb(var(--ink));color:rgb(var(--on-ink))}
.ctrls{display:flex;gap:10px;align-items:center}

/* logo e símbolo */
.mk,.mk-in{overflow:visible}
.rings path{fill:none;stroke:rgb(var(--ink));stroke-linejoin:round}
.tr{fill:none;stroke:rgb(var(--trail));stroke-width:2.2;stroke-dasharray:.1 4.2;stroke-linecap:round}
.sum{fill:rgb(var(--trail))}
.wmt{fill:rgb(var(--ink))}

/* botões */
.btn{display:inline-flex;align-items:center;gap:10px;font:600 15px var(--font-sans);padding:12px 18px;border-radius:var(--radius);text-decoration:none;border:1px solid transparent;cursor:pointer;transition:background-color var(--dur-rapido),transform var(--dur-rapido) var(--ease-subida)}
.btn .arw{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;transition:transform var(--dur-medio) var(--ease-subida)}
.btn:hover .arw{transform:translateX(4px)}
.btn:active{transform:translateY(1px)}
.btn-pri{background:rgb(var(--ink));color:rgb(var(--on-ink))}
.btn-pri:hover{background:rgb(var(--ink)/.86)}
.btn-acc{background:rgb(var(--trail));color:rgb(var(--on-trail))}
.btn-acc:hover{background:rgb(var(--trail)/.88)}
.btn-gh{background:rgb(var(--surface));color:rgb(var(--ink));border-color:rgb(var(--line-strong))}
.btn-gh:hover{background:rgb(var(--surface-2))}
.btn-sm{font-size:13.5px;padding:8px 13px}
.lnk{color:rgb(var(--trail-text));font-weight:600;text-underline-offset:3px}

/* HERO */
.hero{position:relative;height:680px;overflow:hidden;border-bottom:1px solid rgb(var(--line))}
.hero .map{position:absolute;inset:-40px;animation:deriva var(--dur-deriva) ease-in-out infinite alternate}
.hero .map svg{width:100%;height:100%}
.topo path{fill:none;stroke:rgb(var(--contour));stroke-width:1.1;vector-effect:non-scaling-stroke}
.topo path.em{stroke:rgb(var(--contour-em));stroke-width:1.5}
@keyframes deriva{from{transform:translate3d(0,0,0) scale(1.02)}to{transform:translate3d(-34px,16px,0) scale(1.05)}}
.hero .fade{position:absolute;inset:0;background:linear-gradient(90deg,rgb(var(--bg)) 32%,rgb(var(--bg)/.0) 66%);pointer-events:none}
.topo .trailp{fill:none;stroke:rgb(var(--trail));stroke-width:3.2;stroke-dasharray:.1 11;stroke-linecap:round;vector-effect:non-scaling-stroke}
.topo .trailmask{fill:none;stroke:#fff;stroke-width:40;stroke-dasharray:1;stroke-dashoffset:0}
.wp circle{fill:rgb(var(--surface));stroke:rgb(var(--ink));stroke-width:2.4}
.wp.top circle{fill:rgb(var(--trail))}
.wp text{font:600 14px var(--font-mono);letter-spacing:.06em;fill:rgb(var(--ink));paint-order:stroke;stroke:rgb(var(--bg));stroke-width:6px;stroke-linejoin:round}
.ping{fill:none;stroke:rgb(var(--trail));stroke-width:2;transform-box:fill-box;transform-origin:center;opacity:0}
.hero .copy{position:relative;z-index:2;padding-top:120px;max-width:640px}
.coord{font:500 12px var(--font-mono);letter-spacing:.1em;color:rgb(var(--muted));margin-bottom:18px}
.hero h1{font:700 66px/.98 var(--font-sans);letter-spacing:-.05em}
.hero p{font-size:19px;line-height:1.5;color:rgb(var(--muted));margin:22px 0 30px;max-width:540px}
.ctas{display:flex;gap:12px;flex-wrap:wrap}
.hero .meta-ui{position:absolute;right:32px;bottom:24px;z-index:2;font:500 11px var(--font-mono);color:rgb(var(--muted));letter-spacing:.08em}

/* animação da trilha (só com JS e com movimento ligado) */
.js .hero .trailmask{stroke-dashoffset:1}
.js .hero.in .trailmask{animation:desenha 2.4s var(--ease-trilha) .3s forwards}
.js .hero .wp{opacity:0;transform:translateY(6px);transform-box:fill-box}
.js .hero.in .wp{animation:surge .5s var(--ease-subida) forwards}
.js .hero.in .w1{animation-delay:.7s}.js .hero.in .w2{animation-delay:1.3s}.js .hero.in .w3{animation-delay:1.9s}.js .hero.in .w4{animation-delay:2.5s}
.js .hero.in .ping{animation:ping 2.4s var(--ease-subida) 2.9s infinite}
@keyframes desenha{to{stroke-dashoffset:0}}
@keyframes surge{to{opacity:1;transform:none}}
@keyframes ping{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}

/* revelar ao rolar */
.js .rv{opacity:0;transform:translateY(14px)}
.js .rv.in{opacity:1;transform:none;transition:opacity var(--dur-medio) var(--ease-subida),transform var(--dur-medio) var(--ease-subida)}

/* LOGO */
.logo-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;margin-top:40px}
.stage{position:relative;overflow:hidden;min-height:380px;display:grid;place-items:center}
.stage .topo{position:absolute;inset:0;width:100%;height:100%;opacity:.7}
.stage .big{position:relative;width:220px;height:220px}
.js .stage .rings path{stroke-dasharray:1;stroke-dashoffset:1}
.js .stage.in .rings path{animation:desenha .9s var(--ease-trilha) forwards;animation-delay:calc(var(--i)*.22s)}
.js .stage .tmask{stroke-dasharray:1;stroke-dashoffset:1}
.js .stage.in .tmask{animation:desenha .7s var(--ease-trilha) .8s forwards}
.js .stage .sum{transform-box:fill-box;transform-origin:center;transform:scale(0)}
.js .stage.in .sum{animation:pop .5s cubic-bezier(.3,1.6,.5,1) 1.4s forwards}
@keyframes pop{to{transform:scale(1)}}
.replay{position:absolute;right:12px;top:12px;font:500 11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;background:rgb(var(--surface));color:rgb(var(--ink));border:1px solid rgb(var(--line-strong));border-radius:var(--radius);padding:6px 9px;cursor:pointer}
.lockups{display:grid;grid-template-rows:1fr 1fr;gap:20px}
.lk{display:grid;place-items:center;padding:30px;border-radius:var(--radius)}
.lk svg{width:260px;height:auto}
.lk.l{background:#F1EEE4;border:1px solid #D3CCB9}.lk.d{background:#0E1013;border:1px solid #2E3238}
.lk small{font:500 11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;margin-top:10px}
.lk.l small{color:#5A5C61}.lk.d small{color:#A3A39B}
.logo-row{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:20px}
.lr{padding:22px;display:flex;flex-direction:column;gap:14px}
.lr .t{font:600 15px var(--font-sans)}
.lr p{font-size:13.5px;line-height:1.5;color:rgb(var(--muted))}
.icons{display:flex;align-items:flex-end;gap:14px}
.icons svg{width:64px;height:64px}
.favs{display:flex;align-items:flex-end;gap:16px}
.favs svg{width:100%;height:100%}
.space{position:relative;padding:18px;border:1px dashed rgb(var(--trail))}
.space .mk{width:56px;height:56px}
.donts{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:20px}
.dont .dbox{background:#F1EEE4;border:1px solid #D3CCB9;border-radius:var(--radius);height:120px;display:grid;place-items:center}
.dont .dbox svg{width:64px;height:64px}
.dont figcaption{font-size:13.5px;margin-top:8px;display:flex;gap:8px;align-items:center}
.dont .x{color:rgb(var(--trail-text));font-weight:700}

/* CORES */
.pals{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:40px}
.pal{border-radius:var(--radius);padding:8px 22px 14px}
.pal-claro{background:#FBFAF5;color:#14161A;border:1px solid #D3CCB9}
.pal-escuro{background:#171A1F;color:#ECE8DC;border:1px solid #2E3238}
.pal-h{font:500 12px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;padding:14px 0 10px}
.sw-row{display:grid;grid-template-columns:44px 1.3fr 80px 1.4fr 82px;gap:12px;align-items:center;padding:9px 0;border-top:1px solid currentColor;border-color:rgba(127,127,127,.25)}
.chip{width:44px;height:32px;border-radius:2px;border:1px solid rgba(127,127,127,.35)}
.sw-row b{font-size:14px;display:block}.sw-row code{font:400 11px var(--font-mono);opacity:.7}
.hex{font:500 12px var(--font-mono)}.use{font-size:13px;opacity:.8}.ctr{font:500 11.5px var(--font-mono);text-align:right;opacity:.85}
.rules{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:20px}
.rule{padding:20px 22px}
.rule b{display:block;font-size:16px;margin-bottom:6px}.rule p{font-size:14px;line-height:1.5;color:rgb(var(--muted))}

/* TIPO */
.type{margin-top:40px}
.tr-row{display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:baseline;padding:18px 0;border-top:1px solid rgb(var(--line))}
.t-disp{font:700 66px/.98 var(--font-sans);letter-spacing:-.05em}.t-tit{font:700 44px/1.02 var(--font-sans);letter-spacing:-.045em}
.mvw{overflow-x:auto}
.tr-row .spec{font:500 11.5px var(--font-mono);letter-spacing:.06em;color:rgb(var(--muted));text-transform:uppercase;line-height:1.6}

/* COMPONENTES */
.comp-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:20px;margin-top:40px}
.cp{padding:22px 24px;position:relative;overflow:hidden}
.cp .lab{font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));margin-bottom:14px;display:flex;justify-content:space-between}
.cp .lab span{color:rgb(var(--muted))}
.c4{grid-column:span 4}.c5{grid-column:span 5}.c6{grid-column:span 6}.c7{grid-column:span 7}.c8{grid-column:span 8}.c12{grid-column:span 12}
.btns{display:flex;flex-wrap:wrap;gap:10px}
.tags{display:flex;flex-direction:column;gap:10px}
.tag{display:inline-flex;align-items:center;gap:7px;font:500 12px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;width:fit-content;padding:5px 9px;border-radius:var(--radius-sm);border:1px solid currentColor}
.tag svg{width:14px;height:14px}
.tag.ok{color:rgb(var(--mata))}.tag.mid{color:rgb(var(--ink));background:rgb(var(--surface-2));border-color:rgb(var(--line-strong))}.tag.low{color:rgb(var(--trail-text))}
.next h3{font:700 24px/1.12 var(--font-sans);letter-spacing:-.03em;margin-bottom:6px}
.next p{font-size:14px;color:rgb(var(--muted))}
.elev{height:26px;margin:20px 0 16px;position:relative;border-bottom:1.5px solid rgb(var(--ink));background:repeating-linear-gradient(90deg,rgb(var(--contour-em)) 0 1px,transparent 1px 9px)}
.elev span{position:absolute;left:0;bottom:0;height:100%;width:40%;background:rgb(var(--trail));clip-path:polygon(0 100%,0 75%,30% 55%,60% 30%,100% 0,100% 100%);transform-origin:left}
.js .elev span{transform:scaleX(0)}
.js .in .elev span{transform:scaleX(1);transition:transform 1.2s var(--ease-trilha) .2s}
.nx{display:flex;justify-content:space-between;align-items:center;gap:12px}
.nx small{font:500 11.5px var(--font-mono);color:rgb(var(--muted))}
.mts{width:100%;height:auto}
.mts .body{fill:rgb(var(--surface-2));stroke:rgb(var(--ink));stroke-width:1.6}
.mts .cl line{stroke:rgb(var(--contour-em))}
.mts .low .cl line{stroke:rgb(var(--trail));opacity:.6}
.mts .pv{font:700 16px var(--font-sans);fill:rgb(var(--ink));text-anchor:middle}
.mts .low .pv{fill:rgb(var(--trail-text))}
.mts .nm{font:500 11.5px var(--font-mono);fill:rgb(var(--muted));text-anchor:middle}
.mts .goal,.prof .goal{stroke:rgb(var(--trail));stroke-width:1.6;stroke-dasharray:6 5}
.mts .gl,.prof .gl{font:500 11px var(--font-mono);fill:rgb(var(--trail-text));text-anchor:end}
.prof .gl{text-anchor:start}
.mts .base{stroke:rgb(var(--ink));stroke-width:1.6}
.mt{transform-box:view-box}
.js .mt .body,.js .mt .cl,.js .mt .pv{transform-box:fill-box;transform-origin:50% 100%}
.js .mts .mt{opacity:0}
.js .in .mts .mt{opacity:1;animation:sobe .9s var(--ease-subida) both;animation-delay:calc(var(--i)*.15s)}
@keyframes sobe{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.prof{width:100%;height:auto}
.prof .area{fill:rgb(var(--surface-2))}
.prof .cl line{stroke:rgb(var(--contour-em))}
.prof .past{fill:none;stroke:rgb(var(--ink));stroke-width:2.6}
.prof .fut{fill:none;stroke:rgb(var(--ink));stroke-width:2.2;stroke-dasharray:.1 7;stroke-linecap:round}
.prof .pp{fill:rgb(var(--ink))}.prof .pf{fill:rgb(var(--surface));stroke:rgb(var(--ink));stroke-width:1.6}
.prof .pn{fill:rgb(var(--trail));stroke:rgb(var(--ink));stroke-width:2}
.prof text{font:500 11.5px var(--font-mono);fill:rgb(var(--muted));text-anchor:middle}
.prof text.now{fill:rgb(var(--ink));font-weight:600}
.prof .pin rect{fill:rgb(var(--ink))}.prof .pin text{fill:rgb(var(--on-ink));font-size:11px}
.js .prof .past{stroke-dasharray:1;stroke-dashoffset:1}
.js .in .prof .past{animation:desenha 1.4s var(--ease-trilha) .2s forwards}
.js .prof .fut,.js .prof .pf,.js .prof .pin,.js .prof .pn{opacity:0}
.js .in .prof .fut,.js .in .prof .pf{animation:surge .6s var(--ease-subida) 1.6s forwards}
.js .in .prof .pn{animation:surge .3s var(--ease-subida) 1.4s forwards}
.js .prof .pin{transform:translateY(-10px)}
.js .in .prof .pin{animation:surge .5s cubic-bezier(.3,1.6,.5,1) 1.6s forwards}
.tutor .q{margin-left:auto;width:fit-content;max-width:85%;font-size:14px;padding:9px 13px;border:1px solid rgb(var(--line-strong));border-radius:var(--radius)}
.tutor .who{font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));margin:14px 0 6px}
.tutor .a{font-size:15px;line-height:1.55;border-left:2px solid rgb(var(--trail));padding-left:13px}
.srcs{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.srcs a{font:500 11px var(--font-mono);letter-spacing:.03em;padding:5px 8px;border:1px solid rgb(var(--line-strong));border-radius:var(--radius-sm);text-decoration:none}
.srcs a:hover{border-color:rgb(var(--ink))}
.ai{margin-top:14px;padding-top:10px;border-top:1px solid rgb(var(--line));font:400 11px var(--font-mono);color:rgb(var(--muted))}
.ask{display:flex;gap:8px;margin-top:14px}
.ask input{flex:1;font:400 14px var(--font-sans);padding:10px 12px;border:1px solid rgb(var(--line-strong));border-radius:var(--radius);background:rgb(var(--surface));color:rgb(var(--ink))}
.ask input::placeholder{color:rgb(var(--muted))}
.ask input:focus-visible{outline:2px solid rgb(var(--trail));outline-offset:1px}
.js .tutor .a{clip-path:inset(0 100% 0 0)}
.js .in.tutor .a{animation:revela 1.1s var(--ease-trilha) .4s forwards}
@keyframes revela{to{clip-path:inset(0 0 0 0)}}
.wk{width:100%;height:auto}
.wk .wl{fill:none;stroke:rgb(var(--ink));stroke-width:2}
.wk .wf{fill:none;stroke:rgb(var(--muted));stroke-width:2;stroke-dasharray:.1 7;stroke-linecap:round}
.wk .dp circle{fill:rgb(var(--ink))}
.wk .dp.miss circle{fill:rgb(var(--surface));stroke:rgb(var(--trail));stroke-width:2;stroke-dasharray:3 2}
.wk .dp.today circle{fill:rgb(var(--trail));stroke:rgb(var(--ink));stroke-width:2}
.wk .dp.fut circle{fill:rgb(var(--surface));stroke:rgb(var(--line-strong));stroke-width:1.5}
.wk text{font:500 11px var(--font-mono);fill:rgb(var(--muted));text-anchor:middle}
.js .wk .wl{stroke-dasharray:1;stroke-dashoffset:1}
.js .in .wk .wl{animation:desenha 1.2s var(--ease-trilha) .2s forwards}
.wk .dp.today circle{transform-box:fill-box;transform-origin:center}
.js .in .wk .dp.today circle{animation:respira 2.4s ease-in-out 1.4s infinite}
@keyframes respira{50%{transform:scale(1.25)}}
.load{display:flex;align-items:center;gap:18px}
.ripple{position:relative;width:64px;height:64px}
.ripple svg{position:absolute;inset:0;width:100%;height:100%}
.ripple path{fill:none;stroke:rgb(var(--ink));stroke-width:1.6;vector-effect:non-scaling-stroke;transform-box:fill-box;transform-origin:center}
.ripple circle{fill:rgb(var(--trail))}
.js .ripple path{animation:onda 2.4s var(--ease-subida) infinite;animation-delay:calc(var(--i)*-.8s)}
@keyframes onda{0%{transform:scale(.2);opacity:0}25%{opacity:1}100%{transform:scale(1.05);opacity:0}}
.load b{display:block;font-size:16px}.load small{font:500 11.5px var(--font-mono);color:rgb(var(--muted))}

/* MOVIMENTO */
.mv{width:100%;border-collapse:collapse;margin-top:36px;font-size:14.5px}
.mv th{font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--muted));text-align:left;padding:10px 12px;border-bottom:1.5px solid rgb(var(--ink))}
.mv td{padding:14px 12px;border-bottom:1px solid rgb(var(--line));vertical-align:top;line-height:1.45}
.mv td:first-child{font-weight:600}
.mv code{font:500 12px var(--font-mono);background:rgb(var(--surface-2));padding:2px 6px;border-radius:2px}
.curves{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:20px}
.curve{padding:20px}
.curve .rail{height:36px;border-bottom:1px solid rgb(var(--line));position:relative;margin:14px 0 10px}
.curve .dot{position:absolute;left:0;bottom:-7px;width:14px;height:14px;border-radius:50%;background:rgb(var(--trail))}
.js .curve.in .dot{animation:corre 1.6s infinite alternate}
.curve.c-sub .dot{animation-timing-function:var(--ease-subida)!important}
.curve.c-tri .dot{animation-timing-function:var(--ease-trilha)!important}
.curve.c-der .dot{animation-duration:6s!important;animation-timing-function:ease-in-out!important}
@keyframes corre{to{left:calc(100% - 14px)}}
.curve b{font-size:15px}.curve p{font-size:13.5px;color:rgb(var(--muted));line-height:1.45;margin-top:4px}

/* VOZ */
.voz{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:36px}
.vz{padding:20px 22px}
.vz .from{font:500 11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--muted))}
.vz .to{font:700 22px var(--font-sans);letter-spacing:-.03em;margin:4px 0 8px}
.vz q{display:block;font-size:14.5px;line-height:1.45;quotes:"“" "”"}
.limit{margin-top:20px;padding:18px 22px;border-left:3px solid rgb(var(--trail));background:rgb(var(--surface));font-size:15px;line-height:1.5}

footer{padding:40px 0 60px;border-top:1px solid rgb(var(--line));color:rgb(var(--muted));font-size:13.5px}
footer .wrap{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
footer code{font-family:var(--font-mono);font-size:12.5px}

/* pausar / menos movimento */
.no-motion *,.no-motion *::before,.no-motion *::after{animation-play-state:paused!important}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  .js .rv,.js .hero .wp,.js .mts .mt,.js .prof .fut,.js .prof .pf,.js .prof .pin,.js .prof .pn{opacity:1!important;transform:none!important}
  .js .hero .trailmask,.js .stage .rings path,.js .stage .tmask,.js .prof .past,.js .wk .wl{stroke-dashoffset:0!important}
  .js .stage .sum,.js .elev span{transform:none!important}
  .js .tutor .a{clip-path:none!important}
  .ping{display:none}
}

/* celular */
@media (max-width:860px){
  .wrap{padding:0 16px}
  .top nav{display:none}
  .hero{height:auto;min-height:620px}
  .hero h1{font-size:42px}
  .hero .fade{background:linear-gradient(180deg,rgb(var(--bg)) 55%,rgb(var(--bg)/.2))}
  .hero .meta-ui{display:none}
  .hero .wp:not(.top) text{display:none}
  h2.sec{font-size:32px}
  .logo-grid,.pals,.rules,.voz,.curves{grid-template-columns:1fr}
  .logo-row,.donts{grid-template-columns:1fr 1fr}
  .comp-grid>*{grid-column:span 12}
  .sw-row{grid-template-columns:40px 1fr 70px;}
  .sw-row .use,.sw-row .ctr{display:none}
  .tr-row{grid-template-columns:1fr}
  .t-disp{font-size:44px}.t-tit{font-size:30px}
  .mv{min-width:560px}
  .mv{font-size:13px}
  .ctrls .seg:last-child{display:none}
}
'''

JS = r'''
(function(){
  var html=document.documentElement; html.classList.add('js');
  var KEY='learnia-tema', store=null;
  try{store=window.localStorage}catch(e){}
  function setTheme(t){
    if(t==='system'){html.removeAttribute('data-theme')}else{html.setAttribute('data-theme',t)}
    document.querySelectorAll('[data-theme-btn]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.themeBtn===t))});
    try{store&&store.setItem(KEY,t)}catch(e){}
  }
  var saved=null; try{saved=store&&store.getItem(KEY)}catch(e){}
  var q=new URLSearchParams(location.search).get('tema');
  setTheme(q||saved||'system');
  document.querySelectorAll('[data-theme-btn]').forEach(function(b){b.addEventListener('click',function(){setTheme(b.dataset.themeBtn)})});
  document.querySelectorAll('[data-motion-btn]').forEach(function(b){b.addEventListener('click',function(){
    var off=b.dataset.motionBtn==='off'; html.classList.toggle('no-motion',off);
    document.querySelectorAll('[data-motion-btn]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
  })});
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els=document.querySelectorAll('.rv,.hero,.stage,.anim');
  function countUp(root){
    root.querySelectorAll('[data-to]').forEach(function(t){
      var to=+t.dataset.to; if(reduce){t.textContent=to;return}
      var t0=null; function step(ts){if(!t0)t0=ts; var p=Math.min(1,(ts-t0)/900); t.textContent=Math.round(to*(1-Math.pow(1-p,3))); if(p<1)requestAnimationFrame(step)}
      requestAnimationFrame(step);
    });
  }
  if(reduce||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')})}
  else{
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');countUp(en.target);io.unobserve(en.target)}})},{threshold:.25});
    els.forEach(function(e){io.observe(e)});
  }
  document.querySelectorAll('[data-replay]').forEach(function(b){b.addEventListener('click',function(){
    var t=document.querySelector(b.dataset.replay); t.classList.remove('in'); void t.offsetWidth; t.classList.add('in'); countUp(t);
  })});
})();
'''

RIPPLE = "".join(f'<path style="--i:{i}" d="{RINGS[0]}" />' for i in range(3))

CSS += EX.CSS
JS += (EX.JS.replace('__FALAS__', json.dumps(EX.FALAS, ensure_ascii=False))
        .replace('__QUANDO__', json.dumps({k: q for k, _, q, _ in EX.ESTADOS}, ensure_ascii=False))
        .replace('__NOMES__', json.dumps(EX.NOMES, ensure_ascii=False)))
print('svgs', EX.export(ROOT / 'tutor'))

html = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learnia · Relevo</title>
<link rel="icon" href="data:image/svg+xml,{FAVICON.replace('#', '%23').replace('"', "'")}">
<style>{TOKENS}
{CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
  {wordmark("wm")}
  <nav aria-label="Seções"><a href="#logo">Logo</a><a href="#cores">Cores</a><a href="#tipo">Tipografia</a><a href="#componentes">Componentes</a><a href="#tutor">Tutor</a><a href="#movimento">Movimento</a><a href="#voz">Voz</a></nav>
  <div class="ctrls">
    <div class="seg" role="group" aria-label="Tema"><button data-theme-btn="system" aria-pressed="true">Sistema</button><button data-theme-btn="light" aria-pressed="false">Claro</button><button data-theme-btn="dark" aria-pressed="false">Escuro</button></div>
    <div class="seg" role="group" aria-label="Movimento"><button data-motion-btn="on" aria-pressed="true">Mover</button><button data-motion-btn="off" aria-pressed="false">Pausar</button></div>
  </div>
</div></header>

<section class="hero" id="topo" aria-labelledby="h-hero">
  <div class="map"><svg viewBox="0 0 1600 760" preserveAspectRatio="xMidYMid slice" class="topo" aria-hidden="true">
    {HERO_TOPO}
    <defs><mask id="hm"><path d="{TR_D}" pathLength="1" class="trailmask"/></mask></defs>
    <path d="{TR_D}" class="trailp" mask="url(#hm)"/>
    <circle cx="1176" cy="304" r="11" class="ping"/>
    {WP_SVG}
  </svg></div>
  <div class="fade"></div>
  <div class="wrap"><div class="copy">
    <div class="coord">S 12°58′ · O 38°30′ · SALVADOR, BAHIA</div>
    <h1 id="h-hero">Todo aluno tem um relevo. A Learnia traça a trilha até a meta.</h1>
    <p>Cada interação vira um ponto no mapa. O professor define a cota; a Learnia mostra o caminho mais curto para chegar lá.</p>
    <div class="ctas"><a class="btn btn-pri" href="#componentes">Entrar no demo {ARROW}</a><a class="btn btn-gh" href="#voz">Ver como funciona</a></div>
  </div></div>
  <div class="meta-ui">IDENTIDADE “RELEVO” · v1 · 2026</div>
</section>

<main>
<section class="s" id="logo"><div class="wrap">
  <div class="k">01 · Logo</div><h2 class="sec">Curvas de nível e uma trilha até o cume.</h2>
  <p class="lead">Três anéis são o terreno de uma competência. A trilha pontilhada é o rastro do aluno; o ponto no centro é a cota que o professor definiu. O símbolo se desenha na ordem em que o aprendizado acontece.</p>
  <div class="logo-grid">
    <div class="card stage anim" id="stage"><svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" class="topo" aria-hidden="true">{CARD_TOPO}</svg>
      {mark("mk big", 1.6, anim=True, uid="big")}<button class="replay" data-replay="#stage">Repetir ↺</button></div>
    <div class="lockups"><div class="lk l"><div>{LOGO_H_CLARO}</div><small>Horizontal · claro</small></div><div class="lk d"><div>{LOGO_H_ESCURO}</div><small>Horizontal · escuro</small></div></div>
  </div>
  <div class="logo-row">
    <div class="card lr rv"><div class="t">Ícone do app</div><div class="icons">{APP_ICON}</div><p>Fundo Basalto nos dois modos; a trilha usa o laranja do escuro.</p></div>
    <div class="card lr rv"><div class="t">Favicon</div><div class="favs"><span style="width:16px;height:16px;display:block">{FAVICON}</span><span style="width:32px;height:32px;display:block">{FAVICON}</span><span style="width:48px;height:48px;display:block">{FAVICON}</span></div><p>Versão com dois anéis e traço mais grosso; troca a cor no modo escuro.</p></div>
    <div class="card lr rv"><div class="t">Área de proteção</div><div class="space">{mark("mk")}</div><p>Livre em volta igual ao anel do meio. Símbolo com no mínimo 20 px; horizontal com 96 px.</p></div>
    <div class="card lr rv"><div class="t">Arquivos</div><p><code>design/relevo/logo/</code>: símbolo e horizontal em claro e escuro, versão <code>currentColor</code> para React, ícone e favicon. Texto já convertido em curvas.</p></div>
  </div>
  <div class="donts">{DONTS}</div>
</div></section>

<section class="s" id="cores"><div class="wrap">
  <div class="k">02 · Cores</div><h2 class="sec">Papel de mapa de dia, mapa noturno à noite.</h2>
  <p class="lead">Os mesmos nomes de token nos dois modos: o componente não sabe qual tema está ativo. Contraste medido pela WCAG em cima do fundo.</p>
  <div class="pals">{swatches("claro", PAL_CLARO)}{swatches("escuro", PAL_ESCURO)}</div>
  <div class="rules">
    <div class="card rule rv"><b>Um laranja, uma função</b><p>A Trilha marca o caminho, a meta e o que está abaixo dela. Nunca é decoração nem fundo de seção.</p></div>
    <div class="card rule rv"><b>Status com forma e palavra</b><p>✓ na meta, ◐ você está aqui, ▲ abaixo da meta. A cor reforça; nunca é o único sinal.</p></div>
    <div class="card rule rv"><b>O relevo vem das linhas</b><p>Cantos de 4 px, bordas de 1 px, curvas de nível. Sombra só em camadas que flutuam (menu, aviso).</p></div>
  </div>
</div></section>

<section class="s" id="tipo"><div class="wrap">
  <div class="k">03 · Tipografia</div><h2 class="sec">Geist para ler, Geist Mono para medir.</h2>
  <p class="lead">Uma família só, em dois estilos. Títulos apertados e pesados; dados, rótulos e coordenadas em mono, com números de largura fixa.</p>
  <div class="type">
    <div class="tr-row"><div class="spec">Display · Geist 700<br>66 / 0,98 · −5%</div><div class="t-disp">Superposição</div></div>
    <div class="tr-row"><div class="spec">Título · Geist 700<br>44 / 1,02 · −4,5%</div><div class="t-tit">Seu percurso por competência</div></div>
    <div class="tr-row"><div class="spec">Subtítulo · Geist 700<br>24 / 1,12 · −3%</div><div style="font:700 24px/1.12 var(--font-sans);letter-spacing:-.03em">Continuar Computação Quântica: Superposição</div></div>
    <div class="tr-row"><div class="spec">Texto · Geist 400<br>16 / 1,55</div><div style="font:400 16px/1.55 var(--font-sans);max-width:640px">Um bit clássico guarda um valor de cada vez: 0 ou 1. O qubit, unidade básica da computação quântica, se comporta de outro modo.</div></div>
    <div class="tr-row"><div class="spec">Rótulo e dado · Geist Mono 500<br>12 · +10% · caixa alta</div><div style="font:500 12px var(--font-mono);letter-spacing:.1em;text-transform:uppercase">OA 1.1 · ALT 68 · COTA 70 · 12 MIN</div></div>
  </div>
</div></section>

<section class="s" id="componentes"><div class="wrap">
  <div class="k">04 · Componentes</div><h2 class="sec">As peças do AVA, nos dois modos.</h2>
  <p class="lead">Troque o tema no topo: tudo abaixo usa só tokens. Passe o mouse nos botões e role a página para ver a entrada de cada peça.</p>
  <div class="comp-grid">
    <div class="card cp c7 rv"><div class="lab">Botões</div>
      <div class="btns"><a class="btn btn-pri" href="#componentes">Continuar {ARROW}</a><a class="btn btn-acc" href="#componentes">Ver percurso de reforço {ARROW}</a><a class="btn btn-gh" href="#componentes">Agora não</a><a class="lnk" href="#componentes">Ver as questões</a></div>
      <p style="font-size:13.5px;color:rgb(var(--muted));margin-top:14px">Primário em Basalto (Papel no escuro). Destaque em Trilha, sempre com texto escuro. A seta avança no hover.</p></div>
    <div class="card cp c5 rv"><div class="lab">Status</div><div class="tags"><span class="tag ok">{IC["ok"]}Na meta</span><span class="tag mid">{IC["mid"]}Você está aqui</span><span class="tag low">{IC["low"]}Abaixo da meta · reforço</span></div></div>

    <div class="card cp c5 next rv"><div class="lab">Próximo passo <span>12 min</span></div>
      <h3>Continuar Computação Quântica: Aplicações</h3><p>Seção 3 de 5 · competência Aplicações</p>
      <div class="elev"><span></span></div>
      <div class="nx"><small>faltam 2 pontos até a cota</small><a class="btn btn-pri btn-sm" href="#componentes">Continuar {ARROW}</a></div></div>
    <div class="card cp c7 rv" id="mts"><div class="lab">Domínio por competência <span>atualizado a cada resposta</span></div>{mountains()}</div>

    <div class="card cp c8 rv" id="prof"><div class="lab">Perfil de elevação · Desafios <span>passado e trilha prevista</span></div>{profile()}</div>
    <div class="card cp c4 rv tutor"><div class="lab" style="align-items:center">Tutor Learnia <span class="av" style="width:36px;height:36px">{EX.head("explicando", cls="still")}</span></div>
      <div class="q">Não entendi a parte da combinação de 0 e 1.</div>
      <div class="who">Tutor Learnia</div>
      <p class="a">Pense numa moeda girando no ar: enquanto gira, não é cara nem coroa. O qubit é parecido: até ser medido, guarda uma combinação de 0 e 1.</p>
      <div class="srcs"><a href="#componentes">◆ Texto “Superposição”</a><a href="#componentes">◆ Vídeo 02:14</a></div>
      <div class="ai">Gerado a partir do material validado · revisado pelo professor</div>
      <div class="ask"><input aria-label="Pergunte sobre esta seção" placeholder="Pergunte sobre esta seção"><a class="btn btn-acc btn-sm" href="#componentes" aria-label="Enviar">{ARROW}</a></div></div>

    <div class="card cp c7 rv"><div class="lab">Rastro da semana <span>4 de 7 dias</span></div>{week()}</div>
    <div class="card cp c5 rv"><div class="lab">Carregando</div><div class="load"><div class="ripple"><svg viewBox="0 0 48 48" aria-hidden="true">{RIPPLE}<circle cx="26.5" cy="24" r="3"/></svg></div><div><b>Lendo o seu rastro…</b><small>montando o percurso de reforço</small></div></div></div>
  </div>
</div></section>

{EX.section(CARD_TOPO)}

<section class="s" id="movimento"><div class="wrap">
  <div class="k">06 · Movimento</div><h2 class="sec">Tudo se move como uma trilha sendo percorrida.</h2>
  <p class="lead">Linhas se desenham na direção do progresso, valores sobem a partir da base, o fundo deriva devagar como um mapa. Nada pisca, nada quica sem motivo. Quem pede menos movimento no sistema recebe o estado final.</p>
  <div class="curves">
    <div class="card curve c-sub anim"><b>Subida</b><div class="rail"><span class="dot"></span></div><p><code>--ease-subida</code> · 400 ms. Entrada de cartões, valores, troca de tema.</p></div>
    <div class="card curve c-tri anim"><b>Trilha</b><div class="rail"><span class="dot"></span></div><p><code>--ease-trilha</code> · 1,4 s. Desenho de linhas: trilha, perfil, rastro.</p></div>
    <div class="card curve c-der anim"><b>Deriva</b><div class="rail"><span class="dot"></span></div><p>60 s, vai e volta. Só nas curvas de nível de fundo.</p></div>
  </div>
  <div class="mvw"><table class="mv"><tr><th>O que</th><th>Como se move</th><th>Token</th><th>Quando</th></tr>
    <tr><td>Trilha e perfil</td><td>Desenham da origem até o ponto atual; o futuro aparece depois, pontilhado.</td><td><code>--dur-desenho</code> <code>--ease-trilha</code></td><td>Ao entrar na tela, uma vez</td></tr>
    <tr><td>Montanhas de domínio</td><td>Sobem da base, uma por vez; o número conta até o valor.</td><td><code>--dur-medio</code> <code>--ease-subida</code></td><td>Ao entrar e a cada nova resposta</td></tr>
    <tr><td>Cume e “hoje”</td><td>Pulso lento, como sinal de GPS.</td><td>2,4 s, contínuo</td><td>Só o ponto atual; nunca mais de um por tela</td></tr>
    <tr><td>Carregamento</td><td>Curvas de nível se abrindo a partir do cume.</td><td>2,4 s, contínuo</td><td>Espera acima de 400 ms</td></tr>
    <tr><td>Botões e links</td><td>Seta avança 4 px; fundo escurece levemente.</td><td><code>--dur-rapido</code></td><td>Hover e foco</td></tr>
    <tr><td>Menos movimento</td><td>Sem animação: estado final direto. Botão “Pausar” no produto.</td><td><code>prefers-reduced-motion</code></td><td>Sempre respeitado</td></tr>
  </table></div>
</div></section>

<section class="s" id="voz"><div class="wrap">
  <div class="k">07 · Voz</div><h2 class="sec">A metáfora entra nos microtextos.</h2>
  <p class="lead">O mapa vira linguagem da interface, com moderação: rótulos, avisos e estados. O conteúdo da disciplina e as notas oficiais continuam em linguagem acadêmica.</p>
  <div class="voz">
    <div class="card vz rv"><div class="from">Domínio</div><div class="to">Altitude</div><q>Você está a 68. A cota é 70.</q></div>
    <div class="card vz rv"><div class="from">Meta do professor</div><div class="to">Cota</div><q>Faltam 19 pontos até a cota de Desafios.</q></div>
    <div class="card vz rv"><div class="from">Percurso de reforço</div><div class="to">Trilha</div><q>Montamos uma trilha de 15 min para você chegar lá.</q></div>
    <div class="card vz rv"><div class="from">Revisão agendada</div><div class="to">Marco</div><q>Sexta tem um marco de revisão para não perder altitude.</q></div>
    <div class="card vz rv"><div class="from">Competências da disciplina</div><div class="to">Terreno</div><q>3 morros nesta disciplina; 1 já está na cota.</q></div>
    <div class="card vz rv"><div class="from">Histórico de estudo</div><div class="to">Rastro</div><q>Seu rastro da semana: 4 de 7 dias.</q></div>
  </div>
  <div class="limit">Regra de bolso: no máximo um termo de mapa por frase, e sempre com o número junto. “Faltam 19 pontos até a cota” ajuda; “escale a montanha do saber” atrapalha.</div>
</div></section>
</main>

<footer><div class="wrap"><span>Learnia · identidade “Relevo” · Salvador, Bahia</span><span>Tokens: <code>design/relevo/tokens.css</code> · Tailwind: <code>design/relevo/tailwind.preset.js</code></span></div></footer>
<script>{JS}</script>
</body></html>'''
OUT.write_text(html, encoding="utf-8")
print("ok", OUT, len(html))
