from edubot.data.models.base import BaseModel
from edubot.data.models.students import Students
from peewee import *


# MELHORIA (Roteiro Cena 4) — Alertas preventivos para o tutor.
# Cada linha é um aviso gerado quando um aluno entra em zona de risco (regra do
# EduBot disparada). Alimenta a Central de Alertas do painel do tutor.
class Alerts(BaseModel):
    alert_id = IntegerField(primary_key=True)
    student_id = ForeignKeyField(Students, backref="alerts", on_delete="cascade", on_update="cascade")
    type = CharField(max_length=50)
    message = TextField()
    severity = CharField(max_length=20)        # alta | media | baixa
    created_at = DateTimeField()
    read = BooleanField(default=False)

    class Meta:
        table_name = "alerts"
