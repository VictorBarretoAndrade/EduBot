# Plano 6 — envio de certificado de curso externo (ex.: Cisco Networking Academy).
# Guarda só o RESULTADO da avaliação e uma impressão digital do arquivo (sha256):
# o PDF em si não é armazenado (minimização — LGPD/GDPR).
import datetime

from edubot.data.models.base import BaseModel
from edubot.data.models.resources import Resources
from edubot.data.models.students import Students
from peewee import *


class CertificateSubmissions(BaseModel):
    submission_id = AutoField()
    student_id = ForeignKeyField(Students, backref="certificate_submissions",
                                 on_delete="cascade", on_update="cascade")
    resource_id = ForeignKeyField(Resources, backref="certificate_submissions",
                                  on_delete="cascade", on_update="cascade")
    filename = CharField(max_length=255)
    sha256 = CharField(max_length=64)
    size_bytes = IntegerField()
    status = CharField(max_length=20)          # aprovado | recusado
    feedback = TextField(null=True)
    feedback_en = TextField(null=True)
    mock = BooleanField(default=True)          # avaliação simulada (sem LLM real)
    created_at = DateTimeField(default=datetime.datetime.now)

    class Meta:
        table_name = "certificate_submissions"
