# Import the necessary classes
from edubot.data.models.base import BaseModel
from edubot.data.models.courses import Courses
from peewee import *

# Class representing the subjects table
class Subjects(BaseModel):
    # Unique identifier for the subject
    subject_id = IntegerField(primary_key=True)
    # Name of the subject
    subject_name = TextField()
    # Plano 6 (migration_024): nome da matéria em inglês (fallback PT).
    subject_name_en = TextField(null=True)
    
    class Meta:
        # Specifies the table name in the database
        table_name = "course_subjects"
