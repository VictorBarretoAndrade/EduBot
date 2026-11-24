# Login com Google + modo DEMO (migration 026).
#
#   GET  /auth/config     -> o que a tela de login pode oferecer (client id público
#                            do Google, botão Demo sem login)
#   POST /auth/google     -> {credential}: ID token do Google Identity Services.
#                            Cria (1ª vez) ou reabre o workspace DEMO da pessoa e
#                            devolve a sessão do COORDENADOR.
#   POST /auth/demo       -> {device?}: botão "Demo" SEM login (EDUBOT_DEMO_SEM_LOGIN=1).
#                            Cada navegador ganha a própria turma: o servidor sorteia
#                            um segredo de dispositivo, o front o guarda e o reenvia
#                            para reabrir a mesma turma. Só o hash vai para o banco.
#   POST /demo/switch     -> troca de visão coordenador <-> aluno de teste
#                            ("Student View" do Canvas): devolve a sessão da outra.
#
# A resposta de sessão tem o MESMO formato do POST /login, mais o campo `demo`.
import json
import logging

from flask import Blueprint, g, request
from flask_cors import cross_origin

from edubot.api.auth import generate_token, login_throttled, require_auth
from edubot.api.google_auth import (google_client_ids, google_login_enabled,
                                    verify_google_credential)
from edubot.api.http import get_payload
from edubot.services import demo

app_demo = Blueprint("demo", __name__)
logger = logging.getLogger("edubot.demo")


def session_payload(student):
    return {
        "Message": "Logged successfully!",
        "ids": {"course_id": student.course_id_id, "student_id": student.student_id},
        "is_admin": bool(student.is_admin),
        "role": student.role or "aluno",
        "demo": student.demo_kind,
        "token": generate_token(student.student_id),
    }


# Limites por IP e por minuto. Validar no Google é barato; o que custa é CRIAR um
# workspace (curso + 6 contas + histórico), então só isso tem limite apertado.
# Atrás do Caddy, o IP real vem do X-Forwarded-For (EDUBOT_PROXY_HOPS, app.py).
VERIFY_PER_MINUTE = 30
NEW_WORKSPACES_PER_MINUTE = 10


def _throttled(key, max_attempts):
    return login_throttled(key, request.remote_addr or "?", max_attempts=max_attempts)


_TOO_MANY = (json.dumps({"Error": "Muitas tentativas. Tente novamente em instantes."}),
             429, {"Retry-After": "60"})


@app_demo.route("/auth/config", methods=["GET"])
@cross_origin()
def auth_config():
    ids = google_client_ids()
    return json.dumps({
        "google_client_id": ids[0] if ids else None,
        "demo_sem_login": demo.anonymous_demo_enabled(),
    }), 200


@app_demo.route("/auth/google", methods=["POST"])
@cross_origin()
def auth_google():
    if not google_login_enabled():
        return json.dumps({"Error": "Login com Google não configurado"}), 404
    if _throttled("google", VERIFY_PER_MINUTE):
        return _TOO_MANY
    credential = (get_payload() or {}).get("credential")
    try:
        identity = verify_google_credential(credential)
    except Exception:
        return json.dumps({"Error": "Não foi possível validar com o Google agora"}), 503
    if identity is None:
        return json.dumps({"Error": "Credencial do Google inválida"}), 401

    if (not demo.workspace_exists(identity["sub"])
            and _throttled("google-new", NEW_WORKSPACES_PER_MINUTE)):
        return _TOO_MANY
    lang = (get_payload() or {}).get("lang")
    coord = demo.get_or_create_workspace(identity["sub"], identity["email"], identity["name"], lang)
    return json.dumps(session_payload(coord)), 200


@app_demo.route("/auth/demo", methods=["POST"])
@cross_origin()
def auth_demo():
    if not demo.anonymous_demo_enabled():
        return json.dumps({"Error": "Não encontrado"}), 404
    if _throttled("demo", VERIFY_PER_MINUTE):
        return _TOO_MANY
    payload = get_payload() or {}
    device = demo.valid_device(payload.get("device"))
    if device is None or not demo.workspace_exists(demo.device_sub(device)):
        # Navegador novo (ou segredo desconhecido): sorteia outro e cria a turma.
        if _throttled("demo-new", NEW_WORKSPACES_PER_MINUTE):
            return _TOO_MANY
        device = device or demo.new_device()
    # Nome da conta no idioma da tela (a turma é criada uma vez; depois fica).
    lang = "en" if payload.get("lang") == "en" else "pt"
    coord = demo.get_or_create_workspace(demo.device_sub(device), None, demo.ANON_NAME[lang], lang)
    return json.dumps({**session_payload(coord), "device": device}), 200


@app_demo.route("/demo/switch", methods=["POST"])
@cross_origin()
@require_auth
def demo_switch():
    target = demo.switch_target(g.student)
    if target is None:
        return json.dumps({"Error": "Troca de visão disponível só na conta DEMO"}), 403
    return json.dumps(session_payload(target)), 200
