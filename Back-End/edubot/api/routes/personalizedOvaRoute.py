# MELHORIA (OVA personalizada) — Rotas da OVA de reforço gerada pelo agente.
#
#   POST /edubot/personalized-ova   -> roda o agente EduBot (tool-use), que
#                                      diagnostica o assunto fraco do aluno
#                                      LOGADO, seleciona conteúdo do banco e
#                                      PERSISTE uma OVA personalizada.
#   GET  /personalized-ova          -> lista as OVAs personalizadas do aluno.
#   GET  /personalized-ova/<id>     -> conteúdo da OVA (recursos + questões),
#                                      no MESMO formato de /ova/<id>/resources e
#                                      /question/ova, para o frontend reaproveitar
#                                      os players e o quiz existentes.
#
# Todas exigem token (@require_auth). O aluno vem de g.student (nunca do
# payload), e o acesso a uma OVA personalizada é restrito ao seu dono.
import sys, os


from flask import Blueprint, g
from flask_cors import cross_origin
from peewee import PeeweeException
import json
import datetime

from edubot.data.models.competencies import Competencies
from edubot.data.models.questions import Questions
from edubot.data.models.answers import Answers
from edubot.data.models.resources import Resources
from edubot.data.models.resource_progress import ResourceProgress
from edubot.data.models.interventions import Interventions
from edubot.data.models.personalized_ova import PersonalizedOVA, PersonalizedOVAItem

from edubot.api.auth import require_auth
from edubot.api.http import get_lang
from edubot.i18n import tr
from edubot.services.student_context import build_student_profile
from edubot.agent import run_personalized_ova_agent

app_personalized_ova = Blueprint("personalized_ova", __name__)


# Aceita o JSONField tanto como dict (MySQL) quanto como string (SQLite dev),
# como em questionRoute (B9). Nunca expõe o gabarito ao cliente.
# Fase 4 (A12): serve alternatives_en quando lang="en" (mesma ordem do PT).
def _alternatives_list(question, lang="pt"):
    alternatives = question.alternatives
    if lang == "en" and question.alternatives_en:
        alternatives = question.alternatives_en
    if isinstance(alternatives, str):
        alternatives = json.loads(alternatives)
    return alternatives["alternatives"]


@app_personalized_ova.route("/edubot/personalized-ova", methods=["POST"])
@cross_origin()
@require_auth
def create_personalized_ova():
    try:
        # 1. Perfil completo do aluno logado (mesma entrada do EduBot 4.3)
        profile = build_student_profile(g.student)

        # 2. Agente de tool-use: diagnostica, busca conteúdo e monta a OVA
        result = run_personalized_ova_agent(g.student, profile)

        if not result.get("personalized_ova_id"):
            return json.dumps({
                "Error": "Não foi possível montar a OVA personalizada "
                         "(sem conteúdo de reforço para a competência fraca).",
                "detalhe": result.get("mensagem_final")
            }, default=str), 422

        pova = PersonalizedOVA.get_by_id(result["personalized_ova_id"])

        # 3. Registra no histórico de intervenções (consumido pelo painel)
        Interventions.create(
            student_id=g.student,
            date=datetime.date.today(),
            type="ova_personalizada",
            description=pova.message,
            result="pendente")

        return json.dumps({
            "personalized_ova_id": pova.personalized_ova_id,
            "titulo": pova.title,
            "mensagem_aluno": pova.message,
            "justificativa": pova.rationale,
            "target_competency_id": (pova.target_competency_id.competency_id
                                     if pova.target_competency_id else None),
            "itens_recursos": result["resultado"].get("itens_recursos", 0),
            "itens_questoes": result["resultado"].get("itens_questoes", 0),
            "mock": result.get("mock"),
            "model_id": result.get("model_id"),
        }, default=str), 201
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500


@app_personalized_ova.route("/personalized-ova", methods=["GET"])
@cross_origin()
@require_auth
def list_personalized_ovas():
    try:
        lang = get_lang()
        ovas = []
        for pova in (PersonalizedOVA
                     .select()
                     .where(PersonalizedOVA.student_id == g.student)
                     .order_by(PersonalizedOVA.created_at.desc())):
            comp = pova.target_competency_id
            ovas.append({
                "personalized_ova_id": pova.personalized_ova_id,
                "titulo": pova.title,
                "status": pova.status,
                "created_at": str(pova.created_at),
                "competencia": tr(comp.competency_description,
                                  comp.competency_description_en, lang) if comp else None,
            })
        return json.dumps(ovas, default=str), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500


@app_personalized_ova.route("/personalized-ova/<int:pova_id>", methods=["GET"])
@cross_origin()
@require_auth
def get_personalized_ova(pova_id):
    try:
        pova = PersonalizedOVA.get_or_none(
            (PersonalizedOVA.personalized_ova_id == pova_id) &
            (PersonalizedOVA.student_id == g.student))
        if pova is None:
            # 404 também quando é de outro aluno (não vaza existência)
            return json.dumps({"Error": "OVA personalizada não encontrada"}), 404

        lang = get_lang()
        items = (PersonalizedOVAItem
                 .select()
                 .where(PersonalizedOVAItem.personalized_ova_id == pova)
                 .order_by(PersonalizedOVAItem.position))

        recursos = []
        questoes = []
        for item in items:
            if item.item_kind == "resource" and item.resource_id is not None:
                resource = Resources.get_or_none(Resources.resource_id == item.resource_id)
                if resource is None:
                    continue
                rp = ResourceProgress.get_or_none(
                    (ResourceProgress.student_id == g.student) &
                    (ResourceProgress.resource_id == resource.resource_id))
                recursos.append({
                    "resource_id": resource.resource_id,
                    "resource_type": resource.resource_type,
                    "resource_title": tr(resource.resource_title, resource.resource_title_en, lang),
                    "resource_url": resource.resource_url,
                    "media_type": resource.media_type,
                    "duration_seconds": resource.duration_seconds,
                    "perc_consumed": rp.perc_consumed if rp else 0,
                    "seconds_consumed": rp.seconds_consumed if rp else 0,
                    "completed": bool(rp.completed) if rp else False,
                })
            elif item.item_kind == "question" and item.question_id is not None:
                question = Questions.get_or_none(Questions.question_id == item.question_id)
                if question is None:
                    continue
                answered = (Answers
                            .select()
                            .where((Answers.student_id == g.student) &
                                   (Answers.question_id == question.question_id))
                            .exists())
                questoes.append({
                    "question_id": question.question_id,
                    "statement": tr(question.statement, question.statement_en, lang),
                    "alternatives": _alternatives_list(question, lang),
                    "answered": answered,
                    "competency_id": question.competency_id.competency_id,
                })

        comp = pova.target_competency_id
        return json.dumps({
            "personalized_ova_id": pova.personalized_ova_id,
            "titulo": pova.title,
            "mensagem_aluno": pova.message,
            "justificativa": pova.rationale,
            "status": pova.status,
            "created_at": str(pova.created_at),
            "competencia": {
                "competency_id": comp.competency_id,
                "nome": tr(comp.competency_description,
                           comp.competency_description_en, lang),
            } if comp else None,
            "recursos": recursos,
            "questoes": questoes,
        }, default=str), 200
    except PeeweeException as err:
        return json.dumps({"Error": f"{err}"}), 500
