"""Fixtures da suíte de testes do EduBot (A19).

Roda inteiramente em SQLite na memória (EDUBOT_DB=sqlite / :memory:), definido
ANTES de qualquer import do pacote — o base.py lê a config no import. Cada teste
recebe um banco limpo e semeado por `seeded_db`.
"""
import os

os.environ.setdefault("EDUBOT_DB", "sqlite")
os.environ.setdefault("EDUBOT_SQLITE_PATH", ":memory:")
os.environ.setdefault("EDUBOT_SECRET", "test-secret")

import pytest

from edubot.api.app import app as flask_app
from edubot.api.auth import generate_token
from edubot.data.models.base import db

from edubot.data.models.courses import Courses
from edubot.data.models.subjects import Subjects
from edubot.data.models.offerings import Offerings
from edubot.data.models.competencies import Competencies
from edubot.data.models.ovas import OVAs
from edubot.data.models.students import Students
from edubot.data.models.questions import Questions
from edubot.data.models.answers import Answers
from edubot.data.models.attempts import Attempts
from edubot.data.models.interactions import Interactions
from edubot.data.models.ova_progress import OVAProgress
from edubot.data.models.resource_progress import ResourceProgress
from edubot.data.models.resources import Resources
from edubot.data.models.interventions import Interventions
from edubot.data.models.personalized_ova import PersonalizedOVA, PersonalizedOVAItem
from edubot.data.models.alerts import Alerts

ALL_MODELS = [
    Courses, Subjects, Offerings, Competencies, OVAs, Students, Questions,
    Answers, Attempts, Interactions, OVAProgress, ResourceProgress, Resources,
    Interventions, PersonalizedOVA, PersonalizedOVAItem, Alerts,
]


def _seed():
    Courses.create(course_id=1, course_name="Curso X")
    Subjects.create(subject_id=1, subject_name="Assunto")
    Offerings.create(offering_id=1, course_id=1, subject_id=1)
    Competencies.create(competency_id=1, competency_description="Comp A", subject_id=1)
    OVAs.create(ova_id=1, ova_name="OVA 1", subject_id=1, num_interactions=0, link="a.html")
    Students.create(student_id=1, ra="111", student_password="111",
                    student_name="Ana Souza", course_id=1, is_admin=False, role="aluno")
    Students.create(student_id=2, ra="222", student_password="222",
                    student_name="Bia Lima", course_id=1, is_admin=False, role="aluno")
    Students.create(student_id=9, ra="999", student_password="999",
                    student_name="Tuto Tutor", course_id=1, is_admin=True, role="tutor")
    Questions.create(question_id=1, statement="2+2?",
                     alternatives={"alternatives": ["3", "4"]}, answer="b",
                     ova_id=1, competency_id=1)
    Questions.create(question_id=2, statement="3+3?",
                     alternatives={"alternatives": ["6", "7"]}, answer="a",
                     ova_id=1, competency_id=1)


@pytest.fixture()
def seeded_db():
    if db.is_closed():
        db.connect()
    db.drop_tables(ALL_MODELS, safe=True)
    db.create_tables(ALL_MODELS)
    _seed()
    yield db
    db.drop_tables(ALL_MODELS, safe=True)


@pytest.fixture()
def client(seeded_db):
    return flask_app.test_client()


@pytest.fixture()
def auth():
    def _headers(student_id=1):
        return {
            "Authorization": f"Bearer {generate_token(student_id)}",
            "Content-Type": "application/json",
        }
    return _headers
