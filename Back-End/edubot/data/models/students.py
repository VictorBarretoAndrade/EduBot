# Import the necessary classes
from edubot.data.models.base import BaseModel
from edubot.data.models.courses import Courses
from peewee import *

# Class representing the students table
class Students(BaseModel):
    # Unique identifier for the student
    student_id = IntegerField(primary_key=True)
    # Registration number of the student (RA)
    ra = TextField()
    # Password for the student's account
    student_password = TextField()
    # Name of the student
    student_name = TextField()
    # Foreign key referencing the course to which the student belongs
    course_id = ForeignKeyField(Courses, backref="students", on_delete="cascade", on_update="cascade")
    # Indicates if the student is an administrator (coordinator) or a regular student
    is_admin = BooleanField()
    # MELHORIA (Roteiro Cena 4): papel do usuário — 'aluno' | 'tutor' | 'admin'.
    # Habilita o Painel do Tutor (gestão pedagógica). Default 'aluno'.
    role = CharField(default="aluno")
    # G.4/R.2 (Plano 2): apelido público no ranking (opt-in) e título ativo
    # concedido por conquistas. Nulos até o aluno participar/escolher.
    nickname = CharField(max_length=40, null=True)
    title = CharField(max_length=40, null=True)
    # AV.2 (Plano 3): persona do companheiro de estudo escolhido pelo aluno
    # ('edubot' | 'einstein' | 'curie'). Antes só em localStorage.
    persona = CharField(max_length=24, default="edubot")
    # Migration 026: identidade Google (sub = id estável; e-mail só exibição) e
    # dono do workspace DEMO (o coordenador aponta para si). IntegerField sem FK
    # de propósito: ler o campo não pode disparar query (contrato do /student/me).
    email = CharField(max_length=254, null=True)
    google_sub = CharField(max_length=64, null=True, unique=True)
    demo_owner_id = IntegerField(null=True)
    # 'coordenador' | 'aluno_teste' | 'exemplo' | 'criado' (NULL = conta real).
    demo_kind = CharField(max_length=20, null=True)
