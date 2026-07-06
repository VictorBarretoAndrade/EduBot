# MELHORIA (Roteiro Cena 4) — Painel do Tutor + Central de Alertas.
#
#   GET  /tutor/turma     -> alunos (com atividade) do curso do tutor + KPIs
#   GET  /tutor/alerts    -> alertas preventivos da turma
#   POST /tutor/evaluate  -> roda as regras do EduBot sobre a turma, gerando
#                            intervenções e alertas para alunos em risco
#
# Todas exigem token (@require_auth) E papel de tutor/admin (g.student.role).
from flask import Blueprint, g
from flask_cors import cross_origin
from peewee import PeeweeException, fn
import json

from edubot.data.models.students import Students
from edubot.data.models.ova_progress import OVAProgress
from edubot.data.models.attempts import Attempts
from edubot.data.models.alerts import Alerts

from edubot.api.auth import require_auth
from edubot.services.proactivity import evaluate_student, active_student_ids
# A15: inatividade vem da fonte única (multi-sinal). A cópia local antiga só
# olhava `interactions` — um aluno que lia e respondia quiz todo dia aparecia
# como "inativo" no painel do tutor.
from edubot.services.student_context import _days_without_access

app_tutor = Blueprint("tutor", __name__)

# Máximo de alunos avaliados por requisição (proteção: o curso de exemplo tem 500)
MAX_TURMA = 60


def _is_tutor():
    role = getattr(g.student, "role", "aluno") or "aluno"
    return role in ("tutor", "admin") or bool(g.student.is_admin)


def _turma_students():
    course_id = g.student.course_id
    active = active_student_ids()  # fonte única (edubot.services.proactivity)
    if not active:
        return []
    query = (Students
             .select()
             .where((Students.course_id == course_id) &
                    (Students.student_id.in_(list(active))) &
                    (Students.role == "aluno"))
             .limit(MAX_TURMA))
    return list(query)


def _student_summary(student):
    consumo = (OVAProgress
               .select(fn.AVG(OVAProgress.perc_scrolled))
               .where(OVAProgress.student_id == student)
               .scalar())
    total = Attempts.select().where(Attempts.student_id == student).count()
    wrong = (Attempts
             .select()
             .where((Attempts.student_id == student) & (Attempts.is_correct == False))
             .count())
    abertos = (Alerts
               .select()
               .where((Alerts.student_id == student) & (Alerts.read == False))
               .count())
    return {
        "student_id": student.student_id,
        "nome": student.student_name,
        "ra": student.ra,
        "dias_sem_acesso": _days_without_access(student),
        "consumo_percentual": int(consumo) if consumo is not None else 0,
        "taxa_erro": round(wrong / total, 2) if total else None,
        "alertas_abertos": abertos,
    }


@app_tutor.route("/tutor/turma", methods=["GET"])
@cross_origin()
@require_auth
def tutor_turma():
    if not _is_tutor():
        return json.dumps({"Error": "Acesso restrito a tutores."}), 403
    try:
        alunos = [_student_summary(s) for s in _turma_students()]
        # ordena por mais críticos primeiro (mais alertas, depois menos consumo)
        alunos.sort(key=lambda a: (-a["alertas_abertos"], a["consumo_percentual"]))
        return json.dumps({"total": len(alunos), "alunos": alunos}, default=str), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500


@app_tutor.route("/tutor/alerts", methods=["GET"])
@cross_origin()
@require_auth
def tutor_alerts():
    if not _is_tutor():
        return json.dumps({"Error": "Acesso restrito a tutores."}), 403
    try:
        course_id = g.student.course_id
        rows = (Alerts
                .select(Alerts, Students)
                .join(Students)
                .where(Students.course_id == course_id)
                .order_by(Alerts.created_at.desc())
                .limit(50))
        out = [{
            "alert_id": a.alert_id,
            "student_id": a.student_id.student_id,
            "aluno": a.student_id.student_name,
            "type": a.type,
            "message": a.message,
            "severity": a.severity,
            "created_at": str(a.created_at),
            "read": bool(a.read),
        } for a in rows]
        return json.dumps({"alertas": out}, default=str), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500


@app_tutor.route("/tutor/evaluate", methods=["POST"])
@cross_origin()
@require_auth
def tutor_evaluate():
    if not _is_tutor():
        return json.dumps({"Error": "Acesso restrito a tutores."}), 403
    try:
        # Mesma avaliação usada pelos gatilhos por evento (fonte única): perfil
        # -> regras -> intervenção/alerta deduplicados. Aqui varre a turma.
        criados = 0
        for student in _turma_students():
            if evaluate_student(student) is not None:
                criados += 1
        return json.dumps({"alertas_criados": criados}), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500
