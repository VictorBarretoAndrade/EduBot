

# Import necessary libraries
from flask import Blueprint, request
from flask_cors import cross_origin
from edubot.api.http import get_payload
from peewee import PeeweeException # ORM library
import json

# Import ORM classes used in the routes
from edubot.data.models.students import Students
from edubot.data.models.courses import Courses

# MELHORIA (4.2): token de sessão emitido no login (ver api/auth.py)
# Fase 4d (A5): verificação por hash PBKDF2 + upgrade-on-login do seed legado
# A.3: rate-limit contra força bruta (RA enumerável, senha do seed = RA)
from edubot.api.auth import (generate_token, hash_password, is_hashed,
                             login_throttled, verify_password)

# Create a route blueprint as a reusable component
app_login = Blueprint('login', __name__)

# Define a route to verify if a user is in the database
@app_login.route("/login", methods=["POST"])
# Enable cross-origin requests from other domains
@cross_origin()
def login():
    if request.method == "POST":
        try:
            # Retrieve the JSON payload sent by the front-end
            login_data = get_payload()

            # A.3: rate-limit por (RA, IP). Bloqueia força bruta antes de tocar o
            # banco. 429 com Retry-After.
            ra = str(login_data.get("ra", "")).strip()
            if not ra:
                return "Wrong RA or Password", 401

            if login_throttled(ra, request.remote_addr or "?"):
                return json.dumps({"Error": "Muitas tentativas. Tente novamente em instantes."}), 429, {"Retry-After": "60"}

            # Retrieve the student trying to log in (aceita RA ou nome de usuário)
            from peewee import fn
            student = (Students
                       .select()
                       .where((fn.LOWER(Students.ra) == ra.lower()) |
                              (fn.LOWER(Students.student_name) == ra.lower()))
                       .first())

            # Fase 4d (A5): a comparação em texto plano virou verificação por
            # hash. Senhas legadas do seed (texto plano) ainda são aceitas UMA
            # vez e imediatamente reescritas como hash (upgrade-on-login).
            password = login_data.get("password") or ""
            if not student or not verify_password(password, student.student_password):
                return "Wrong RA or Password", 401

            if not is_hashed(student.student_password):
                student.student_password = hash_password(password)
                student.save()

            # G.2 (Plano 2) — conquistas retroativas: no login, desbloqueia o que
            # o aluno já cumpre (ex.: dados anteriores à gamificação). Best-effort.
            try:
                from edubot.services.gamification import check_achievements
                check_achievements(student.student_id)
            except Exception:
                pass
            
            # Retrieve the student's course
            course = Courses.select().where(Courses.course_id == student.course_id).first()
            
            ids = {
                "course_id": course.course_id,
                "student_id": student.student_id
            }
            
            # MELHORIA (4.2): a signed session token is now returned along with the
            # IDs. The frontend stores it and sends "Authorization: Bearer <token>"
            # on subsequent requests, so protected routes know who is logged in.
            return json.dumps({
                "Message": "Logged successfully!",
                "ids": ids,
                "is_admin": student.is_admin,
                "role": getattr(student, "role", "aluno") or "aluno",
                "token": generate_token(student.student_id)
            }), 200
        # Handle errors and return the error description
        except PeeweeException as err:
            return json.dumps({"Error": f"{err}"}), 500
    else:
        # Return a message if the HTTP method is not POST
        return "Wrong Request Methods. Only POST Allowed", 405


# Plano 6 — "Esqueci minha senha". Não há e-mail cadastrado nem envio de e-mail
# na plataforma: o pedido vira um alerta para a coordenação/professor da turma
# (Minha turma), que gera uma senha temporária e a entrega ao aluno.
# A resposta é SEMPRE a mesma, exista a conta ou não (não revela quem é aluno).
FORGOT_TYPE = "redefinir_senha"


@app_login.route("/login/forgot-password", methods=["POST"])
@cross_origin()
def forgot_password():
    import datetime
    from peewee import fn
    from edubot.data.models.alerts import Alerts

    generic = json.dumps({"ok": True}), 202
    try:
        data = get_payload()
        ra = str(data.get("ra", "")).strip()
        if not ra:
            return json.dumps({"Error": "Informe seu RA ou usuário."}), 400
        if login_throttled(f"forgot:{ra}", request.remote_addr or "?"):
            return json.dumps({"Error": "Muitas tentativas. Tente novamente em instantes."}), 429, {"Retry-After": "60"}

        student = (Students
                   .select()
                   .where((fn.LOWER(Students.ra) == ra.lower()) |
                          (fn.LOWER(Students.student_name) == ra.lower()))
                   .first())
        if student is None:
            return generic
        pending = (Alerts
                   .select()
                   .where((Alerts.student_id == student) &
                          (Alerts.type == FORGOT_TYPE) &
                          (Alerts.read == False))
                   .exists())
        if not pending:
            Alerts.create(
                student_id=student, type=FORGOT_TYPE, severity="media",
                message=f"{student.student_name} (RA {student.ra}) pediu para redefinir a senha.",
                message_en=f"{student.student_name} (ID {student.ra}) asked to reset their password.",
                created_at=datetime.datetime.now(), read=False)
        return generic
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500
