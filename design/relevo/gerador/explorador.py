# Explorador — tutor oficial da identidade "Relevo".
# Gera o SVG (busto e cabeça), a seção do guia, CSS, JS e os arquivos SVG avulsos.

ESTADOS = [
  ("explicando",  "Explicando",    "Responde uma dúvida",
   "Pense numa moeda girando no ar: enquanto gira, não é cara nem coroa. O qubit é parecido."),
  ("ouvindo",     "Ouvindo",       "O aluno fala por voz ou está digitando",
   "Pode falar, estou ouvindo."),
  ("pensando",    "Pensando",      "Gerando resposta ou montando um percurso (mais de 400 ms)",
   "Deixa eu olhar o seu rastro… Você errou as 2 questões sobre decoerência."),
  ("encorajando", "Encorajando",   "Abaixo da meta: convite para o reforço",
   "Faltam 19 pontos até a cota. Montei uma trilha de 15 minutos para você chegar lá."),
  ("meta",        "Meta atingida", "Competência chegou à cota do professor",
   "Cota atingida! Desafios chegou a 72. A meta do professor era 70."),
  ("revisar",     "Vamos revisar", "Revisão agendada ou lembrete",
   "Sexta tem um marco de revisão: 10 minutos e você não perde altitude."),
]
NOMES = {k: n for k, n, _, _ in ESTADOS}
FALAS = {k: f for k, _, _, f in ESTADOS}

# ---------------- rosto (dentro do grupo da cabeça) ----------------
EYES = '<g class="eyes"><ellipse cx="51" cy="62" rx="2.8" ry="3.8"/><ellipse cx="69" cy="62" rx="2.8" ry="3.8"/></g>'
BROWS = '<path class="ln" d="M45 54 Q51 51 56 53"/><path class="ln" d="M64 53 Q69 51 75 54"/>'
FACES = {
  "explicando": BROWS + EYES + '<path class="fk m-a" d="M53 73 Q60 82 67 73 Q60 76 53 73Z"/><path class="fk m-b" d="M55.5 74 Q60 78 64.5 74 Q60 75.5 55.5 74Z"/>',
  "ouvindo": '<path class="ln" d="M45 53 Q51 50.5 56 52.5"/><path class="ln" d="M64 52.5 Q69 50.5 75 53"/>' + EYES +
             '<ellipse class="fk" cx="60" cy="74.5" rx="2.6" ry="2.2"/>',
  "pensando": '<path class="ln" d="M45 53.5 Q51 50 56 52.5"/><path class="ln" d="M64 55 L75 55"/>'
              '<g class="eyes"><ellipse cx="53" cy="60" rx="2.8" ry="3.8"/><ellipse cx="71" cy="60" rx="2.8" ry="3.8"/></g>'
              '<path class="ln" d="M55 76 Q60 74.5 64 76"/>',
  "encorajando": '<path class="ln" d="M45 55 L56 53"/><path class="ln" d="M64 53 L75 55"/>' + EYES +
                 '<path class="ln" d="M53 72.5 Q60 79 67 72.5"/><path class="ln" d="M53 72.5 L67 72.5"/>',
  "meta": '<path class="ln" d="M45 53 Q51 50.5 56 52"/><path class="ln" d="M64 52 Q69 50.5 75 53"/>'
          '<path class="ln" d="M47 63 Q51 57 55 63"/><path class="ln" d="M65 63 Q69 57 73 63"/>'
          '<path class="fk" d="M52 72 Q60 86 68 72 Q60 75 52 72Z"/>',
  "revisar": BROWS + '<ellipse class="fk" cx="51" cy="62" rx="2.8" ry="3.8"/><path class="ln" d="M65 62 Q69 59 73 62"/>'
             '<path class="ln" d="M54 73 Q60 78 66 73"/>',
}

# ---------------- gestos (na frente do corpo) ----------------
ARM_UP = '<path class="fill" d="M89 106 C92 97 94 89 95.5 81 L104.5 82 C103.5 91 101 100 97 110 Z"/>'
FINGER_HAND = ('<path class="fill" d="M100.5 73 V60.5 a2.4 2.4 0 0 1 4.8 0 V73"/>'
               '<path class="fill" d="M94.5 82 C93 75 95.5 71.5 99.5 71.5 H104 C107 71.5 108 75 107 82 Z"/>'
               '<path class="ln2" d="M97.5 76.5 H101"/>')
FIST = ('<path class="fill" d="M94 83 C92.5 75 95 70 100.5 70 C106 70 108.5 75 107 83 Z"/>'
        '<path class="ln2" d="M96 75 H105 M96 79 H105"/>')
GESTOS = {
  "explicando": ARM_UP + FINGER_HAND,
  "encorajando": ARM_UP + FIST,
  "pensando": '<g class="think"><circle cx="99" cy="33" r="2.6"/><circle cx="106" cy="25" r="2"/><circle cx="111" cy="17" r="1.5"/></g>',
  "ouvindo": '<g class="onda"><path class="sw" d="M28.5 57 Q25 63 28.5 69"/><path class="sw" d="M23.5 53 Q17.5 63 23.5 73"/></g>',
}

def bust(expr="explicando", only=None, label=True, cls="", vb="0 0 120 120"):
    show = [only] if only else [k for k, *_ in ESTADOS]
    faces = "".join(f'<g class="ex ex-{e}">{FACES[e]}</g>' for e in show)
    gestos = "".join(f'<g class="ex ex-{e} gs">{GESTOS[e]}</g>' for e in show if e in GESTOS)
    al = f'role="img" aria-label="Tutor Explorador: {NOMES[expr].lower()}"' if label else 'aria-hidden="true"'
    return f'''<svg viewBox="{vb}" class="chr chr-exp {cls}" data-expr="{expr}" {al}>
      <g class="bodyg">
        <path class="fill" d="M18 121 C20 98 38 88 60 88 C82 88 100 98 102 121"/>
        <path class="ln2" d="M50 89 L60 99 L70 89"/>
        <path class="ln2" d="M38 93 C40 103 41 112 41 121"/><path class="ln2" d="M82 93 C80 103 79 112 79 121"/>
        <g class="cmp"><circle class="fill" cx="80" cy="106" r="7.5"/><g class="ndl"><path class="tr-f" d="M80 99.8 L82.4 106 L77.6 106Z"/><path class="fk" d="M80 112.2 L82.4 106 L77.6 106Z"/></g></g>
        <path class="ln2" d="M53 80 V89 M67 80 V89"/>
        <g class="headg">
          <path class="fill" d="M39 60 Q33.5 60 34.5 66 Q36 70.5 40.5 68.5"/><path class="fill" d="M81 60 Q86.5 60 85.5 66 Q84 70.5 79.5 68.5"/>
          <ellipse class="fill" cx="60" cy="61" rx="21" ry="23"/>
          <path class="ln nose" d="M60 64 Q57.5 68.5 60.5 69.5"/>
          {faces}
          <g class="hat">
            <path class="fill" d="M38 45 C38 25 82 25 82 45"/>
            <path class="tr-f" d="M38.7 38 H81.3 V43.5 H38.7Z"/>
            <path class="rel" d="M50 33 Q60 28.5 70 33"/><path class="rel" d="M54 29.5 Q60 27.5 66 29.5"/>
            <path class="fill" d="M23 46 C36 39.5 84 39.5 97 46 C84 50.5 36 50.5 23 46Z"/>
          </g>
        </g>
        {gestos}
      </g></svg>'''

def head(expr="explicando", label=False, cls=""):
    """Versão só cabeça, para avatares abaixo de 48 px: recorte + traço mais grosso."""
    return bust(expr, only=expr, label=label, cls=f"cab {cls}", vb="21 20 78 78")

# ---------------- CSS ----------------
CSS = r'''
.chr{width:100%;height:100%;overflow:visible}
.chr .ex{display:none}
.chr[data-expr="explicando"] .ex-explicando,.chr[data-expr="ouvindo"] .ex-ouvindo,.chr[data-expr="pensando"] .ex-pensando,
.chr[data-expr="encorajando"] .ex-encorajando,.chr[data-expr="meta"] .ex-meta,.chr[data-expr="revisar"] .ex-revisar{display:inline}
.chr .fill{fill:rgb(var(--surface));stroke:rgb(var(--ink));stroke-width:2.4;stroke-linejoin:round}
.chr .ln{fill:none;stroke:rgb(var(--ink));stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.chr .ln2{fill:none;stroke:rgb(var(--ink));stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.chr .nose{stroke-width:1.8}
.chr .fk,.chr .eyes ellipse{fill:rgb(var(--ink))}
.chr .tr-f{fill:rgb(var(--trail));stroke:rgb(var(--ink));stroke-width:1.6;stroke-linejoin:round}
.chr .rel{fill:none;stroke:rgb(var(--contour-em));stroke-width:1.6;stroke-linecap:round}
.chr .sw{fill:none;stroke:rgb(var(--muted));stroke-width:2;stroke-linecap:round}
.chr .think circle{fill:rgb(var(--muted));transform-box:fill-box;transform-origin:center}
.chr .m-b{opacity:0}
.chr.cab .fill,.chr.cab .ln{stroke-width:3.2}.chr.cab .ln2{stroke-width:2.6}.chr.cab .rel{stroke-width:2}
.chr .eyes,.chr .ndl,.chr .sw{transform-box:fill-box;transform-origin:center}
.chr .bodyg,.chr .headg,.chr .hat,.chr .gs{transform-box:view-box}
.chr .bodyg{transform-origin:60px 118px}
.chr .headg{transform-origin:60px 86px;transition:transform var(--dur-medio) var(--ease-subida)}
.chr .hat{transform-origin:30px 46px}
.chr[data-expr="ouvindo"] .headg{transform:rotate(-7deg)}
/* animações: só fora de .still e com movimento ligado */
.chr:not(.still) .eyes{animation:pisca 5s infinite}
@keyframes pisca{0%,93%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.1)}}
.chr:not(.still) .m-a{animation:fala-a .42s linear 9}
.chr:not(.still) .m-b{animation:fala-b .42s linear 9}
@keyframes fala-a{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes fala-b{0%,49%{opacity:0}50%,100%{opacity:1}}
.chr[data-expr="explicando"]:not(.still) .ex-explicando.gs{animation:gesto 2.4s var(--ease-subida) 2}
@keyframes gesto{0%,100%{transform:none}30%{transform:translateY(-3px)}60%{transform:translateY(1px)}}
.chr[data-expr="ouvindo"]:not(.still) .sw{animation:som 1.4s ease-in-out infinite}
.chr[data-expr="ouvindo"]:not(.still) .sw:last-child{animation-delay:.35s}
@keyframes som{0%,100%{opacity:.25;transform:scale(.9)}50%{opacity:1;transform:scale(1)}}
.chr[data-expr="pensando"]:not(.still) .ndl{animation:gira 2.2s var(--ease-trilha) infinite}
@keyframes gira{to{transform:rotate(360deg)}}
.chr[data-expr="pensando"]:not(.still) .think circle{animation:boia 1.5s ease-in-out infinite}
.chr[data-expr="pensando"]:not(.still) .think circle:nth-child(2){animation-delay:.25s}
.chr[data-expr="pensando"]:not(.still) .think circle:nth-child(3){animation-delay:.5s}
@keyframes boia{50%{transform:translateY(-3px);opacity:.45}}
.chr[data-expr="encorajando"]:not(.still) .ex-encorajando.gs{animation:punho 1.6s var(--ease-subida) 3}
@keyframes punho{0%,100%{transform:none}25%{transform:translateY(-5px)}50%{transform:none}}
.chr[data-expr="meta"]:not(.still) .bodyg{animation:pula 1.8s var(--ease-subida) infinite}
@keyframes pula{0%,62%,100%{transform:translateY(0)}14%{transform:translateY(-6px)}28%{transform:translateY(0)}40%{transform:translateY(-2px)}}
.chr[data-expr="meta"]:not(.still) .hat{animation:chapeu 1.8s var(--ease-subida) infinite}
@keyframes chapeu{0%,70%,100%{transform:none}25%,45%{transform:translateY(-9px) rotate(-12deg)}}
.chr[data-expr="revisar"]:not(.still) .headg{animation:aceno 2.6s ease-in-out infinite}
@keyframes aceno{0%,70%,100%{transform:rotate(0)}20%{transform:rotate(-4deg)}42%{transform:rotate(3deg)}}

/* seção do tutor */
.xp-hero{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:40px}
.xp-stage{padding:24px;display:flex;flex-direction:column;align-items:center;gap:18px;position:relative;overflow:hidden}
.xp-stage .topo{position:absolute;inset:0;width:100%;height:100%;opacity:.55}
.xp-big{position:relative;width:300px;height:300px}
.xp-seg{position:relative;display:grid;grid-template-columns:repeat(3,1fr)}
.xp-seg button{border-top:1px solid rgb(var(--line-strong))}
.xp-seg button:nth-child(-n+3){border-top:0}
.xp-side{padding:24px;display:flex;flex-direction:column;gap:18px}
.xp-side .lab,.xp-cell .lab{font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));display:flex;justify-content:space-between}
.xp-side .lab span,.xp-cell .lab span{color:rgb(var(--muted))}
.xp-bubble{border-left:2px solid rgb(var(--trail));padding:2px 0 2px 14px;min-height:84px}
.xp-bubble b{display:block;font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));margin-bottom:6px}
.xp-bubble p{font-size:18px;line-height:1.5;letter-spacing:-.01em}
.xp-when{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:14px;border-top:1px solid rgb(var(--line));padding-top:16px}
.xp-when dt{font:500 11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--muted));padding-top:2px}
.xp-why{font-size:14.5px;line-height:1.55;color:rgb(var(--muted));border-top:1px solid rgb(var(--line));padding-top:16px}
.xp-why b{color:rgb(var(--ink))}
.xp-states{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:20px}
.xs{display:flex;flex-direction:column;gap:8px}
.xs .b{aspect-ratio:1;background:rgb(var(--surface));border:1px solid rgb(var(--line));border-radius:var(--radius);padding:8px}
.xs b{font-size:14px}.xs small{font-size:12.5px;line-height:1.4;color:rgb(var(--muted))}
.xp-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
.xp-cell{padding:22px 24px}
.sizes{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-top:14px}
.sz{display:flex;flex-direction:column;align-items:center;gap:6px}
.sz small{font:500 10.5px var(--font-mono);color:rgb(var(--muted))}
.av{display:inline-block;border-radius:50%;background:rgb(var(--surface-2));border:1px solid rgb(var(--line));flex:none;overflow:hidden}
.av .chr{width:100%;height:100%}
.sq{display:inline-block;background:rgb(var(--surface));border:1px solid rgb(var(--line));border-radius:var(--radius);flex:none}
.xp-note{font-size:13.5px;line-height:1.5;color:rgb(var(--muted));margin-top:14px}
.xchat{border:1px solid rgb(var(--line));border-radius:var(--radius);background:rgb(var(--bg));padding:14px 16px;margin-top:14px}
.xchat .th{display:flex;gap:10px;align-items:center;margin-bottom:12px}
.xchat .th b{display:block;font-size:14.5px}.xchat .th small{font-size:12px;color:rgb(var(--muted))}
.xchat .q{margin-left:auto;width:fit-content;max-width:85%;font-size:13.5px;padding:7px 11px;border:1px solid rgb(var(--line-strong));border-radius:var(--radius);margin-bottom:10px}
.xchat .row{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
.xchat .row p{font-size:14px;line-height:1.5;border-left:2px solid rgb(var(--trail));padding-left:11px}
.xchat .row .wait{font:500 12px var(--font-mono);color:rgb(var(--muted));border:0;padding:8px 0 0}
.xchat .prof{background:rgb(var(--surface));border:1px solid rgb(var(--line-strong));border-radius:var(--radius);padding:10px 12px;font-size:13.5px}
.xchat .prof b{display:block;font:500 10.5px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
.ficha{display:grid;grid-template-columns:1fr 1.25fr;gap:20px;margin-top:20px}
.constr{position:relative;padding:24px}
.constr svg.ann{width:100%;height:auto}
.ann .call{stroke:rgb(var(--trail));stroke-width:1;fill:none}
.ann .dot{fill:rgb(var(--trail))}
.ann text{font:500 10.5px var(--font-mono);fill:rgb(var(--ink));letter-spacing:.04em}
.ann text.s{fill:rgb(var(--muted))}
.regras{padding:24px}
.regras ul{list-style:none;margin-top:6px}
.regras li{display:grid;grid-template-columns:22px 1fr;gap:8px;font-size:14.5px;line-height:1.5;padding:9px 0;border-top:1px solid rgb(var(--line))}
.regras li:first-child{border-top:0}
.regras .y{color:rgb(var(--mata));font-weight:700}.regras .n{color:rgb(var(--trail-text));font-weight:700}
.regras h3{font:700 18px var(--font-sans);letter-spacing:-.02em;margin:18px 0 4px}
.regras h3:first-of-type{margin-top:0}
@media (max-width:860px){
  .xp-hero,.xp-row,.ficha{grid-template-columns:1fr}
  .xp-states{grid-template-columns:repeat(2,1fr)}
  .xp-big{width:240px;height:240px}
}
'''

JS = r'''
(function(){
  var falas = __FALAS__, quando = __QUANDO__, nomes = __NOMES__;
  document.querySelectorAll('[data-xp]').forEach(function(b){b.addEventListener('click',function(){
    var e=b.dataset.xp, svg=document.querySelector('#xp-big svg');
    svg.setAttribute('data-expr',e); svg.setAttribute('aria-label','Tutor Explorador: '+nomes[e].toLowerCase());
    document.getElementById('xp-fala').textContent=falas[e];
    document.getElementById('xp-quando').textContent=quando[e];
    document.querySelectorAll('[data-xp]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
  })});
})();
'''

def annotated():
    # personagem em 0..120 deslocado para a direita, com chamadas
    calls = [
      ((60, 33), (190, 22), "COPA + CURVAS DE NÍVEL", "traço 1,6 · cor Curva"),
      ((70, 41), (190, 52), "FAIXA DO CHAPÉU", "Trilha · único laranja"),
      ((96, 46), (190, 82), "ABA", "Folha + contorno 2,4"),
      ((79, 66), (190, 112), "ROSTO SEM COR", "só traço, sem tom de pele"),
      ((80, 101), (190, 142), "BÚSSOLA", "agulha Trilha · gira"),
      ((41, 112), (190, 172), "ALÇAS DA MOCHILA", "traço 2 · detalhe"),
    ]
    g = ""
    for (x0, y0), (x1, y1), t, s in calls:
        x0, y0 = x0 * 1.25, y0 * 1.25 + 10
        g += (f'<circle class="dot" cx="{x0}" cy="{y0}" r="2"/><path class="call" d="M{x0} {y0} L{x1-30} {y1} H{x1-4}"/>'
              f'<text x="{x1}" y="{y1-1}">{t}</text><text x="{x1}" y="{y1+11}" class="s">{s}</text>')
    inner = bust("explicando", only="explicando", label=False, cls="still")
    inner = inner.replace('<svg viewBox="0 0 120 120"', '<svg x="0" y="10" width="150" height="150" viewBox="0 0 120 120"', 1)
    return f'<svg viewBox="-6 4 386 186" class="ann" role="img" aria-label="Construção do Explorador com as partes indicadas">{inner}{g}</svg>'

def section(topo_svg):
    btns = "".join(f'<button data-xp="{k}" aria-pressed="{str(k=="explicando").lower()}">{n}</button>' for k, n, *_ in ESTADOS)
    states = "".join(f'<div class="xs"><div class="b">{bust(k, only=k, label=False)}</div><b>{n}</b><small>{q}</small></div>' for k, n, q, _ in ESTADOS)
    busts = "".join(f'<div class="sz"><span class="sq" style="width:{s}px;height:{s}px">{bust("explicando", only="explicando", label=False, cls="still")}</span><small>{s} px · busto</small></div>' for s in (96, 64, 48))
    heads = "".join(f'<div class="sz"><span class="av" style="width:{s}px;height:{s}px">{head("explicando", cls="still")}</span><small>{s} px · cabeça</small></div>' for s in (40, 32, 24, 20))
    return f'''<section class="s" id="tutor"><div class="wrap">
  <div class="k">05 · Tutor</div><h2 class="sec">O Explorador: um guia de campo, não um robô.</h2>
  <p class="lead">O tutor da Learnia anda junto com o aluno pelo mapa. Tem chapéu de expedição e uma bússola no peito, e muda de expressão conforme o momento do estudo. É só traço sobre a cor da folha: sem tom de pele, gênero ou idade definidos.</p>
  <div class="xp-hero">
    <div class="card xp-stage rv"><svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" class="topo" aria-hidden="true">{topo_svg}</svg>
      <div class="xp-big" id="xp-big">{bust("explicando")}</div>
      <div class="seg xp-seg" role="group" aria-label="Estado do Explorador">{btns}</div></div>
    <div class="card xp-side rv">
      <div class="lab">Na conversa <span>clique nos estados</span></div>
      <div class="xp-bubble" aria-live="polite"><b>Tutor Learnia</b><p id="xp-fala">{FALAS["explicando"]}</p></div>
      <dl class="xp-when"><dt>Quando</dt><dd id="xp-quando">{ESTADOS[0][2]}</dd><dt>Movimento</dt><dd>Pisca sempre; o gesto de cada estado roda por poucos segundos e para.</dd></dl>
      <p class="xp-why"><b>Por que um explorador?</b> A Learnia mostra o relevo do que o aluno sabe e traça a trilha até a meta. O tutor é quem caminha com ele: aponta o caminho, pensa junto, comemora a cota. Ele guia, mas quem define a meta é sempre o professor.</p>
    </div>
  </div>
  <div class="xp-states">{states}</div>
  <div class="xp-row">
    <div class="card xp-cell rv"><div class="lab">Tamanhos <span>busto a partir de 48 px</span></div>
      <div class="sizes">{busts}</div><div class="sizes">{heads}</div>
      <p class="xp-note">Abaixo de 48 px o busto perde detalhe; aí entra a versão cabeça, recortada e com traço mais grosso. Ela é o avatar de lista, notificação e cabeçalho do chat.</p></div>
    <div class="card xp-cell rv"><div class="lab">No chat do AVA <span>pensando → explicando</span></div>
      <div class="xchat">
        <div class="th"><span class="av" style="width:40px;height:40px">{head("explicando", cls="still")}</span><div><b>Tutor Learnia</b><small>Explorador · conversando sobre Superposição</small></div></div>
        <div class="q">Não entendi a parte da combinação de 0 e 1.</div>
        <div class="row"><span class="av" style="width:32px;height:32px">{head("pensando")}</span><p class="wait">Lendo o seu rastro…</p></div>
        <div class="row"><span class="av" style="width:32px;height:32px">{head("explicando", cls="still")}</span><p>Pense numa moeda girando no ar: enquanto gira, não é cara nem coroa. O qubit é parecido: até ser medido, guarda uma combinação de 0 e 1.</p></div>
        <div class="prof"><b>Mensagem do professor</b>Prof. [NOME] · aparece com o avatar e o nome do professor, nunca com o Explorador.</div>
      </div></div>
  </div>
  <div class="ficha">
    <div class="card constr rv"><div class="lab" style="font:500 11px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:rgb(var(--trail-text));margin-bottom:10px">Construção</div>{annotated()}</div>
    <div class="card regras rv">
      <h3>Pode</h3><ul>
        <li><span class="y">✓</span>Usar só três cores: Folha, Tinta e Trilha. Ele troca sozinho no modo escuro.</li>
        <li><span class="y">✓</span>Escolher o estado pelo momento do produto, não pelo humor do texto.</li>
        <li><span class="y">✓</span>Encorajar quando o aluno está abaixo da meta, sempre com o número e a trilha.</li>
        <li><span class="y">✓</span>Um Explorador animado por tela; nos outros lugares, parado.</li></ul>
      <h3>Não pode</h3><ul>
        <li><span class="n">✕</span>Falar em nome do professor. Mensagem do professor tem o avatar dele.</li>
        <li><span class="n">✕</span>Ficar triste, bravo ou decepcionado com erro do aluno.</li>
        <li><span class="n">✕</span>Ganhar cor de pele, roupa colorida ou acessório fora da paleta.</li>
        <li><span class="n">✕</span>Aparecer em nota oficial, certificado ou aviso de privacidade (LGPD).</li></ul>
    </div>
  </div>
</div></section>'''

# ---------------- arquivos SVG avulsos ----------------
STATIC = r'''.chr .ex{display:none}.ex-on{display:inline}
.fill{fill:rgb(var(--surface));stroke:rgb(var(--ink));stroke-width:2.4;stroke-linejoin:round}
.ln{fill:none;stroke:rgb(var(--ink));stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.ln2{fill:none;stroke:rgb(var(--ink));stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nose{stroke-width:1.8}.fk,.eyes ellipse{fill:rgb(var(--ink))}
.tr-f{fill:rgb(var(--trail));stroke:rgb(var(--ink));stroke-width:1.6;stroke-linejoin:round}
.rel{fill:none;stroke:rgb(var(--contour-em));stroke-width:1.6;stroke-linecap:round}
.sw{fill:none;stroke:rgb(var(--muted));stroke-width:2;stroke-linecap:round}.m-b{display:none}
.cab .fill,.cab .ln{stroke-width:3.2}.cab .ln2{stroke-width:2.6}.cab .rel{stroke-width:2}'''
TEMAS = {
  "claro":  "--surface:251 250 245;--ink:20 22 26;--trail:226 80 27;--contour-em:169 159 132;--muted:90 92 97",
  "escuro": "--surface:23 26 31;--ink:236 232 220;--trail:255 106 51;--contour-em:70 76 84;--muted:163 163 155",
}

def standalone(svg, tema):
    svg = svg.replace('<svg ', f'<svg xmlns="http://www.w3.org/2000/svg" style="{TEMAS[tema]}" ', 1)
    svg = svg.replace('class="ex ex-', 'class="ex-on ex-')
    i = svg.index('>') + 1
    return svg[:i] + f'<style>{STATIC}</style>' + svg[i:]

def export(outdir):
    import pathlib
    d = pathlib.Path(outdir); d.mkdir(parents=True, exist_ok=True)
    n = 0
    for tema in TEMAS:
        for k, *_ in ESTADOS:
            (d / f"explorador-{k}-{tema}.svg").write_text(standalone(bust(k, only=k, label=False), tema), encoding="utf-8"); n += 1
            (d / f"explorador-cabeca-{k}-{tema}.svg").write_text(standalone(head(k), tema), encoding="utf-8"); n += 1
    return n
