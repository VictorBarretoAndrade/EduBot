from edubot.data.models.base import BaseModel
from edubot.data.models.students import Students
from peewee import *


class Interventions(BaseModel):
    intervention_id = IntegerField(primary_key=True)
    student_id = ForeignKeyField(Students, backref="interventions", on_delete="cascade", on_update="cascade")
    date = DateField()
    type = CharField(max_length=50)
    description = TextField(null=True)
    # Plano 6 (migration_024): mesma mensagem em inglês (lida com tr(), fallback PT).
    description_en = TextField(null=True)
    result = CharField(max_length=50, null=True)
