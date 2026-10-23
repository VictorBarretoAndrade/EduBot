# Plano 6 — cursos externos com certificado (ex.: Cisco Networking Academy).
#
#   GET  /external-courses                  -> cursos externos do curso do aluno + último envio
#   POST /resource/<id>/certificate (PDF)   -> avalia o certificado e, se aprovado,
#                                              conclui o recurso no progresso do aluno
#
# O aluno vem do token (g.student). O PDF não é guardado: só o resultado e o sha256.

import datetime
import hashlib
import json

from flask import Blueprint, g, request
from flask_cors import cross_origin
from peewee import PeeweeException

from edubot.api.auth import require_auth
from edubot.api.http import get_lang
from edubot.data.models.certificate_submissions import CertificateSubmissions
from edubot.data.models.offerings import Offerings
from edubot.data.models.ovas import OVAs
from edubot.data.models.resource_progress import ResourceProgress
from edubot.data.models.resources import Resources
from edubot.i18n import tr
from edubot.services.certificates import MAX_BYTES, evaluate_certificate
from edubot.services.events import emit as emit_event

app_certificate = Blueprint("certificate", __name__)

EXTERNAL_COURSE = "curso_externo"


def _submission_dict(sub, lang):
    if sub is None:
        return {"status": None, "feedback": None, "enviado_em": None}
    return {
        "status": sub.status,
        "feedback": tr(sub.feedback, sub.feedback_en, lang),
        "enviado_em": str(sub.created_at),
        "mock": bool(sub.mock),
    }


def _latest_submission(student, resource_id):
    return (CertificateSubmissions
            .select()
            .where((CertificateSubmissions.student_id == student) &
                   (CertificateSubmissions.resource_id == resource_id))
            .order_by(CertificateSubmissions.submission_id.desc())
            .first())


def _course_resources(student):
    course = student.course_id
    course_id = course.course_id if course else None
    return (Resources
            .select(Resources, OVAs)
            .join(OVAs, on=(Resources.ova_id == OVAs.ova_id))
            .join(Offerings, on=(Offerings.subject_id == OVAs.subject_id))
            .where((Offerings.course_id == course_id) &
                   (Resources.resource_type == EXTERNAL_COURSE))
            .order_by(Resources.resource_id))


@app_certificate.route("/external-courses", methods=["GET"])
@cross_origin()
@require_auth
def external_courses():
    try:
        lang = get_lang()
        out = []
        for r in _course_resources(g.student):
            out.append({
                "resource_id": r.resource_id,
                "ova_id": r.ova_id.ova_id,
                "titulo": tr(r.resource_title, r.resource_title_en, lang),
                "url": tr(r.resource_url, r.resource_url_en, lang),
                "competency_id": r.competency_id.competency_id if r.competency_id else None,
                "certificado": _submission_dict(_latest_submission(g.student, r.resource_id), lang),
            })
        return json.dumps(out, default=str), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500


@app_certificate.route("/resource/<int:resource_id>/certificate", methods=["POST"])
@cross_origin()
@require_auth
def submit_certificate(resource_id):
    lang = get_lang()
    resource = Resources.get_or_none(Resources.resource_id == resource_id)
    if resource is None or resource.resource_type != EXTERNAL_COURSE:
        return json.dumps({"Error": "Recurso não aceita certificado."}), 404
    upload = request.files.get("file")
    if upload is None:
        return json.dumps({"Error": "Envie o PDF no campo 'file'."}), 400
    data = upload.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return json.dumps({"Error": "O PDF passa de 5 MB."}), 413

    try:
        # O nome do curso em inglês é o que aparece no certificado da Cisco.
        course_title = (resource.resource_title_en or resource.resource_title).split(":")[-1].strip()
        result = evaluate_certificate(data, upload.filename or "", course_title)
        sub = CertificateSubmissions.create(
            student_id=g.student, resource_id=resource,
            filename=(upload.filename or "certificado.pdf")[:255],
            sha256=hashlib.sha256(data).hexdigest(), size_bytes=len(data),
            status=result["status"], feedback=result["feedback"],
            feedback_en=result["feedback_en"], mock=result["mock"])

        if result["status"] == "aprovado":
            now = datetime.datetime.now()
            rp = ResourceProgress.get_or_none(
                (ResourceProgress.student_id == g.student) &
                (ResourceProgress.resource_id == resource))
            if rp is None:
                ResourceProgress.create(student_id=g.student, resource_id=resource,
                                        perc_consumed=100, seconds_consumed=0,
                                        completed=True, last_access=now)
            else:
                rp.perc_consumed, rp.completed, rp.last_access = 100, True, now
                rp.save()
            emit_event(g.student, "completed", "resource", resource.resource_id,
                       kind="certificate")

        return json.dumps(_submission_dict(sub, lang), default=str), 201
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500
