from edubot.data.models.base import BaseModel
from edubot.data.models.students import Students
from edubot.data.models.resources import Resources
from peewee import *
import datetime


# MELHORIA (4.1): per-student consumption of an individual resource.
# - video:   perc_consumed = % watched, completed when it reaches ~90%
# - podcast: seconds_consumed = listening time, perc_consumed derived from duration
# - atividade: completed set explicitly by the student ("Concluir" button)
# One row per (student, resource), upserted by POST /progress/resource.
class ResourceProgress(BaseModel):
    resource_progress_id = AutoField()
    student_id = ForeignKeyField(Students, backref="resource_progress", on_delete="cascade", on_update="cascade")
    resource_id = ForeignKeyField(Resources, backref="progress", on_delete="cascade", on_update="cascade")
    perc_consumed = IntegerField(default=0)      # 0-100
    seconds_consumed = IntegerField(default=0)   # listening/watching time in seconds
    completed = BooleanField(default=False)
    last_access = DateTimeField(default=datetime.datetime.now)

    class Meta:
        # Nome explícito: o default do Peewee seria "resourceprogress", mas o
        # DDL (ddl_extra.sql) cria "resource_progress"
        table_name = "resource_progress"
        indexes = (
            (("student_id", "resource_id"), True),  # unique pair
        )
