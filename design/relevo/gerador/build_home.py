# Gera Front-End/files/index.html — home page da Learnia (identidade "Relevo"), PT/EN.
# Uso: python -I build_home.py <repo> <fonts/wordmark.json>
import sys, pathlib, json, html as H
import numpy as np, contourpy
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import explorador as EX
sys.stdout.reconfigure(encoding="utf-8")

REPO = pathlib.Path(sys.argv[1])
RELEVO = REPO / "design" / "relevo"
OUT = REPO / "Front-End" / "files" / "index.html"
TOKENS = (RELEVO / "tokens.css").read_text(encoding="utf-8")
FAVICON = (RELEVO / "logo" / "favicon.svg").read_text(encoding="utf-8")
WORD = json.loads(pathlib.Path(sys.argv[2]).read_text())

def T(pt, en, tag="span", attrs=""):
    """Texto bilíngue: PT no HTML (vale sem JS), EN em data-en. Só em elementos-folha."""
    a = f" {attrs}" if attrs else ""
    return f'<{tag}{a} data-en="{H.escape(en, quote=True)}">{pt}</{tag}>'

# ---------- relevo ----------
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
DEMO_TOPO = topo(1200, 420, [(980, 160, 1.0, 220, 150), (160, 380, .45, 200, 120)], n=13, seed=9)

RINGS = ['M6 30 C4 18 14 7 26 7 C38 7 44 16 42 27 C40 38 30 43 20 42 C11 41 7 37 6 30Z',
         'M14 29 C13 21 19 14 27 14 C34 14 37 20 35 26 C33 32 27 35 21 34 C17 33 14.5 32 14 29Z',
         'M22 25.5 C22 21.5 25 19.5 28 20 C31 20.5 31.5 23.5 30 26 C28.5 28.5 23 29 22 25.5Z']
TRAIL = 'M3 46 L10 38 L15 36 L19 30 L26 24.5'

def mark_inner(sw=2.2):
    rings = "".join(f'<path d="{d}"/>' for d in RINGS)
    return f'<g class="rings" stroke-width="{sw}">{rings}</g><path d="{TRAIL}" class="tr"/><circle cx="26.5" cy="24" r="3" class="sum"/>'

def wordmark(cls="wm"):
    y0 = WORD["baseline"] - 80
    return (f'<svg viewBox="0 0 {104 + WORD["width"]:.0f} 86" class="{cls}" role="img" aria-label="Learnia">'
            f'<g transform="scale(1.75)">{mark_inner()}</g>'
            f'<path transform="translate(104 {-y0:.2f})" class="wmt" d="{WORD["d"]}"/></svg>')

ARROW = '<svg viewBox="0 0 20 20" class="arw" aria-hidden="true"><path d="M3 10h13M11 5l5 5-5 5"/></svg>'
IC = {
 "ok":  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
 "mid": '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/></svg>',
 "low": '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l6.5 12h-13z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 6.5v3.5M8 11.6v.4" stroke="currentColor" stroke-width="2"/></svg>',
 "lock": '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
}
SUN = '<svg viewBox="0 0 20 20" aria-hidden="true" class="ic-sun"><circle cx="10" cy="10" r="3.6"/><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7"/></svg>'
MOON = '<svg viewBox="0 0 20 20" aria-hidden="true" class="ic-moon"><path d="M15.5 12.6A6.6 6.6 0 0 1 7.4 4.5 6.6 6.6 0 1 0 15.5 12.6Z"/></svg>'

# ---------- hero: trilha ----------
TR_PTS = [(600, 770), (720, 700), (830, 650), (930, 590), (1000, 525), (1060, 450), (1120, 375), (1170, 310)]
TR_D = "M" + " L".join(f"{x} {y}" for x, y in TR_PTS)
WPS = [(720, 700, "QUIZ · 51", "QUIZ · 51", "w1"), (930, 590, "VÍDEO IA · 4 MIN", "AI VIDEO · 4 MIN", "w2"),
       (1060, 450, "CONVERSA GUIADA", "GUIDED CHAT", "w3"), (1176, 304, "META 70 · ATINGIDA", "GOAL 70 · REACHED", "w4 top")]
WP_SVG = "".join(f'<g class="wp {c}"><circle cx="{x}" cy="{y}" r="{11 if "top" in c else 8}"/>{T(pt, en, "text", f"x=\"{x+20}\" y=\"{y+5}\"")}</g>' for x, y, pt, en, c in WPS)

# ---------- como funciona: 6 passos numa subida ----------
PASSOS = [
  ("Planejamento", "Planning", "O plano de ensino da disciplina é o ponto de partida.", "The course syllabus is the starting point."),
  ("Competências", "Learning outcomes", "Cada competência vira objetivos mensuráveis, com meta definida pelo professor.", "Each learning outcome becomes measurable objectives, with a goal set by the teacher."),
  ("Material rastreável", "Traceable materials", "Cada conteúdo é ligado a uma competência e validado pela instituição.", "Every piece of content is linked to a learning outcome and approved by the institution."),
  ("Consumo multimodal", "Multimodal learning", "Vídeos, podcasts, textos e quizzes, no formato que funciona para cada aluno.", "Videos, podcasts, texts and quizzes, in the format that works for each student."),
  ("Dados de aprendizagem", "Learning data", "O rastro de estudo mostra como cada aluno avança em cada competência.", "The study trail shows how each student progresses in each learning outcome."),
  ("Percurso personalizado", "Personalized path", "Quem atinge a meta avança. Quem fica abaixo recebe reforço com IA, tutor e avatar.", "Students who reach the goal move on. Those below it get AI-powered review with a tutor and an avatar."),
]
def subida():
    w, h = 1136, 150; xs = [round(89 + i * 191.7) for i in range(6)]; ys = [128, 112, 98, 76, 52, 26]
    d = "M0 140 L" + " L".join(f"{x} {y}" for x, y in zip(xs, ys))
    pts = "".join(f'<g class="sp" style="--i:{i}"><circle cx="{x}" cy="{y}" r="{13 if i == 5 else 11}"/><text x="{x}" y="{y+4}">{i+1:02d}</text></g>' for i, (x, y) in enumerate(zip(xs, ys)))
    grid = "".join(f'<line x1="0" x2="{w}" y1="{y}" y2="{y}"/>' for y in range(20, 150, 18))
    return (f'<svg viewBox="0 0 {w} {h}" class="subida" aria-hidden="true"><g class="gr">{grid}</g>'
            f'<line x1="0" x2="{w}" y1="40" y2="40" class="goal"/>'
            f'<path d="{d}" class="sl"/>{pts}</svg>')

# ---------- na prática: montanhas de Maria ----------
def mountains():
    data = [("Funções", "Functions", 38, "low"), ("Geometria", "Geometry", 74, "ok"), ("Estatística", "Statistics", 86, "ok")]
    w, h = 400, 230; base = h - 42; top = 18
    y = lambda v: base - (base - top) * v / 100
    out, defs = "", ""
    for i, (n, ne, v, s) in enumerate(data):
        cx = 72 + i * 128; px = y(v)
        d = f"M{cx-76} {base} C{cx-42} {base} {cx-28} {px:.1f} {cx} {px:.1f} C{cx+28} {px:.1f} {cx+42} {base} {cx+76} {base} Z"
        defs += f'<clipPath id="mc{i}"><path d="{d}"/></clipPath>'
        lines = "".join(f'<line x1="0" x2="{w}" y1="{y(t):.1f}" y2="{y(t):.1f}"/>' for t in range(8, 100, 8))
        out += (f'<g class="mt {s}" style="--i:{i}"><path d="{d}" class="body"/><g clip-path="url(#mc{i})" class="cl">{lines}</g>'
                f'<text x="{cx}" y="{px-10:.1f}" class="pv" data-to="{v}">{v}</text></g>'
                + T(n, ne, "text", f'x="{cx}" y="{h-20}" class="nm"'))
    out += (f'<line x1="8" x2="{w-8}" y1="{y(70):.1f}" y2="{y(70):.1f}" class="goal"/>'
            + T("meta 70", "goal 70", "text", f'x="{w-8}" y="{y(70)-7:.1f}" class="gl"')
            + f'<line x1="0" x2="{w}" y1="{base}" y2="{base}" class="base"/>')
    lab = ('aria-label="Domínio de Maria: Funções 38, Geometria 74, Estatística 86; meta 70" '
           'data-en-label="Maria\'s mastery: Functions 38, Geometry 74, Statistics 86; goal 70"')
    return f'<svg viewBox="0 0 {w} {h}" class="mts" role="img" {lab}><defs>{defs}</defs>{out}</svg>'

SEMANA = [
  ("SEG", "MON", "quiz", "quiz", "low", "Erra 2 de 3 questões sobre funções", "Misses 2 of 3 questions on functions",
   "O domínio da competência fica abaixo da meta.", "Her mastery of the learning outcome drops below the goal."),
  ("SEG", "MON", "convite", "invite", "mid", "A Learnia a convida para um reforço", "Learnia invites her to a review",
   "Um percurso curto, feito para o que ela errou.", "A short path built around what she missed."),
  ("TER", "TUE", "percurso", "path", "mid", "Vídeo gerado com IA, tutor e prática", "AI-generated video, tutor and practice",
   "Explicação complementar, conversa e novas questões.", "An extra explanation, a conversation and new questions."),
  ("SEX", "FRI", "meta", "goal", "ok", "Meta atingida", "Goal reached",
   "Uma revisão é agendada para o conhecimento não se perder.", "A review is scheduled so the knowledge sticks."),
]
def semana():
    out = ""
    for i, (d, de, tg, tge, s, t, te, p, pe) in enumerate(SEMANA):
        out += (f'<li class="dia rv" style="--i:{i}"><div class="dd">{T(d, de)}</div><span class="pt {s}" aria-hidden="true"></span>'
                f'<div><span class="tag {s}">{IC[s if s != "mid" else "mid"]}{T(tg, tge)}</span>'
                f'{T(t, te, "b")}{T(p, pe, "p")}</div></li>')
    return f'<ol class="semana">{out}</ol>'

# ---------- tutor ----------
FALAS = {
  "explicando": ("Pense na função como uma máquina: entra um número, ela aplica uma regra e sai outro. Vamos tentar com f(x) = 2x + 1?",
                 "Think of a function as a machine: a number goes in, it applies a rule, and another comes out. Want to try f(x) = 2x + 1?"),
  "ouvindo": ("Pode falar, estou ouvindo.", "Go ahead, I'm listening."),
  "pensando": ("Deixa eu olhar o seu rastro… Você errou 2 de 3 questões sobre funções.", "Let me check your trail… You missed 2 of 3 questions on functions."),
  "encorajando": ("Faltam 32 pontos até a meta. Montei um reforço curto, só com o que você errou.", "You're 32 points from the goal. I put together a short review with just what you missed."),
  "meta": ("Meta atingida! Funções chegou a 72. A meta do professor era 70.", "Goal reached! Functions is at 72. Your teacher's goal was 70."),
  "revisar": ("Sexta tem uma revisão de 10 minutos para você não perder o que aprendeu.", "There's a 10-minute review on Friday so you keep what you learned."),
}
NOMES_EN = {"explicando": "Explaining", "ouvindo": "Listening", "pensando": "Thinking", "encorajando": "Encouraging", "meta": "Goal reached", "revisar": "Let's review"}
ORDEM = ["explicando", "pensando", "encorajando", "meta", "revisar", "ouvindo"]

ASSIST = [
  ("Tutor da plataforma", "Platform tutor", "Presente em todos os módulos.", "Available in every module.", True),
  ("Personagens da ciência", "Science characters", "Cientistas que conversam sobre a área da disciplina.", "Scientists who talk about the course's field.", True),
  ("O seu professor", "Your teacher", "Avatar do docente, criado com a autorização dele.", "An avatar of the instructor, created with their permission.", False),
  ("Um personagem seu", "A character of your own", "O aluno define aparência, voz e jeito de explicar.", "Students choose the look, the voice and the way it explains.", False),
]
def assistentes():
    out = ""
    for n, ne, d, de, ok in ASSIST:
        st = (f'<span class="tag ok">{IC["ok"]}{T("Disponível", "Available")}</span>' if ok
              else f'<span class="tag mid">{IC["mid"]}{T("Em breve", "Coming soon")}</span>')
        out += f'<li class="card as rv">{st}{T(n, ne, "b")}{T(d, de, "p")}</li>'
    return f'<ul class="assist">{out}</ul>'

# ---------- governança ----------
GOV = [
  ("Consultar", "Look up", "perfil, histórico e recursos do aluno", "the student's profile, history and resources", "ok"),
  ("Montar", "Build", "percursos e agendar revisões, de forma reversível", "paths and schedule reviews, reversibly", "ok"),
  ("Ajustar", "Adjust", "a dificuldade dentro de limites", "difficulty within set limits", "ok"),
  ("Avisar", "Alert", "o professor e enfileirar casos que pedem atenção", "the teacher and queue cases that need attention", "ok"),
  ("Enviar mensagem", "Send a message", "em nome do professor", "on the teacher's behalf", "lock"),
]
def gov():
    out = ""
    for v, ve, d, de, s in GOV:
        badge = (f'<span class="tag low">{IC["lock"]}{T("Só com aprovação", "Approval required")}</span>' if s == "lock"
                 else f'<span class="gk" aria-hidden="true">{IC["ok"]}</span>')
        out += f'<li class="{s}">{badge}<div>{T(v, ve, "b")} {T(d, de)}</div></li>'
    return f'<ul class="gov">{out}</ul>'

# ---------- pesquisa ----------
ANOS = [
  ("2018", "Gamificação e IA em ambientes virtuais de aprendizagem", "Gamification and AI in virtual learning environments"),
  ("2021", "Desafios e um modelo proposto", "Challenges and a proposed model"),
  ("2024–25", "Campus imersivo, estruturas de dados em RV e professores como hologramas", "Immersive campus, data structures in VR and teachers as holograms"),
  ("2025", "Revisão sistemática de agentes de IA e tese de doutorado: modelo de IA para AVAs", "Systematic review of AI agents and a PhD thesis: an AI model for virtual learning environments"),
  ("2026", "Projeto Engage-Agent: 2º lugar no AI for Education, Holanda", "Engage-Agent project: 2nd place at AI for Education, the Netherlands"),
]
def anos():
    out = ""
    for i, (a, pt, en) in enumerate(ANOS):
        last = i == len(ANOS) - 1
        out += f'<li class="ano rv{" top" if last else ""}"><span class="yr">{a}</span><span class="nd" aria-hidden="true"></span>{T(pt, en, "p")}</li>'
    return f'<ol class="anos">{out}</ol>'

# ---------- CSS ----------
CSS = r'''
*{box-sizing:border-box;margin:0;padding:0}
html{background:rgb(var(--bg));color:rgb(var(--ink));font-family:var(--font-sans);-webkit-font-smoothing:antialiased;scroll-behavior:smooth;scroll-padding-top:72px}
body{background:rgb(var(--bg));transition:background-color var(--dur-medio) var(--ease-subida),color var(--dur-medio) var(--ease-subida);overflow-x:hidden}
svg{display:block}
a{color:inherit}
ul,ol{list-style:none}
.wrap{max-width:1200px;margin:0 auto;padding:0 32px}
.k{font:500 12px var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:rgb(var(--trail-text))}
h2.sec{font:700 48px/1.02 var(--font-sans);letter-spacing:-.045em;margin:12px 0 14px;max-width:820px}
.lead{font-size:18px;line-height:1.55;color:rgb(var(--muted));max-width:680px}
section.s{padding:104px 0;border-top:1px solid rgb(var(--line))}
.card{background:rgb(var(--surface));border:1px solid rgb(var(--line));border-radius:var(--radius)}
:focus-visible{outline:2px solid rgb(var(--trail));outline-offset:2px}
.skip{position:absolute;left:-999px;top:8px;z-index:99;background:rgb(var(--ink));color:rgb(var(--on-ink));padding:8px 12px;border-radius:var(--radius)}
.skip:focus{left:8px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* barra superior */
.top{position:sticky;top:0;z-index:20;background:rgb(var(--bg)/.86);backdrop-filter:saturate(1.2) blur(8px);border-bottom:1px solid rgb(var(--line))}
.top .wrap{display:flex;align-items:center;gap:24px;height:64px}
.top .wm{height:28px;width:auto}
.top nav{display:flex;gap:22px;font-size:14px;color:rgb(var(--muted));margin-left:auto}
.top nav a{text-decoration:none}.top nav a:hover{color:rgb(var(--ink))}
.ctrls{display:flex;gap:10px;align-items:center}
.seg{display:inline-flex;border:1px solid rgb(var(--line-strong));border-radius:var(--radius);overflow:hidden}
.seg button{font:500 12px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;padding:7px 9px;background:none;border:0;color:rgb(var(--muted));cursor:pointer}
.seg button[aria-pressed="true"]{background:rgb(var(--ink));color:rgb(var(--on-ink))}
.icbtn{width:34px;height:34px;display:grid;place-items:center;background:none;border:1px solid rgb(var(--line-strong));border-radius:var(--radius);color:rgb(var(--ink));cursor:pointer}
.icbtn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}
.icbtn .ic-moon{fill:currentColor;stroke:none}
.ic-moon{display:none}
:root[data-theme="dark"] .ic-moon{display:block}:root[data-theme="dark"] .ic-sun{display:none}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .ic-moon{display:block}:root:not([data-theme="light"]) .ic-sun{display:none}}
.enter{font-size:14px;font-weight:600;text-decoration:none;padding:8px 4px}
.enter:hover{text-decoration:underline;text-underline-offset:3px}

/* logo */
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
.btn-sm{font-size:14px;padding:8px 13px}
.btn-lg{font-size:17px;padding:15px 22px}

/* tags */
.tag{display:inline-flex;align-items:center;gap:7px;font:500 11.5px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;width:fit-content;padding:4px 8px;border-radius:var(--radius-sm);border:1px solid currentColor}
.tag svg{width:13px;height:13px}
.tag.ok{color:rgb(var(--mata))}.tag.mid{color:rgb(var(--ink));background:rgb(var(--surface-2));border-color:rgb(var(--line-strong))}.tag.low{color:rgb(var(--trail-text))}

/* HERO */
.hero{position:relative;min-height:700px;overflow:hidden;border-bottom:1px solid rgb(var(--line))}
.hero .map{position:absolute;inset:-40px;animation:deriva var(--dur-deriva) ease-in-out infinite alternate}
.hero .map svg{width:100%;height:100%}
.topo path{fill:none;stroke:rgb(var(--contour));stroke-width:1.1;vector-effect:non-scaling-stroke}
.topo path.em{stroke:rgb(var(--contour-em));stroke-width:1.5}
@keyframes deriva{from{transform:translate3d(0,0,0) scale(1.02)}to{transform:translate3d(-34px,16px,0) scale(1.05)}}
.hero .fade{position:absolute;inset:0;background:linear-gradient(90deg,rgb(var(--bg)) 34%,rgb(var(--bg)/0) 68%);pointer-events:none}
.topo .trailp{fill:none;stroke:rgb(var(--trail));stroke-width:3.2;stroke-dasharray:.1 11;stroke-linecap:round;vector-effect:non-scaling-stroke}
.topo .trailmask{fill:none;stroke:#fff;stroke-width:40;stroke-dasharray:1;stroke-dashoffset:0}
.wp circle{fill:rgb(var(--surface));stroke:rgb(var(--ink));stroke-width:2.4}
.wp.top circle{fill:rgb(var(--trail))}
.wp text{font:600 14px var(--font-mono);letter-spacing:.06em;fill:rgb(var(--ink));paint-order:stroke;stroke:rgb(var(--bg));stroke-width:6px;stroke-linejoin:round}
.ping{fill:none;stroke:rgb(var(--trail));stroke-width:2;transform-box:fill-box;transform-origin:center;opacity:0}
.hero .copy{position:relative;z-index:2;padding:112px 0 96px;max-width:660px}
.award{display:inline-flex;align-items:center;gap:10px;font:500 12px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--ink));border:1px solid rgb(var(--line-strong));background:rgb(var(--surface)/.8);border-radius:var(--radius-sm);padding:6px 10px;margin-bottom:22px}
.award i{width:8px;height:8px;border-radius:50%;background:rgb(var(--trail));display:block}
.hero h1{font:700 68px/.98 var(--font-sans);letter-spacing:-.05em}
.hero p.sub{font-size:19px;line-height:1.5;color:rgb(var(--muted));margin:24px 0 32px;max-width:560px}
.ctas{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.chips{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:26px;font-size:14px;color:rgb(var(--muted))}
.chips li{display:flex;align-items:center;gap:7px}
.chips svg{width:15px;height:15px;color:rgb(var(--mata))}
.hero .pause{position:absolute;right:24px;bottom:20px;z-index:3;font:500 11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;background:rgb(var(--surface));color:rgb(var(--ink));border:1px solid rgb(var(--line-strong));border-radius:var(--radius);padding:6px 9px;cursor:pointer}

.js .hero .trailmask{stroke-dashoffset:1}
.js .hero.in .trailmask{animation:desenha 2.4s var(--ease-trilha) .3s forwards}
.js .hero .wp{opacity:0;transform:translateY(6px);transform-box:fill-box}
.js .hero.in .wp{animation:surge .5s var(--ease-subida) forwards}
.js .hero.in .w1{animation-delay:.7s}.js .hero.in .w2{animation-delay:1.3s}.js .hero.in .w3{animation-delay:1.9s}.js .hero.in .w4{animation-delay:2.5s}
.js .hero.in .ping{animation:ping 2.4s var(--ease-subida) 2.9s infinite}
@keyframes desenha{to{stroke-dashoffset:0}}
@keyframes surge{to{opacity:1;transform:none}}
@keyframes ping{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}
.js .rv{opacity:0;transform:translateY(14px)}
.js .rv.in{opacity:1;transform:none;transition:opacity var(--dur-medio) var(--ease-subida),transform var(--dur-medio) var(--ease-subida);transition-delay:calc(var(--i,0)*90ms)}

/* DESAFIO */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:44px}
.st{padding:26px 26px 22px;display:flex;flex-direction:column;gap:10px}
.st .n{font:700 64px/1 var(--font-sans);letter-spacing:-.05em;display:flex;align-items:center;gap:12px}
.st .n .arw{width:30px;height:30px;fill:none;stroke:rgb(var(--trail));stroke-width:2.4}
.st .n .lo{color:rgb(var(--trail-text))}
.st p{font-size:15.5px;line-height:1.45}
.st small{font:500 11px var(--font-mono);letter-spacing:.04em;color:rgb(var(--muted));margin-top:auto;padding-top:12px;border-top:1px solid rgb(var(--line))}
.quote{margin-top:20px;padding:22px 26px;border-left:3px solid rgb(var(--trail));background:rgb(var(--surface));font-size:19px;line-height:1.5;letter-spacing:-.01em;max-width:900px}
.quote em{font-style:normal;color:rgb(var(--trail-text));font-weight:600}
.quote strong{font-weight:700}

/* COMO FUNCIONA */
.subida{width:100%;height:auto;margin-top:40px;overflow:visible}
.subida .gr line{stroke:rgb(var(--contour));stroke-width:1}
.subida .goal{stroke:rgb(var(--trail));stroke-width:1.4;stroke-dasharray:6 5}
.subida .sl{fill:none;stroke:rgb(var(--ink));stroke-width:2.2;stroke-dasharray:.1 8;stroke-linecap:round}
.subida .sp circle{fill:rgb(var(--surface));stroke:rgb(var(--ink));stroke-width:2}
.subida .sp:last-child circle{fill:rgb(var(--trail))}
.subida .sp text{font:600 11px var(--font-mono);fill:rgb(var(--ink));text-anchor:middle}
.js .subida .sp{opacity:0}
.js .in .subida .sp{animation:surge .45s var(--ease-subida) forwards;animation-delay:calc(var(--i)*.18s + .2s)}
.passos{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:10px}
.passo{padding:18px 16px 20px}
.passo .num{font:500 11px var(--font-mono);letter-spacing:.1em;color:rgb(var(--trail-text))}
.passo b{display:block;font-size:16.5px;letter-spacing:-.02em;margin:8px 0 6px}
.passo p{font-size:14px;line-height:1.5;color:rgb(var(--muted))}

/* NA PRÁTICA */
.pratica{display:grid;grid-template-columns:1.05fr 1fr;gap:20px;margin-top:44px;align-items:start}
.semana{position:relative;display:flex;flex-direction:column}
.semana::before{content:"";position:absolute;left:61px;top:20px;bottom:30px;border-left:2px dotted rgb(var(--ink)/.55)}
.dia{display:grid;grid-template-columns:44px 36px 1fr;align-items:start;padding:14px 0}
.dd{font:600 12px var(--font-mono);letter-spacing:.08em;color:rgb(var(--muted));padding-top:4px}
.dia .pt{width:14px;height:14px;border-radius:50%;margin:5px 0 0 11px;background:rgb(var(--surface));border:2px solid rgb(var(--ink));position:relative;z-index:1}
.dia .pt.low{border-color:rgb(var(--trail));border-style:dashed}
.dia .pt.ok{background:rgb(var(--trail));border-color:rgb(var(--ink))}
.dia b{display:block;font-size:17px;letter-spacing:-.02em;margin:8px 0 3px}
.dia p{font-size:14.5px;line-height:1.45;color:rgb(var(--muted))}
.prof-note{margin-top:14px;padding:16px 18px;background:rgb(var(--surface));border:1px solid rgb(var(--line-strong));border-radius:var(--radius);font-size:14.5px;line-height:1.5;display:grid;grid-template-columns:22px 1fr;gap:10px}
.prof-note svg{width:18px;height:18px;color:rgb(var(--trail-text));margin-top:2px}
.painel{padding:22px 24px}
.painel .lab{font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));display:flex;justify-content:space-between;gap:10px;margin-bottom:12px}
.painel .lab span{color:rgb(var(--muted))}
.who{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.who .ini{width:34px;height:34px;border-radius:50%;background:rgb(var(--surface-2));border:1px solid rgb(var(--line-strong));display:grid;place-items:center;font-weight:700;font-size:14px}
.who b{font-size:15px}.who small{display:block;font-size:12.5px;color:rgb(var(--muted))}
.mts{width:100%;height:auto}
.mts .body{fill:rgb(var(--surface-2));stroke:rgb(var(--ink));stroke-width:1.6}
.mts .cl line{stroke:rgb(var(--contour-em))}
.mts .low .cl line{stroke:rgb(var(--trail));opacity:.6}
.mts .pv{font:700 16px var(--font-sans);fill:rgb(var(--ink));text-anchor:middle}
.mts .low .pv{fill:rgb(var(--trail-text))}
.mts .nm{font:500 11.5px var(--font-mono);fill:rgb(var(--muted));text-anchor:middle}
.mts .goal{stroke:rgb(var(--trail));stroke-width:1.6;stroke-dasharray:6 5}
.mts .gl{font:500 11px var(--font-mono);fill:rgb(var(--trail-text));text-anchor:end}
.mts .base{stroke:rgb(var(--ink));stroke-width:1.6}
.js .mt .body,.js .mt .cl,.js .mt .pv{transform-box:fill-box;transform-origin:50% 100%}
.js .mts .mt{opacity:0}
.js .in .mts .mt{opacity:1;animation:sobe .9s var(--ease-subida) both;animation-delay:calc(var(--i)*.15s)}
@keyframes sobe{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.chatlet{margin-top:16px;padding-top:16px;border-top:1px solid rgb(var(--line));display:grid;grid-template-columns:44px 1fr;gap:12px}
.av{display:inline-block;border-radius:50%;background:rgb(var(--surface-2));border:1px solid rgb(var(--line));overflow:hidden;flex:none}
.chatlet .av{width:44px;height:44px}
.chatlet .nm2{font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));margin-bottom:5px}
.chatlet p{font-size:14.5px;line-height:1.5;border-left:2px solid rgb(var(--trail));padding-left:11px}
.src{display:inline-block;margin-top:9px;font:500 11px var(--font-mono);letter-spacing:.03em;padding:4px 8px;border:1px solid rgb(var(--line-strong));border-radius:var(--radius-sm);color:rgb(var(--muted))}
.hip{font:500 11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--muted))}

/* TUTOR */
.tut{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:44px}
.stage{padding:24px;display:flex;flex-direction:column;align-items:center;gap:18px;position:relative;overflow:hidden}
.stage .topo{position:absolute;inset:0;width:100%;height:100%;opacity:.55}
.xp-big{position:relative;width:280px;height:280px}
.xp-seg{position:relative;display:grid;grid-template-columns:repeat(3,1fr)}
.xp-seg button{border-top:1px solid rgb(var(--line-strong))}
.xp-seg button:nth-child(-n+3){border-top:0}
.bubble{position:relative;width:100%;background:rgb(var(--surface));border:1px solid rgb(var(--line-strong));border-radius:var(--radius);padding:14px 16px;min-height:96px}
.bubble b{display:block;font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));margin-bottom:6px}
.bubble p{font-size:16.5px;line-height:1.5}
.side{display:flex;flex-direction:column;gap:20px}
.assist{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.as{padding:18px 18px 20px;display:flex;flex-direction:column;gap:8px}
.as b{font-size:16px;letter-spacing:-.02em;margin-top:4px}
.as p{font-size:14px;line-height:1.45;color:rgb(var(--muted))}
.feats{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;padding:18px 20px}
.feats li{display:flex;align-items:center;gap:9px;font-size:14.5px}
.feats svg{width:15px;height:15px;color:rgb(var(--mata));flex:none}

/* GOVERNANÇA */
.govg{display:grid;grid-template-columns:.9fr 1.1fr;gap:20px;margin-top:44px;align-items:start}
.audit{padding:26px;position:relative;overflow:hidden}
.audit b{display:block;font-size:20px;letter-spacing:-.02em;margin:14px 0 6px}
.audit p{font-size:15px;line-height:1.5;color:rgb(var(--muted))}
.log{margin-top:18px;font:500 12px/1.9 var(--font-mono);color:rgb(var(--muted));border-top:1px solid rgb(var(--line));padding-top:12px}
.log li{display:flex;gap:10px}.log li span:first-child{color:rgb(var(--ink));min-width:76px}
.gov{display:flex;flex-direction:column}
.gov li{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:16px 4px;border-top:1px solid rgb(var(--line));font-size:16px;line-height:1.45}
.gov li:first-child{border-top:0}
.gov .gk{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;border:1.5px solid rgb(var(--mata));color:rgb(var(--mata))}
.gov .gk svg{width:14px;height:14px}
.gov b{font-weight:700}
.gov li.lock{grid-template-columns:1fr;gap:8px;background:rgb(var(--surface));border:1px solid rgb(var(--line-strong));border-radius:var(--radius);padding:16px 18px;margin-top:8px}

/* PESQUISA */
.pesq{display:grid;grid-template-columns:.8fr 1.2fr;gap:40px;margin-top:44px;align-items:start}
.inst{display:flex;flex-direction:column;gap:10px}
.inst li{font:700 22px var(--font-sans);letter-spacing:-.03em;padding:14px 0;border-top:1px solid rgb(var(--line))}
.inst li small{display:block;font:500 11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--muted));margin-top:4px}
.anos{position:relative}
.anos::before{content:"";position:absolute;left:96px;top:14px;bottom:14px;border-left:2px dotted rgb(var(--ink)/.55)}
.ano{display:grid;grid-template-columns:82px 30px 1fr;align-items:start;padding:12px 0}
.yr{font:600 13px var(--font-mono);letter-spacing:.04em;padding-top:2px}
.nd{width:12px;height:12px;border-radius:50%;background:rgb(var(--surface));border:2px solid rgb(var(--ink));margin:4px 0 0 9px;position:relative;z-index:1}
.ano.top .nd{width:16px;height:16px;margin:2px 0 0 7px;background:rgb(var(--trail))}
.ano p{font-size:16px;line-height:1.45}
.ano.top p{font-weight:700}

/* DEMO */
.demo{position:relative;overflow:hidden;padding:56px 48px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.demo .topo{position:absolute;inset:0;width:100%;height:100%;opacity:.7}
.demo>*{position:relative}
.demo h2.sec{font-size:44px}
.demo .note{font-size:14px;color:rgb(var(--muted));margin-top:12px}
.dsteps{display:flex;flex-direction:column;gap:2px;counter-reset:d}
.dsteps li{display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:start;background:rgb(var(--surface)/.92);border:1px solid rgb(var(--line));border-radius:var(--radius);padding:14px 16px;font-size:15px;line-height:1.45}
.dsteps li::before{counter-increment:d;content:counter(d);width:26px;height:26px;border-radius:50%;border:1.5px solid rgb(var(--ink));display:grid;place-items:center;font:600 12px var(--font-mono)}
.dsteps li:last-child::before{background:rgb(var(--trail));border-color:rgb(var(--ink))}
.dsteps strong{font-weight:700}

footer{padding:44px 0 64px;border-top:1px solid rgb(var(--line));color:rgb(var(--muted));font-size:14px;margin-top:104px}
footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
footer .wm{height:24px;width:auto}
footer nav{display:flex;gap:20px;flex-wrap:wrap}
footer a{text-decoration:none}footer a:hover{color:rgb(var(--ink));text-decoration:underline;text-underline-offset:3px}

/* pausar / menos movimento */
.no-motion *,.no-motion *::before,.no-motion *::after{animation-play-state:paused!important}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation:none!important;transition:none!important}
  .js .rv,.js .hero .wp,.js .mts .mt,.js .subida .sp{opacity:1!important;transform:none!important}
  .js .hero .trailmask{stroke-dashoffset:0!important}
  .ping,.hero .pause{display:none}
}

/* tablet e celular */
@media (max-width:1060px){
  .top nav{display:none}
  .passos{grid-template-columns:repeat(3,1fr)}
  .subida{display:none}
}
@media (max-width:860px){
  .wrap{padding:0 16px}
  .top .wrap{gap:10px}
  .top .wm{height:24px}
  .ctrls{margin-left:auto;gap:8px}
  .enter{display:none}
  .hero{min-height:0}
  .hero .copy{padding:56px 0 230px}
  .hero h1{font-size:42px}
  .hero p.sub{font-size:17px}
  .hero .fade{background:linear-gradient(180deg,rgb(var(--bg)) 52%,rgb(var(--bg)/.15))}
  .hero .wp:not(.top) text{display:none}
  .hero .map{inset:auto;left:-500px;bottom:-40px;width:900px;height:430px}
  h2.sec,.demo h2.sec{font-size:32px}
  .lead{font-size:16.5px}
  section.s{padding:72px 0}
  .stats,.pratica,.tut,.govg,.pesq,.demo,.assist,.feats{grid-template-columns:1fr}
  .passos{grid-template-columns:1fr 1fr}
  .st .n{font-size:52px}
  .demo{padding:32px 20px}
  .xp-big{width:220px;height:220px}
  .anos::before{left:82px}
  .ano{grid-template-columns:68px 30px 1fr}
  footer{margin-top:72px}
}
@media (max-width:420px){
  .passos{grid-template-columns:1fr}
  .btn-sm{padding:8px 10px}
}
'''

JS = r'''
(function(){
  var html=document.documentElement; html.classList.add('js');
  var store=null; try{store=window.localStorage}catch(e){}
  function get(k){try{return store&&store.getItem(k)}catch(e){return null}}
  function put(k,v){try{store&&store.setItem(k,v)}catch(e){}}
  var qs=new URLSearchParams(location.search);

  /* tema: sistema por padrão; o botão alterna claro/escuro e fica lembrado */
  var TK='learnia-tema';
  function isDark(){var t=html.getAttribute('data-theme'); if(t)return t==='dark'; return window.matchMedia('(prefers-color-scheme: dark)').matches}
  function setTheme(t){ if(t==='system'||!t){html.removeAttribute('data-theme')}else{html.setAttribute('data-theme',t)} syncThemeBtn() }
  function syncThemeBtn(){ var b=document.getElementById('theme-btn'); if(!b)return; var d=isDark();
    b.setAttribute('aria-label', LANG==='en' ? (d?'Switch to light mode':'Switch to dark mode') : (d?'Mudar para o modo claro':'Mudar para o modo escuro')) }

  /* idioma: ?lang=, depois o salvo (mesma chave do app), depois o do navegador */
  var LK='edubot.lang', LANG='pt';
  var META={pt:{title:__TITLE_PT__,desc:__DESC_PT__},en:{title:__TITLE_EN__,desc:__DESC_EN__}};
  function setLang(l, save){
    LANG=l;
    document.querySelectorAll('[data-en]').forEach(function(el){
      if(el.__pt===undefined) el.__pt=el.innerHTML;
      el.innerHTML = l==='en' ? el.getAttribute('data-en') : el.__pt;
    });
    document.querySelectorAll('[data-en-label]').forEach(function(el){
      if(el.__ptl===undefined) el.__ptl=el.getAttribute('aria-label');
      el.setAttribute('aria-label', l==='en' ? el.getAttribute('data-en-label') : el.__ptl);
    });
    html.lang = l==='en' ? 'en' : 'pt-BR';
    document.title = META[l].title;
    var md=document.querySelector('meta[name="description"]'); if(md) md.setAttribute('content', META[l].desc);
    document.querySelectorAll('[data-app]').forEach(function(a){
      a.setAttribute('href', './app/?' + (a.getAttribute('data-app')==='demo' ? 'demo=1&' : '') + 'lang=' + l + '#/');
    });
    document.querySelectorAll('[data-lang-btn]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-lang-btn')===l)) });
    if(save) put(LK,l);
    syncThemeBtn(); renderXp();
  }

  /* Explorador */
  var XP=__XP__, ORDEM=__ORDEM__, cur='explicando', auto=null, userPicked=false;
  function renderXp(){
    var svg=document.querySelector('#xp-big svg'); if(!svg) return;
    svg.setAttribute('data-expr',cur);
    var x=XP[cur];
    svg.setAttribute('aria-label', (LANG==='en'?'Explorer tutor: ':'Tutor Explorador: ') + (LANG==='en'?x.nen:x.npt).toLowerCase());
    document.getElementById('xp-nome').textContent = LANG==='en'?x.nen:x.npt;
    document.getElementById('xp-fala').textContent = LANG==='en'?x.en:x.pt;
    document.querySelectorAll('[data-xp]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-xp')===cur)) });
  }
  function pick(e){ cur=e; var svg=document.querySelector('#xp-big svg'); if(svg){ var c=svg.cloneNode(true); svg.parentNode.replaceChild(c,svg) } renderXp() }
  document.querySelectorAll('[data-xp]').forEach(function(b){ b.addEventListener('click',function(){ userPicked=true; if(auto){clearInterval(auto);auto=null} pick(b.getAttribute('data-xp')) }) });

  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function moving(){ return !reduce && !html.classList.contains('no-motion') }
  function startAuto(){ if(userPicked||auto||!moving()) return; auto=setInterval(function(){ if(!moving()) return; var i=ORDEM.indexOf(cur); pick(ORDEM[(i+1)%ORDEM.length]) }, 5200) }

  /* pausar o movimento (WCAG 2.2.2) */
  var pb=document.getElementById('pause-btn');
  if(pb) pb.addEventListener('click',function(){
    var off=!html.classList.contains('no-motion'); html.classList.toggle('no-motion',off);
    pb.setAttribute('aria-pressed',String(off));
    if(off&&auto){clearInterval(auto);auto=null} if(!off) startAuto();
  });

  document.querySelectorAll('[data-lang-btn]').forEach(function(b){ b.addEventListener('click',function(){ setLang(b.getAttribute('data-lang-btn'), true) }) });
  var tb=document.getElementById('theme-btn');
  if(tb) tb.addEventListener('click',function(){ var t=isDark()?'light':'dark'; setTheme(t); put(TK,t) });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncThemeBtn);

  var ql=qs.get('lang'), sl=get(LK);
  var nav=(navigator.language||'pt').toLowerCase();
  var lang = (ql==='en'||ql==='pt') ? ql : (sl==='en'||sl==='pt') ? sl : (nav.indexOf('pt')===0 ? 'pt' : 'en');
  setTheme(qs.get('tema')||get(TK)||'system');
  setLang(lang, ql==='en'||ql==='pt');

  /* revelar ao rolar + contagem */
  var els=document.querySelectorAll('.rv,.hero,.anim');
  function countUp(root){
    root.querySelectorAll('[data-to]').forEach(function(t){
      var to=+t.getAttribute('data-to'); if(reduce){t.textContent=to;return}
      var t0=null; function step(ts){if(!t0)t0=ts; var p=Math.min(1,(ts-t0)/900); t.textContent=Math.round(to*(1-Math.pow(1-p,3))); if(p<1)requestAnimationFrame(step)}
      requestAnimationFrame(step);
    });
  }
  if(reduce||!('IntersectionObserver' in window)){ els.forEach(function(e){e.classList.add('in')}) }
  else{
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');countUp(en.target);io.unobserve(en.target); if(en.target.id==='tutor-stage') startAuto()}})},{threshold:.2});
    els.forEach(function(e){io.observe(e)});
  }
})();
'''

XP_DATA = {k: {"pt": FALAS[k][0], "en": FALAS[k][1], "npt": EX.NOMES[k], "nen": NOMES_EN[k]} for k in ORDEM}
TITLE_PT = "Learnia · Cada aluno no seu caminho até a meta"
TITLE_EN = "Learnia · Every student on their own path to the goal"
DESC_PT = ("A Learnia acompanha como cada aluno estuda, mede o domínio por competência e monta reforço com IA "
           "até a meta definida pelo professor. Pesquisa do SENAI CIMATEC.")
DESC_EN = ("Learnia follows how each student studies, measures mastery by learning outcome and builds AI-powered review "
           "up to the goal the teacher sets. Research by SENAI CIMATEC.")
JS = (JS.replace("__XP__", json.dumps(XP_DATA, ensure_ascii=False)).replace("__ORDEM__", json.dumps(ORDEM))
        .replace("__TITLE_PT__", json.dumps(TITLE_PT, ensure_ascii=False)).replace("__TITLE_EN__", json.dumps(TITLE_EN))
        .replace("__DESC_PT__", json.dumps(DESC_PT, ensure_ascii=False)).replace("__DESC_EN__", json.dumps(DESC_EN)))

XP_CSS = EX.CSS.split("/* seção do tutor */")[0]   # só o personagem; o layout é desta página
CSS += XP_CSS

xp_btns = "".join(f'<button type="button" data-xp="{k}" aria-pressed="{str(k == "explicando").lower()}">{T(EX.NOMES[k], NOMES_EN[k])}</button>' for k in ORDEM)
CHECK = IC["ok"]

page = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{TITLE_PT}</title>
<meta name="description" content="{H.escape(DESC_PT)}">
<meta property="og:title" content="Learnia">
<meta property="og:description" content="{H.escape(DESC_PT)}">
<meta name="theme-color" content="#F1EEE4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1013" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,{FAVICON.replace('#', '%23').replace('"', "'")}">
<!-- Gerado a partir da identidade "Relevo" (design/relevo/). Página única, sem build:
     PT no HTML, EN em data-en (o JS troca). O botão Demo leva a ./app/?demo=1. -->
<style>{TOKENS}
{CSS}</style>
</head>
<body>
<a class="skip" href="#conteudo">{T("Pular para o conteúdo", "Skip to content")}</a>
<header class="top"><div class="wrap">
  <a href="#topo" aria-label="Learnia" data-en-label="Learnia">{wordmark("wm")}</a>
  <nav aria-label="Seções" data-en-label="Sections">
    <a href="#como-funciona">{T("Como funciona", "How it works")}</a>
    <a href="#na-pratica">{T("Na prática", "In practice")}</a>
    <a href="#tutor">{T("Tutor", "Tutor")}</a>
    <a href="#governanca">{T("Professor no controle", "Teacher in control")}</a>
    <a href="#pesquisa">{T("Pesquisa", "Research")}</a>
  </nav>
  <div class="ctrls">
    <div class="seg" role="group" aria-label="Idioma" data-en-label="Language"><button type="button" data-lang-btn="pt" aria-pressed="true" lang="pt-BR">PT</button><button type="button" data-lang-btn="en" aria-pressed="false" lang="en">EN</button></div>
    <button type="button" class="icbtn" id="theme-btn" aria-label="Mudar para o modo escuro">{SUN}{MOON}</button>
    <a class="enter" href="./app/" data-app="login">{T("Entrar", "Sign in")}</a>
    <a class="btn btn-acc btn-sm" href="./app/?demo=1#/" data-app="demo">Demo {ARROW}</a>
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
    <div class="award"><i aria-hidden="true"></i>{T("2º lugar · AI for Education 2026 · Holanda", "2nd place · AI for Education 2026 · the Netherlands")}</div>
    <h1 id="h-hero">{T("Todo aluno tem um relevo. A Learnia traça a trilha até a meta.", "Every student has their own terrain. Learnia maps the trail to the goal.")}</h1>
    {T("A Learnia acompanha como cada aluno estuda e ajusta o percurso às metas da disciplina, com IA generativa, tutor e o professor no controle.",
       "Learnia follows how each student studies and adjusts their path to the course goals, with generative AI, a tutor and the teacher in control.", "p", 'class="sub"')}
    <div class="ctas">
      <a class="btn btn-acc btn-lg" href="./app/?demo=1#/" data-app="demo">{T("Experimentar o demo", "Try the demo")} {ARROW}</a>
      <a class="btn btn-gh btn-lg" href="#como-funciona">{T("Ver como funciona", "See how it works")}</a>
    </div>
    <ul class="chips">
      <li>{CHECK}{T("Sem cadastro", "No sign-up")}</li>
      <li>{CHECK}{T("Turma de exemplo só sua", "A sample class of your own")}</li>
      <li>{CHECK}{T("Visão de professor e de aluno", "Teacher and student views")}</li>
    </ul>
  </div></div>
  <button type="button" class="pause" id="pause-btn" aria-pressed="false">{T("Pausar animação", "Pause animation")}</button>
</section>

<main id="conteudo">
<section class="s" id="desafio" aria-labelledby="h-desafio"><div class="wrap">
  <div class="k">{T("O desafio", "The challenge")}</div>
  <h2 class="sec" id="h-desafio">{T("Alunos se desengajam. Professores se esgotam.", "Students disengage. Teachers burn out.")}</h2>
  {T("O ensino superior perde alunos e professores ao mesmo tempo, e as ferramentas atuais não ajudam nenhum dos dois.",
     "Higher education is losing students and teachers at the same time, and today's tools help neither.", "p", 'class="lead"')}
  <div class="stats">
    <div class="card st rv" style="--i:0"><div class="n">32%</div>{T("dos estudantes de bacharelado abandonam o ensino superior sem se formar.", "of bachelor's students leave higher education without graduating.", "p")}<small>OCDE · Education at a Glance 2022</small></div>
    <div class="card st rv" style="--i:1"><div class="n">64%</div>{T("dos professores do ensino superior relatam esgotamento profissional.", "of higher-education faculty report burnout.", "p")}<small>Healthy Minds 2022–23 · {T("EUA", "US")}</small></div>
    <div class="card st rv" style="--i:2"><div class="n">50%{ARROW}<span class="lo">14%</span></div>{T("de alunos engajados: do fundamental II até o ensino superior.", "of students engaged: from middle school to college.", "p")}<small>Gallup Student Poll · Gallup-Lumina</small></div>
  </div>
  {T("Chatbots genéricos respondem a tudo, mas <em>fora do curso</em>, sem o material da disciplina e sem o professor. A Learnia parte do <strong>conteúdo validado pela instituição</strong>.",
     "Generic chatbots answer anything, but <em>outside the course</em>, without the course materials and without the teacher. Learnia starts from <strong>content approved by the institution</strong>.", "p", 'class="quote rv"')}
</div></section>

<section class="s" id="como-funciona" aria-labelledby="h-como"><div class="wrap anim">
  <div class="k">{T("Como funciona", "How it works")}</div>
  <h2 class="sec" id="h-como">{T("Do plano de ensino ao percurso de cada aluno, em 6 passos.", "From the syllabus to each student's path, in 6 steps.")}</h2>
  {subida()}
  <ol class="passos">{"".join(f'<li class="card passo rv" style="--i:{i}"><div class="num">{i+1:02d}</div>{T(a, ae, "b")}{T(d, de, "p")}</li>' for i, (a, ae, d, de) in enumerate(PASSOS))}</ol>
</div></section>

<section class="s" id="na-pratica" aria-labelledby="h-pratica"><div class="wrap">
  <div class="k">{T("Na prática", "In practice")} <span class="hip">· {T("cenário hipotético", "hypothetical scenario")}</span></div>
  <h2 class="sec" id="h-pratica">{T("A semana de Maria estudando matemática.", "Maria's week studying math.")}</h2>
  <div class="pratica">
    <div>
      {semana()}
      <div class="prof-note rv">{IC["low"]}{T("Se Maria ficasse em silêncio, o professor a veria sinalizada, com os motivos. Qualquer mensagem em nome dele aguarda a sua aprovação.",
        "If Maria went quiet, her teacher would see her flagged, with the reasons. Any message sent on the teacher's behalf waits for their approval.")}</div>
    </div>
    <div class="card painel anim">
      <div class="lab">{T("Domínio por competência", "Mastery by learning outcome")}<span>{T("segunda-feira", "Monday")}</span></div>
      <div class="who"><span class="ini" aria-hidden="true">M</span><div><b>Maria</b><small>{T("Matemática", "Math")}</small></div></div>
      {mountains()}
      <div class="legend"><span class="tag low">{IC["low"]}{T("Funções · abaixo da meta", "Functions · below goal")}</span><span class="tag ok">{IC["ok"]}{T("Estatística · na meta", "Statistics · goal met")}</span></div>
      <div class="chatlet">
        <span class="av">{EX.head("explicando", label=False)}</span>
        <div><div class="nm2">{T("Tutor · agora", "Tutor · now")}</div>
          {T(FALAS["explicando"][0], FALAS["explicando"][1], "p")}
          {T("Fonte: vídeo “O que é uma função” · OA 1.1", "Source: video “What is a function” · LO 1.1", "span", 'class="src"')}</div>
      </div>
    </div>
  </div>
</div></section>

<section class="s" id="tutor" aria-labelledby="h-tutor"><div class="wrap">
  <div class="k">{T("Tutor virtual", "Virtual tutor")}</div>
  <h2 class="sec" id="h-tutor">{T("Um tutor que conhece a sua disciplina.", "A tutor that knows your course.")}</h2>
  {T("Por texto ou voz, a qualquer hora. As respostas vêm do material validado, mostram de onde saiu cada explicação e alimentam o percurso do aluno.",
     "By text or voice, anytime. Answers come from approved materials, show where each explanation came from and feed into the student's path.", "p", 'class="lead"')}
  <div class="tut">
    <div class="card stage anim" id="tutor-stage">
      <svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" class="topo" aria-hidden="true">{CARD_TOPO}</svg>
      <div class="xp-big" id="xp-big">{EX.bust("explicando")}</div>
      <div class="bubble" aria-live="polite"><b id="xp-nome">Explicando</b><p id="xp-fala">{FALAS["explicando"][0]}</p></div>
      <div class="seg xp-seg" role="group" aria-label="Estados do tutor" data-en-label="Tutor states">{xp_btns}</div>
    </div>
    <div class="side">
      {assistentes()}
      <ul class="card feats rv">
        <li>{CHECK}{T("Texto e voz", "Text and voice")}</li>
        <li>{CHECK}{T("Cita a fonte de cada resposta", "Cites the source of every answer")}</li>
        <li>{CHECK}{T("24 horas por dia", "24 hours a day")}</li>
        <li>{CHECK}{T("Alimenta o percurso", "Feeds the learning path")}</li>
      </ul>
    </div>
  </div>
</div></section>

<section class="s" id="governanca" aria-labelledby="h-gov"><div class="wrap">
  <div class="k">{T("Governança", "Governance")}</div>
  <h2 class="sec" id="h-gov">{T("O professor continua no controle.", "The teacher stays in control.")}</h2>
  {T("A IA sugere e organiza. O que fala em nome do professor só sai com a aprovação dele, e cada decisão fica registrada.",
     "AI suggests and organizes. Anything said on the teacher's behalf goes out only with their approval, and every decision is logged.", "p", 'class="lead"')}
  <div class="govg">
    <div class="card audit rv">
      <span class="tag ok">{IC["ok"]}{T("Tudo auditável", "Fully auditable")}</span>
      {T("Cada decisão da IA fica registrada no histórico.", "Every AI decision is recorded in the history.", "b")}
      {T("O professor vê o que foi feito, por quê e com base em quais dados, e pode desfazer.", "Teachers see what was done, why and based on which data, and can undo it.", "p")}
      <ol class="log" aria-hidden="true">
        <li>{T("SEG 09:12", "MON 09:12")}{T("reforço montado · Funções", "review built · Functions")}</li>
        <li>{T("SEG 09:12", "MON 09:12")}{T("motivo: domínio 38 &lt; meta 70", "reason: mastery 38 &lt; goal 70")}</li>
        <li>{T("SEX 16:40", "FRI 16:40")}{T("revisão agendada · +7 dias", "review scheduled · +7 days")}</li>
      </ol>
    </div>
    <div>
      {T("O que a IA pode fazer", "What the AI can do", "div", 'class="k" style="margin-bottom:10px"')}
      {gov()}
    </div>
  </div>
</div></section>

<section class="s" id="pesquisa" aria-labelledby="h-pesq"><div class="wrap">
  <div class="k">{T("Pesquisa", "Research")}</div>
  <h2 class="sec" id="h-pesq">{T("Oito anos de pesquisa por trás da plataforma.", "Eight years of research behind the platform.")}</h2>
  {T("Duas linhas que se encontram: IA em ambientes virtuais e aprendizagem imersiva.", "Two lines of work that meet: AI in virtual learning environments and immersive learning.", "p", 'class="lead"')}
  <div class="pesq">
    <ul class="inst">
      <li>SENAI CIMATEC{T("Salvador, Bahia", "Salvador, Bahia, Brazil", "small")}</li>
      <li>UNEB{T("Universidade do Estado da Bahia", "State University of Bahia", "small")}</li>
      <li>IFBA{T("Instituto Federal da Bahia", "Federal Institute of Bahia", "small")}</li>
    </ul>
    {anos()}
  </div>
</div></section>

<section id="demo" aria-labelledby="h-demo"><div class="wrap">
  <div class="card demo">
    <svg viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" class="topo" aria-hidden="true">{DEMO_TOPO}</svg>
    <div>
      <div class="k">Demo</div>
      <h2 class="sec" id="h-demo">{T("Veja o percurso funcionando em 4 passos.", "See the path in action in 4 steps.")}</h2>
      {T("Uma turma de exemplo só sua, salva neste navegador.", "A sample class of your own, saved in this browser.", "p", 'class="lead"')}
      <div class="ctas" style="margin-top:24px"><a class="btn btn-acc btn-lg" href="./app/?demo=1#/" data-app="demo">{T("Entrar no demo", "Enter the demo")} {ARROW}</a></div>
      {T("Sem cadastro · visão de professor e de aluno", "No sign-up · teacher and student views", "p", 'class="note"')}
    </div>
    <ol class="dsteps">
      <li>{T("Veja a turma de exemplo, com risco, domínio e alertas já calculados.", "Look at the sample class, with risk, mastery and alerts already calculated.")}</li>
      <li>{T("Abra um aluno ou crie um aluno de teste.", "Open a student or create a test student.")}</li>
      <li>{T("Troque para a visão de aluno, estude um módulo, converse com o tutor e responda o quiz.", "Switch to the student view, study a module, chat with the tutor and take the quiz.")}</li>
      <li>{T("Volte e clique em <strong>Analisar turma</strong>: o alerta do seu aluno aparece.", "Go back and click <strong>Analyze class</strong>: your student's alert shows up.")}</li>
    </ol>
  </div>
</div></section>
</main>

<footer><div class="wrap">
  {wordmark("wm")}
  <span>{T("SENAI CIMATEC · Salvador, Bahia", "SENAI CIMATEC · Salvador, Bahia, Brazil")}</span>
  <nav aria-label="Rodapé" data-en-label="Footer">
    <a href="./app/?demo=1#/" data-app="demo">Demo</a>
    <a href="./app/" data-app="login">{T("Entrar", "Sign in")}</a>
    <a href="#pesquisa">{T("Pesquisa", "Research")}</a>
  </nav>
</div></footer>
<script>{JS}</script>
</body>
</html>
'''

OUT.write_text(page, encoding="utf-8")
print("ok", OUT, f"{len(page)/1024:.0f} KB")
