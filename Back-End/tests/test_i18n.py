"""Fase 4 (A12) — conteúdo servido no idioma pedido, com fallback PT."""
import json

from edubot.data.models.ovas import OVAs
from edubot.data.models.questions import Questions
from edubot.i18n import norm_lang, tr


def test_tr_helper():
    assert tr("Cálculo", "Calculus", "en") == "Calculus"
    assert tr("Cálculo", "Calculus", "pt") == "Cálculo"
    assert tr("Cálculo", None, "en") == "Cálculo"      # fallback PT
    assert norm_lang("EN") == "en"
    assert norm_lang("xx") == "pt"
    assert norm_lang(None) == "pt"


def _seed_translations():
    OVAs.update(ova_name_en="OVA One").where(OVAs.ova_id == 1).execute()
    Questions.update(
        statement_en="What is 2+2?",
        alternatives_en={"alternatives": ["3", "4"]},
    ).where(Questions.question_id == 1).execute()


def test_profile_serves_lang(client, auth, seeded_db):
    _seed_translations()
    r_pt = client.get("/student/me", headers=auth(1))
    r_en = client.get("/student/me?lang=en", headers=auth(1))
    pt = json.loads(r_pt.data.decode())
    en = json.loads(r_en.data.decode())
    assert pt["ovas"][0]["ova_name"] == "OVA 1"
    assert en["ovas"][0]["ova_name"] == "OVA One"


def test_questions_served_in_lang_with_fallback(client, auth, seeded_db):
    _seed_translations()
    r = client.post("/question/ova?lang=en", headers=auth(1),
                    data=json.dumps({"ova_id": 1}))
    questions = {q["question_id"]: q for q in json.loads(r.data.decode())}
    # q1 tem tradução; q2 não (fallback PT)
    assert questions[1]["statement"] == "What is 2+2?"
    assert questions[2]["statement"] == "3+3?"


def test_grading_unaffected_by_lang(client, auth, seeded_db):
    _seed_translations()
    # As alternativas EN mantêm a ordem do PT — a letra "b" continua correta.
    r = client.post("/question/answer?lang=en", headers=auth(1),
                    data=json.dumps({"question_id": 1, "selected": "b"}))
    assert json.loads(r.data.decode())["is_correct"] is True


def test_agent_mock_responds_in_lang():
    # Fase 4c: as 6 regras do mock respondem no idioma do aluno; a
    # justificativa (para o professor) permanece em PT.
    from edubot.agent import get_recommendation
    profile = {
        "estudante": {"nome": "Ana Souza"},
        "dias_sem_acesso": 30,  # dispara a Regra 1
        "recursos": {"percentual_consumido": 0},
        "quiz": {"taxa_erro": None},
        "atividades_pendentes": 0,
        "competencias": [],
    }
    rec_pt = get_recommendation(profile, lang="pt")
    rec_en = get_recommendation(profile, lang="en")
    assert rec_pt["tipo"] == rec_en["tipo"] == "plano_retomada"
    assert "Sentimos sua falta" in rec_pt["mensagem_aluno"]
    assert "missed you" in rec_en["mensagem_aluno"]
    assert rec_en["justificativa"].startswith("Regra 1")  # professor: PT


def test_tutor_mock_responds_in_lang():
    from edubot.agent.tutor import tutor_reply
    context = "## Qubits\nUm qubit pode estar em superposicao de estados."
    messages = [{"role": "user", "content": "o que e um qubit em superposicao?"}]
    pt = tutor_reply("OVA Q", context, messages, lang="pt")
    en = tutor_reply("OVA Q", context, messages, lang="en")
    assert "Boa pergunta" in pt["reply"]
    assert "Great question" in en["reply"]


def test_event_intervention_created_in_request_lang(client, auth, seeded_db):
    from edubot.data.models.interventions import Interventions
    # Erro no quiz com UI em EN -> intervenção redigida em inglês.
    client.post("/question/answer?lang=en", headers=auth(1),
                data=json.dumps({"question_id": 1, "selected": "a"}))
    it = Interventions.select().where(Interventions.student_id == 1).first()
    assert it is not None
    # Regra 2 (trilha mínima) dispara para perfil zerado. Plano 6: a mensagem é
    # gravada nos dois idiomas — EN na coluna _en, PT na original.
    assert "resources" in it.description_en or "you" in it.description_en.lower()
    assert it.description and it.description != it.description_en

    # E a API devolve cada idioma a quem pede.
    en = json.loads(client.get("/edubot/interventions?lang=en", headers=auth(1)).data)
    pt = json.loads(client.get("/edubot/interventions?lang=pt", headers=auth(1)).data)
    assert en["interventions"][0]["descricao"] == it.description_en
    assert pt["interventions"][0]["descricao"] == it.description


def test_profile_groups_modules_by_subject_in_lang(seeded_db):
    """Plano 6 (B.4): cada módulo do perfil traz a matéria, traduzida."""
    from edubot.data.models.students import Students
    from edubot.data.models.subjects import Subjects
    from edubot.services.student_context import build_student_profile
    Subjects.update(subject_name_en="Topic").execute()
    student = Students.get_by_id(1)
    en = build_student_profile(student, lang="en")
    pt = build_student_profile(student, lang="pt")
    assert {o["subject_nome"] for o in en["ovas"]} == {"Topic"}
    assert all(o["subject_id"] is not None for o in en["ovas"])
    assert pt["ovas"][0]["subject_nome"] != "Topic"           # PT continua PT
    assert {c["subject_nome"] for c in en["competencias"]} == {"Topic"}


def test_tutor_alert_message_follows_lang(client, auth, seeded_db):
    """Plano 6 (T4): o alerta ao professor é gravado em PT e EN e servido no idioma pedido."""
    import datetime
    from edubot.data.models.alerts import Alerts
    Alerts.create(student_id=1, type="inatividade", message="Ana sumiu", message_en="Ana is inactive",
                  severity="alta", created_at=datetime.datetime.now(), read=False)
    en = json.loads(client.get("/tutor/alerts?lang=en", headers=auth(9)).data)
    pt = json.loads(client.get("/tutor/alerts?lang=pt", headers=auth(9)).data)
    assert en["alertas"][0]["message"] == "Ana is inactive"
    assert pt["alertas"][0]["message"] == "Ana sumiu"
