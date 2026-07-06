# Import necessary libraries
from flask import Blueprint, request, g
from flask_cors import cross_origin
from edubot.api.http import get_payload
from peewee import PeeweeException # ORM library
import json

# Import the necessary ORM classes
from edubot.data.models.questions import Questions
from edubot.data.models.answers import Answers
from edubot.data.models.attempts import Attempts

from edubot.api.auth import require_auth
from edubot.api.http import get_lang
from edubot.i18n import tr
from edubot.services.proactivity import trigger_evaluation

# Create a route blueprint as a reusable component
app_question = Blueprint("question", __name__)


# BUGFIX: the MySQL JSONField returns a dict, but under the SQLite dev fallback
# (see data/models/base.py) the same column comes back as a raw string, which
# crashed these routes locally. Accept both representations.
# Fase 4 (A12): com lang="en" e tradução disponível, serve alternatives_en —
# na MESMA ordem do PT, então o gabarito por letra continua válido.
def _alternatives_list(question, lang="pt"):
    alternatives = question.alternatives
    if lang == "en" and question.alternatives_en:
        alternatives = question.alternatives_en
    if isinstance(alternatives, str):
        alternatives = json.loads(alternatives)
    return alternatives["alternatives"]

# Return all the questions from the database
@app_question.route("/question/all", methods=["GET"])
# Activate cross-origin to accept requests from another domain
@cross_origin()
def show_all_questions():
    if request.method == "GET":
        try:
            # Get all the questions
            questions = Questions.select()
            question_list = []
            # For each question, append its id, statement and alternatives.
            # BUGFIX (B9): the correct answer is no longer sent to the client —
            # grading is done server-side in /question/answer.
            for question in questions:
                question_dict = {
                    "question_id": question.question_id,
                    "statement": question.statement,
                    "alternatives": _alternatives_list(question)
                }
                question_list.append(question_dict.copy())
            # Return the result array
            return json.dumps(question_list)
        except PeeweeException as err:
            # Handle the error by returning the description of the error
            return json.dumps({"Error": f"{err}"}), 500
    else:
        # Return this if the HTTP method is not GET
        return "Wrong Request Methods. Only GET Allowed", 405

# Given an OVA, return all the questions of this OVA
@app_question.route("/question/ova", methods=["POST"])
# Activate cross-origin to accept requests from another domain
@cross_origin()
# A3/B4: exige token. Antes a rota aceitava student_id do payload e revelava
# quais questões QUALQUER aluno já tinha acertado. Agora o aluno vem do token.
@require_auth
def show_ova_questions():
    if request.method == "POST":
        try:
            question_data = get_payload()
            lang = get_lang()
            # Get all the questions of the given OVA
            questions = Questions.select().where(Questions.ova_id == question_data["ova_id"])
            questions_ids = [question.question_id for question in questions]

            # Quais dessas questões o aluno LOGADO já acertou (do token, não do payload)
            answers_ids = Answers.select(Answers.question_id).where(Answers.student_id == g.student, Answers.question_id.in_(questions_ids))
            answers_ids = [id.question_id.question_id for id in answers_ids]

            question_list = []
            # For each question, append its id, statement, alternatives,
            # whether it was already answered, and the competency it works.
            # BUGFIX (B5/B9): the "answer" field (the correct alternative) used to be
            # shipped to the browser and rendered into a data-correct attribute,
            # exposing the answer key in the DOM. The quiz is now graded by the
            # backend (see /question/answer below).
            for question in questions:
                question_dict = {
                    "question_id": question.question_id,
                    "statement": tr(question.statement, question.statement_en, lang),
                    "alternatives": _alternatives_list(question, lang),
                    "answered": question.question_id in answers_ids,
                    "competency_id": question.competency_id.competency_id
                }
                question_list.append(question_dict.copy())
            # Return the result array
            return json.dumps(question_list)
        except PeeweeException as err:
            # Handle the error by returning the description of the error
            return json.dumps({"Error": f"{err}"}), 500
    else:
        # Return this if the HTTP method is not POST
        return "Wrong Request Methods. Only POST Allowed", 405

# Grades an answer sent by the student and records the attempt.
@app_question.route("/question/answer", methods=['POST'])
@cross_origin()
# A3: exige token. Antes gravava attempts em nome de QUALQUER student_id do
# payload (forjável anonimamente por curl), inflando a taxa_erro de outro aluno.
@require_auth
def answer_question():
    if request.method == 'POST':
        try:
            answer_data = get_payload()

            student = g.student  # A3: do token, não do payload
            question = Questions.select().where(Questions.question_id == answer_data["question_id"]).first()
            if question is None:
                return json.dumps({"Error": "Unknown question_id"}), 400

            # BUGFIX (B5): grading used to happen in the browser (the client sent
            # an "is_correct" flag computed against a data-correct DOM attribute).
            # The selected alternative is now compared with the stored answer here,
            # so the answer key never leaves the server and the result can't be forged.
            selected = str(answer_data.get("selected", "")).strip().lower()
            is_correct = selected == str(question.answer).strip().lower()

            # A7 — idempotência: o front reenviava TODAS as questões a cada clique
            # em "Verificar", e cada clique gravava um Attempt novo (dois cliques =
            # tentativas em dobro, distorcendo a taxa_erro). Se o aluno já ACERTOU
            # esta questão (existe em `answers`) e reenvia a mesma resposta correta,
            # não registramos uma nova tentativa. Retentativas reais (mudar a
            # resposta / tentar de novo após errar) continuam contando.
            already_correct = Answers.select().where(
                Answers.question_id == question.question_id,
                Answers.student_id == student.student_id
            ).first()

            if not (is_correct and already_correct is not None):
                # IMPROVEMENT (Passo 3): tentativas (certas/erradas) alimentam a
                # regra do EduBot "errou mais de 50% do quiz".
                Attempts.create(
                    student_id = student,
                    question_id = question,
                    is_correct = is_correct
                )

            # Keep the original behavior: store the first correct answer in "answers"
            if is_correct and already_correct is None:
                Answers.create(
                    student_id = student,
                    question_id = question
                )

            # A13 — proatividade por evento: um erro é o sinal de risco. O agente
            # avalia as regras do aluno na hora e, se for o caso, cria uma
            # intervenção/alerta automaticamente (o EduBot "fala primeiro"),
            # sem esperar o aluno clicar em "recomendação". Best-effort: nunca
            # quebra a correção do quiz.
            if not is_correct:
                trigger_evaluation(student, lang=get_lang())

            # The frontend uses this flag to show "Correct!"/"Incorrect."
            return json.dumps({"is_correct": is_correct}), 200
        except PeeweeException as err:
            # Handle the error by returning the description of the error
            return json.dumps({"Error": f"{err}"}), 500
    else:
        # Return this if the HTTP method is not POST
        return "Wrong Request Methods. Only POST Allowed", 405
