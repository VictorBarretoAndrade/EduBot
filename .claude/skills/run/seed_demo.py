#!/usr/bin/env python3
"""Popula a base com as 3 personas de aluno usadas no ROTEIRO_APRESENTACAO.md.

Roda TUDO pela API pública (mesmo caminho de um aluno real), então o que aparece
no painel foi de fato produzido pelas regras de negócio — não é dado injetado:

  Pedro   (RA 5) — consome tudo, acerta quase tudo   -> aluno saudável
  Thiago  (RA 6) — deixa módulos pela metade          -> mediano, checklist
  Manuel  (RA 7) — lê pouco, erra muito, sumiu 8 dias -> EM RISCO + reforço

A única escrita direta no banco é o `--backdate` do Manuel (envelhecer os
timestamps dele), porque a API sempre grava "agora" e a demo precisa de um aluno
inativo para a Regra 1 (plano de retomada) e para o score de risco.

Uso:
    python .claude/skills/run/seed_demo.py            # semeia e mostra o resumo
    python .claude/skills/run/seed_demo.py --dry-run  # só mostra o plano
"""
import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request

# Console do Windows usa cp1252 e engasga com emoji/acento; força UTF-8 na saída.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

API = "http://localhost:5010"
DB = ["docker", "exec", "ova_db", "mysql", "-ueduardo", "-pPassword-1", "ova_db", "-N", "-e"]

# ---------------------------------------------------------------------------
# Plano de cada persona.
#   ovas      : {ova_id: perc_scrolled}  (>=70 libera o quiz; >=90 conclui)
#   midia     : fração dos vídeos/podcasts/atividades do OVA que ele consome
#   quiz      : {ova_id: (acertos_alvo, erros_alvo)} — None = não faz o quiz
#   backdate  : dias para envelhecer a atividade (None = ativo hoje)
# ---------------------------------------------------------------------------
PERSONAS = [
    {
        "ra": "5", "nome": "Pedro", "perfil": "alto desempenho",
        "ovas": {1: 100, 2: 100, 3: 100, 4: 100},
        "midia": 1.0,
        # acerta todas; em 4 delas erra a 1ª tentativa e acerta na 2ª (32 ac / 4 er = 89%)
        "quiz": {1: "todas", 2: "todas", 3: "todas", 4: "todas"},
        "erros_antes_de_acertar": 4,
        "backdate": None,
    },
    {
        "ra": "6", "nome": "Thiago", "perfil": "mediano",
        "ovas": {1: 100, 2: 85, 3: 40},
        "midia": 0.5,
        "quiz": {1: (5, 4), 2: (5, 4)},        # 10 ac / 8 er = 56%
        "erros_antes_de_acertar": 0,
        "backdate": None,
    },
    {
        "ra": "7", "nome": "Manuel", "perfil": "em dificuldade",
        "ovas": {1: 75},                        # só um módulo, e nem terminou
        "midia": 0.15,
        "quiz": {1: (2, 7)},                    # 2 ac / 7 er = 22%
        "erros_antes_de_acertar": 0,
        "backdate": 8,
    },
]

TUTOR_RA = "2"


# ---------------------------------------------------------------------------
# Infra
# ---------------------------------------------------------------------------
def sql(query):
    out = subprocess.run(DB + [query], capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(f"MySQL falhou: {out.stderr.strip()}")
    linhas = [l for l in out.stdout.splitlines() if l.strip()]
    return [l.split("\t") for l in linhas]


def call(method, path, token=None, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode()
            return r.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except ValueError:
            return e.code, body


def login(ra):
    status, body = call("POST", "/login", payload={"ra": ra, "password": ra})
    if status != 200:
        raise RuntimeError(f"login RA={ra} falhou ({status}): {body}")
    return body["token"]


# ---------------------------------------------------------------------------
# Conteúdo do banco
# ---------------------------------------------------------------------------
def carregar_conteudo():
    gabarito, por_ova = {}, {}
    for ova_id, qid, resposta in sql(
            "SELECT ova_id, question_id, answer FROM questions ORDER BY question_id;"):
        gabarito[int(qid)] = resposta
        por_ova.setdefault(int(ova_id), []).append(int(qid))

    midia = {}
    for ova_id, rid, tipo, dur in sql(
            "SELECT ova_id, resource_id, resource_type, IFNULL(duration_seconds,600) "
            "FROM resources WHERE resource_type IN ('video','podcast','atividade') "
            "ORDER BY resource_id;"):
        midia.setdefault(int(ova_id), []).append((int(rid), tipo, int(dur)))
    return gabarito, por_ova, midia


# ---------------------------------------------------------------------------
# Ações do aluno (via API)
# ---------------------------------------------------------------------------
def ler_ova(token, ova_id, perc, segundos):
    return call("POST", "/progress/ova", token, {
        "ova_id": ova_id, "seconds_delta": segundos,
        "perc_scrolled": perc, "completed": perc >= 90})


def consumir_midia(token, rid, tipo, duracao):
    return call("POST", "/progress/resource", token, {
        "resource_id": rid,
        "coverage_bitmap": "1" * 100,              # cobertura real: 100 baldes acesos
        "watched_seconds_delta": duracao,
        "seconds_consumed": duracao,
        "perc_consumed": 100,
        "last_position_s": duracao,
        "completed": True})


def responder(token, qid, correta, acertar):
    # alternativa errada determinística: a próxima letra do alfabeto (a->b, d->a)
    escolha = correta if acertar else "abcd"[("abcd".index(correta) + 1) % 4]
    return call("POST", "/question/answer", token,
                {"question_id": qid, "selected": escolha, "response_ms": 9000})


def emitir_eventos(token, ova_id):
    call("POST", "/events", token, {"events": [
        {"verb": "logged_in", "object_type": "session"},
        {"verb": "opened", "object_type": "ova", "object_id": ova_id},
        {"verb": "read", "object_type": "ova", "object_id": ova_id, "context": {"perc": 80}},
        {"verb": "played", "object_type": "ova_section", "object_id": ova_id},
        {"verb": "companion_spoke", "object_type": "ova", "object_id": ova_id},
    ]})


def envelhecer(ra, dias):
    """Recua os timestamps do aluno em `dias` — o único acesso direto ao banco.

    Precisa rodar DUAS vezes: uma antes da varredura da turma (para a Regra 1 de
    inatividade disparar) e outra depois, porque a própria varredura grava um
    evento `received_intervention` com a data de hoje, que é uma das 5 fontes de
    `dias_sem_acesso` e zeraria a inatividade recém-criada."""
    sid = sql(f"SELECT student_id FROM students WHERE ra='{ra}';")[0][0]
    for stmt in (
        f"UPDATE ova_progress      SET last_access=DATE_SUB(NOW(), INTERVAL {dias} DAY) WHERE student_id={sid};",
        f"UPDATE resource_progress SET last_access=DATE_SUB(NOW(), INTERVAL {dias} DAY) WHERE student_id={sid};",
        f"UPDATE attempts          SET attempt_time=DATE_SUB(NOW(), INTERVAL {dias} DAY) WHERE student_id={sid};",
        f"UPDATE learning_events   SET occurred_at=DATE_SUB(NOW(), INTERVAL {dias} DAY) WHERE student_id={sid};",
        f"UPDATE interactions      SET interaction_date=DATE_SUB(CURDATE(), INTERVAL {dias} DAY) WHERE student_id={sid};",
    ):
        sql(stmt)


# ---------------------------------------------------------------------------
# Semeadura de uma persona
# ---------------------------------------------------------------------------
def semear(p, gabarito, questoes_por_ova, midia_por_ova, dry_run=False):
    print(f"\n--- {p['nome']} (RA {p['ra']}) · {p['perfil']} ---")
    if dry_run:
        print(f"    OVAs {p['ovas']} | mídia {int(p['midia']*100)}% | quiz {p['quiz']}")
        return

    token = login(p["ra"])

    # 1) leitura dos módulos
    for ova_id, perc in p["ovas"].items():
        segundos = int(perc * 9)                    # ~15 min num módulo lido por inteiro
        ler_ova(token, ova_id, perc, segundos)
        emitir_eventos(token, ova_id)
        print(f"    OVA {ova_id}: {perc}% lido ({segundos//60} min)"
              + ("  [concluído]" if perc >= 90 else ""))

    # 2) consumo de vídeo/podcast/atividade
    consumidos = 0
    for ova_id in p["ovas"]:
        recursos = midia_por_ova.get(ova_id, [])
        quantos = max(1, round(len(recursos) * p["midia"])) if p["midia"] > 0 else 0
        for rid, tipo, dur in recursos[:quantos]:
            consumir_midia(token, rid, tipo, dur)
            consumidos += 1
    print(f"    mídia consumida: {consumidos} recurso(s)")

    # 3) quiz — o gate de 70% é do backend; abaixo disso ele recusa (esperado)
    acertos = erros = travados = 0
    restam_erros_antes = p.get("erros_antes_de_acertar", 0)
    for ova_id, plano in p["quiz"].items():
        qids = questoes_por_ova.get(ova_id, [])
        if plano == "todas":
            for qid in qids:
                if restam_erros_antes > 0:        # erra, depois acerta a mesma
                    st, _ = responder(token, qid, gabarito[qid], acertar=False)
                    if st == 403:
                        travados += 1
                        continue
                    erros += 1
                    restam_erros_antes -= 1
                st, _ = responder(token, qid, gabarito[qid], acertar=True)
                if st == 403:
                    travados += 1
                else:
                    acertos += 1
        else:
            n_ac, n_er = plano
            for i, qid in enumerate(qids):
                if i < n_ac:
                    alvo = True
                elif i < n_ac + n_er:
                    alvo = False
                else:
                    break
                st, _ = responder(token, qid, gabarito[qid], acertar=alvo)
                if st == 403:
                    travados += 1
                elif alvo:
                    acertos += 1
                else:
                    erros += 1

    total = acertos + erros
    taxa = f"{100*acertos//total}%" if total else "—"
    print(f"    quiz: {acertos} acerto(s) · {erros} erro(s) · {taxa} de aproveitamento"
          + (f"  [{travados} bloqueado(s) pelo gate de 70%]" if travados else ""))

    if p.get("backdate"):
        envelhecer(p["ra"], p["backdate"])
        print(f"    atividade envelhecida em {p['backdate']} dias (aluno some da plataforma)")


# ---------------------------------------------------------------------------
def limpar_ruido_da_semeadura():
    """Apaga alertas/intervenções criados NO MEIO da semeadura.

    A proatividade dispara a cada conclusão de módulo e a cada erro de quiz — ou
    seja, com o aluno ainda pela metade. O Pedro chegava ao fim com 100% de
    consumo mas carregando um "você consumiu 10%" congelado do começo. Limpar e
    reavaliar ao final faz o painel refletir o estado FINAL de cada aluno."""
    ids = ",".join(sql(f"SELECT student_id FROM students WHERE ra='{p['ra']}';")[0][0]
                   for p in PERSONAS)
    for tabela in ("alerts", "interventions", "agent_decisions"):
        sql(f"DELETE FROM {tabela} WHERE student_id IN ({ids});")
    sql(f"DELETE FROM personalized_ova WHERE student_id IN ({ids});")
    print("")
    print(f"limpeza: alertas/intervencoes intermediarias removidas (alunos {ids})")


def regatilhar_reforco():
    """Reconstrói o convite de reforço do Manuel APONTANDO para o assunto que ele
    realmente estudou e errou.

    A varredura da turma só recria as intervenções de turma (retomada, trilha
    mínima, checklist); o `reforco_sugerido` nasce do erro no quiz. Uma resposta
    errada a mais numa competência do módulo que ele leu recria o convite com o
    alvo certo — pela API, como um aluno faria."""
    manuel = next(p for p in PERSONAS if p["ra"] == "7")
    token = login(manuel["ra"])
    qid = 9                      # OVA 1, competência 3 — assunto que ele leu e errou
    gabarito = {int(q): a for _o, q, a in
                sql(f"SELECT ova_id, question_id, answer FROM questions WHERE question_id={qid};")}
    responder(token, qid, gabarito[qid], acertar=False)
    print("convite de reforço recriado com o assunto que o Manuel estudou")


def resumo():
    print("\n" + "=" * 66)
    print("RESUMO — o que o professor vai ver")
    print("=" * 66)
    limpar_ruido_da_semeadura()
    for p in PERSONAS:                              # inatividade ANTES da varredura,
        if p.get("backdate"):                       # senão a Regra 1 não dispara
            envelhecer(p["ra"], p["backdate"])

    tutor = login(TUTOR_RA)
    call("POST", "/tutor/evaluate", tutor)          # varredura da turma -> alertas
    regatilhar_reforco()

    # a varredura e o re-gatilho carimbam eventos de hoje em quem recebeu
    # intervenção; reaplica o envelhecimento para o painel mostrar a inatividade.
    for p in PERSONAS:
        if p.get("backdate"):
            envelhecer(p["ra"], p["backdate"])
    status, turma = call("GET", "/tutor/turma", tutor)
    if status != 200:
        print("  (não foi possível ler /tutor/turma:", turma, ")")
        return
    print(f"  alunos ativos: {turma['total']}")
    for a in turma["alunos"]:
        r = a["risco"]
        marca = "🔴 EM RISCO" if r["em_risco"] else "🟢 ok      "
        print(f"  {marca}  {a['nome']:<8} risco {r['score']:>3}"
              f" | erro {a['taxa_erro']} | consumo {a['consumo_percentual']}%"
              f" | {a['dias_sem_acesso']} dia(s) sem acesso"
              f" | alertas {a['alertas_abertos']}")
        if r["componentes"]:
            comps = ", ".join(f"{k}={v}" for k, v in r["componentes"].items())
            print(f"              principal: {r['principal']}  ({comps})")

    status, alertas = call("GET", "/tutor/alerts", tutor)
    if status == 200:
        lista = alertas.get("alertas", []) if isinstance(alertas, dict) else alertas
        if isinstance(lista, list) and lista:
            print(f"\n  alertas abertos ({len(lista)}):")
            for al in lista[:8]:
                print(f"    [{al.get('severity','?'):>5}] {al.get('type')}: {al.get('message','')[:70]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="mostra o plano e sai")
    args = ap.parse_args()

    try:
        call("GET", "/")
    except Exception:
        pass
    try:
        login("1")
    except Exception as e:
        print(f"API não respondeu em {API} — a stack está no ar? ({e})")
        sys.exit(1)

    gabarito, questoes_por_ova, midia_por_ova = carregar_conteudo()
    print(f"conteúdo: {len(gabarito)} questões em {len(questoes_por_ova)} OVAs, "
          f"{sum(len(v) for v in midia_por_ova.values())} recursos de mídia")

    for p in PERSONAS:
        semear(p, gabarito, questoes_por_ova, midia_por_ova, args.dry_run)

    if not args.dry_run:
        resumo()
        print("\npronto. abra http://localhost:8010/app/")


if __name__ == "__main__":
    main()
