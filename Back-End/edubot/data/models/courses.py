# Import the necessary classes
from edubot.data.models.base import BaseModel
from peewee import *  # ORM

# Class representing the courses table
class Courses(BaseModel):
    # Unique identifier for the course
    course_id = IntegerField(primary_key=True)
    # Name of the course as a text field
    course_name = TextField()
    # Plano 6 (migration_024): nome do curso em inglês (fallback PT).
    course_name_en = TextField(null=True)
