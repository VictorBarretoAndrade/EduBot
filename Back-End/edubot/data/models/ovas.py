# Import the necessary classes
from edubot.data.models.base import BaseModel
from edubot.data.models.subjects import Subjects
from peewee import *

# Class representing the OVAs table
class OVAs(BaseModel):
    # Unique identifier for the OVA
    ova_id = IntegerField(primary_key=True)
    # Name of the OVA
    ova_name = TextField()
    # Tradução EN (Fase 4 — A12); NULL cai no PT (degradação segura)
    ova_name_en = TextField(null=True)
    # Foreign key referencing the subject to which the OVA belongs
    subject_id = ForeignKeyField(Subjects, backref="ovas", on_delete="cascade", on_update="cascade")
    num_interactions = IntegerField()
    # HTML link to the OVA page
    link = TextField()
    
