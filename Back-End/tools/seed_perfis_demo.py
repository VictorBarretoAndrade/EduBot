# -*- coding: utf-8 -*-
import datetime
import sys
import os

# Garante edubot no sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from edubot.data.models.base import db
from edubot.data.models.students import Students
from edubot.data.models.questions import Questions
from edubot.data.models.answers import Answers
from edubot.data.models.attempts import Attempts
from edubot.data.models.ova_progress import OVAProgress
from edubot.data.models.resource_progress import ResourceProgress
from edubot.data.models.interactions import Interactions
from edubot.data.models.learning_events import LearningEvents
from edubot.data.models.student_mastery import StudentMastery
from edubot.data.models.student_mastery_history import StudentMasteryHistory
from edubot.data.models.student_streak import StudentStreak
from edubot.data.models.student_achievements import StudentAchievements
from edubot.data.models.xp_events import XpEvents
from edubot.data.models.review_schedule import ReviewSchedule
from edubot.data.models.alerts import Alerts
from edubot.data.models.interventions import Interventions
from edubot.data.models.personalized_ova import PersonalizedOVA, PersonalizedOVAItem

def seed():
    print("Iniciando população dos perfis com codificação UTF-8 correta...")
    
    target_ids = [1, 3, 5, 6]
    
    with db.atomic():
        # Limpeza
        PersonalizedOVAItem.delete().where(PersonalizedOVAItem.personalized_ova_id.in_(
            PersonalizedOVA.select(PersonalizedOVA.personalized_ova_id).where(PersonalizedOVA.student_id.in_(target_ids))
        )).execute()
        PersonalizedOVA.delete().where(PersonalizedOVA.student_id.in_(target_ids)).execute()
        Alerts.delete().where(Alerts.student_id.in_(target_ids)).execute()
        Interventions.delete().where(Interventions.student_id.in_(target_ids)).execute()
        ReviewSchedule.delete().where(ReviewSchedule.student_id.in_(target_ids)).execute()
        Attempts.delete().where(Attempts.student_id.in_(target_ids)).execute()
        Answers.delete().where(Answers.student_id.in_(target_ids)).execute()
        OVAProgress.delete().where(OVAProgress.student_id.in_(target_ids)).execute()
        ResourceProgress.delete().where(ResourceProgress.student_id.in_(target_ids)).execute()
        Interactions.delete().where(Interactions.student_id.in_(target_ids)).execute()
        LearningEvents.delete().where(LearningEvents.student_id.in_(target_ids)).execute()
        StudentMastery.delete().where(StudentMastery.student_id.in_(target_ids)).execute()
        StudentMasteryHistory.delete().where(StudentMasteryHistory.student_id.in_(target_ids)).execute()
        StudentAchievements.delete().where(StudentAchievements.student_id.in_(target_ids)).execute()
        StudentStreak.delete().where(StudentStreak.student_id.in_(target_ids)).execute()
        XpEvents.delete().where(XpEvents.student_id.in_(target_ids)).execute()
        
        # Alunos
        Students.update(student_name="Eduardo", student_password="1", role="aluno", title="Mestre").where(Students.student_id == 1).execute()
        Students.update(student_name="Gabriel", student_password="2", role="tutor").where(Students.student_id == 2).execute()
        Students.update(student_name="Yasmin", student_password="3", role="aluno", title=None).where(Students.student_id == 3).execute()
        Students.update(student_name="Sanval", student_password="4", role="admin", is_admin=True).where(Students.student_id == 4).execute()
        Students.update(student_name="Pedro", student_password="5", role="aluno", title=None).where(Students.student_id == 5).execute()
        Students.update(student_name="Thiago", student_password="6", role="aluno", title=None).where(Students.student_id == 6).execute()

    today = datetime.date.today()
    now = datetime.datetime.now()

    # =========================================================================
    # PERFIL 1: EDUARDO (RA 1) - ALUNO COM BOM DESEMPENHO
    # =========================================================================
    s1_id = 1
    OVAProgress.create(student_id=s1_id, ova_id=1, read_time=1800, perc_scrolled=100, completed=True, last_access=now - datetime.timedelta(hours=2))
    OVAProgress.create(student_id=s1_id, ova_id=2, read_time=1500, perc_scrolled=100, completed=True, last_access=now - datetime.timedelta(days=1))
    OVAProgress.create(student_id=s1_id, ova_id=4, read_time=1200, perc_scrolled=90, completed=True, last_access=now)

    for r_id in [1, 2, 3, 7, 8, 29, 30]:
        ResourceProgress.create(
            student_id=s1_id, resource_id=r_id, perc_consumed=100, seconds_consumed=400,
            completed=True, last_access=now - datetime.timedelta(hours=3),
            watched_seconds=400, coverage_perc=100
        )
        
    s1_attempts = []
    for qid in range(1, 10):
        s1_attempts.append((qid, True, now - datetime.timedelta(days=4, hours=qid)))
        Answers.create(student_id=s1_id, question_id=qid)
        
    for qid in range(10, 18):
        s1_attempts.append((qid, True, now - datetime.timedelta(days=2, hours=qid)))
        Answers.create(student_id=s1_id, question_id=qid)
    s1_attempts.append((18, False, now - datetime.timedelta(days=2)))
    
    for qid in range(27, 33):
        s1_attempts.append((qid, True, now - datetime.timedelta(hours=qid-26)))
        Answers.create(student_id=s1_id, question_id=qid)
        
    for qid, correct, t in s1_attempts:
        Attempts.create(student_id=s1_id, question_id=qid, is_correct=correct, attempt_time=t)
        
    Interactions.create(interaction_date=today, interaction_time=now.time(), student_action="ova_concluded", student_id=s1_id, ova_id=4)
    Interactions.create(interaction_date=today - datetime.timedelta(days=1), interaction_time=now.time(), student_action="quiz_concluded", student_id=s1_id, ova_id=2)
    LearningEvents.create(student_id=s1_id, verb="login", object_type="session", occurred_at=now - datetime.timedelta(hours=2))

    masteries_s1 = [
        (1, 0.95, 4), (2, 0.92, 3), (3, 0.88, 3),
        (4, 0.86, 3), (5, 0.84, 3), (6, 0.79, 3),
        (7, 0.94, 2), (8, 0.90, 2), (9, 0.91, 2)
    ]
    for cid, val, atts in masteries_s1:
        StudentMastery.create(student_id=s1_id, competency_id=cid, p_mastery=val, attempts_seen=atts, updated_at=now)
        for days_ago, hist_val in [(14, 0.35), (7, 0.65), (2, val - 0.05), (0, val)]:
            StudentMasteryHistory.create(
                student_id=s1_id, competency_id=cid,
                snapshot_date=today - datetime.timedelta(days=days_ago),
                p_mastery=hist_val
            )

    StudentStreak.create(student_id=s1_id, current_days=5, best_days=7, last_activity_date=today, shield_used_on=None)
    for ach in ["primeiro_modulo", "revisor_pontual", "mestre_competencia", "trilha_completa"]:
        StudentAchievements.create(student_id=s1_id, achievement_id=ach, unlocked_at=now - datetime.timedelta(days=1))
        
    for i in range(5):
        XpEvents.create(student_id=s1_id, rule="dia_de_estudo", points=10, awarded_on=today - datetime.timedelta(days=i), created_at=now - datetime.timedelta(days=i))
    XpEvents.create(student_id=s1_id, rule="modulo_concluido", object_type="ova", object_id=1, points=40, awarded_on=today - datetime.timedelta(days=4), created_at=now)
    XpEvents.create(student_id=s1_id, rule="modulo_concluido", object_type="ova", object_id=2, points=40, awarded_on=today - datetime.timedelta(days=1), created_at=now)
    XpEvents.create(student_id=s1_id, rule="quiz_do_modulo", object_type="ova", object_id=1, points=15, awarded_on=today - datetime.timedelta(days=4), created_at=now)
    XpEvents.create(student_id=s1_id, rule="quiz_do_modulo", object_type="ova", object_id=2, points=15, awarded_on=today - datetime.timedelta(days=1), created_at=now)
    XpEvents.create(student_id=s1_id, rule="revisao_em_dia", object_type="competency", object_id=1, points=30, awarded_on=today, created_at=now)
    XpEvents.create(student_id=s1_id, rule="meta_semanal", points=50, awarded_on=today - datetime.timedelta(days=2), created_at=now)
    
    ReviewSchedule.create(student_id=s1_id, competency_id=1, due_date=today + datetime.timedelta(days=4), interval_days=6, ease=2.6, status="agendada", created_at=now)

    # =========================================================================
    # PERFIL 2: YASMIN (RA 3) - ALUNA COM MÉDIO DESEMPENHO
    # =========================================================================
    s2_id = 3
    OVAProgress.create(student_id=s2_id, ova_id=1, read_time=650, perc_scrolled=65, completed=False, last_access=now - datetime.timedelta(days=2))
    OVAProgress.create(student_id=s2_id, ova_id=2, read_time=480, perc_scrolled=45, completed=False, last_access=now - datetime.timedelta(days=3))
    
    ResourceProgress.create(student_id=s2_id, resource_id=1, perc_consumed=100, seconds_consumed=300, completed=True, last_access=now - datetime.timedelta(days=3))
    ResourceProgress.create(student_id=s2_id, resource_id=2, perc_consumed=60, seconds_consumed=180, completed=False, last_access=now - datetime.timedelta(days=2), watched_seconds=180, coverage_perc=60)
    ResourceProgress.create(student_id=s2_id, resource_id=8, perc_consumed=50, seconds_consumed=150, completed=False, last_access=now - datetime.timedelta(days=3), watched_seconds=150, coverage_perc=50)

    s2_attempts = [
        (1, True),
        (2, True),
        (3, False),
        (4, False),
        (5, False),
        (6, True),
        (7, True),
        (8, False),
        (9, True),
        (10, True),
        (11, False),
        (13, False),
        (14, True),
    ]
    for qid, correct in s2_attempts:
        Attempts.create(student_id=s2_id, question_id=qid, is_correct=correct, attempt_time=now - datetime.timedelta(days=2, hours=qid))
        if correct:
            Answers.create(student_id=s2_id, question_id=qid)
            
    masteries_s2 = [
        (1, 0.58, 3),
        (2, 0.36, 3),
        (3, 0.52, 3),
        (4, 0.48, 2),
        (5, 0.42, 2)
    ]
    for cid, val, atts in masteries_s2:
        StudentMastery.create(student_id=s2_id, competency_id=cid, p_mastery=val, attempts_seen=atts, updated_at=now - datetime.timedelta(days=2))
        for days_ago, hist_val in [(14, 0.25), (7, 0.38), (2, val)]:
            StudentMasteryHistory.create(
                student_id=s2_id, competency_id=cid,
                snapshot_date=today - datetime.timedelta(days=days_ago),
                p_mastery=hist_val
            )
            
    StudentStreak.create(student_id=s2_id, current_days=2, best_days=3, last_activity_date=today - datetime.timedelta(days=2), shield_used_on=None)
    StudentAchievements.create(student_id=s2_id, achievement_id="primeiro_modulo", unlocked_at=now - datetime.timedelta(days=5))
    StudentAchievements.create(student_id=s2_id, achievement_id="curioso", unlocked_at=now - datetime.timedelta(days=2))
    
    XpEvents.create(student_id=s2_id, rule="dia_de_estudo", points=10, awarded_on=today - datetime.timedelta(days=2), created_at=now - datetime.timedelta(days=2))
    XpEvents.create(student_id=s2_id, rule="dia_de_estudo", points=10, awarded_on=today - datetime.timedelta(days=3), created_at=now - datetime.timedelta(days=3))
    XpEvents.create(student_id=s2_id, rule="quiz_do_modulo", object_type="ova", object_id=1, points=15, awarded_on=today - datetime.timedelta(days=2), created_at=now)
    XpEvents.create(student_id=s2_id, rule="pergunta_ao_tutor", points=5, awarded_on=today - datetime.timedelta(days=2), created_at=now)
    
    # OVA de Reforço com textos e acentos corretos em UTF-8
    p_ova = PersonalizedOVA.create(
        student_id=s2_id,
        target_competency_id=2,
        title="Reforço: Aplicações da Computação Quântica",
        message="Olá Yasmin! O EduBot percebeu que você teve dúvidas no quiz de aplicações quânticas. Preparamos uma trilha rápida com um vídeo explicativo e exercícios guiados para fixar o conteúdo.",
        rationale="Taxa de acerto de 33% na competência 'Analisar as aplicações da computação quântica'.",
        status="ativa",
        created_at=now - datetime.timedelta(days=2)
    )
    PersonalizedOVAItem.create(personalized_ova_id=p_ova, item_kind="resource", resource_id=19, position=1)
    PersonalizedOVAItem.create(personalized_ova_id=p_ova, item_kind="resource", resource_id=20, position=2)
    PersonalizedOVAItem.create(personalized_ova_id=p_ova, item_kind="question", question_id=4, position=3)
    PersonalizedOVAItem.create(personalized_ova_id=p_ova, item_kind="question", question_id=5, position=4)

    Interventions.create(
        student_id=s2_id,
        date=today - datetime.timedelta(days=2),
        type="reforco",
        description="Montada trilha de reforço personalizada sobre Aplicações da Computação Quântica.",
        result="aceita"
    )

    # =========================================================================
    # PERFIL 3: PEDRO (RA 5) - ALUNO COM BAIXO DESEMPENHO E RISCO DE EVASÃO
    # =========================================================================
    s3_id = 5
    last_seen_date = today - datetime.timedelta(days=14)
    last_seen_dt = now - datetime.timedelta(days=14)
    
    OVAProgress.create(student_id=s3_id, ova_id=1, read_time=45, perc_scrolled=15, completed=False, last_access=last_seen_dt)
    ResourceProgress.create(student_id=s3_id, resource_id=2, perc_consumed=5, seconds_consumed=20, completed=False, last_access=last_seen_dt, watched_seconds=20, coverage_perc=5)

    s3_attempts = [
        (1, False),
        (2, False),
        (3, True),
        (4, False),
        (5, False),
        (6, False),
    ]
    for qid, correct in s3_attempts:
        Attempts.create(student_id=s3_id, question_id=qid, is_correct=correct, attempt_time=last_seen_dt - datetime.timedelta(minutes=qid*5))
        if correct:
            Answers.create(student_id=s3_id, question_id=qid)

    StudentMastery.create(student_id=s3_id, competency_id=1, p_mastery=0.18, attempts_seen=3, updated_at=last_seen_dt)
    StudentMastery.create(student_id=s3_id, competency_id=2, p_mastery=0.15, attempts_seen=3, updated_at=last_seen_dt)
    
    StudentMasteryHistory.create(student_id=s3_id, competency_id=1, snapshot_date=today - datetime.timedelta(days=20), p_mastery=0.28)
    StudentMasteryHistory.create(student_id=s3_id, competency_id=1, snapshot_date=today - datetime.timedelta(days=14), p_mastery=0.22)
    StudentMasteryHistory.create(student_id=s3_id, competency_id=1, snapshot_date=today, p_mastery=0.18)
    
    StudentMasteryHistory.create(student_id=s3_id, competency_id=2, snapshot_date=today - datetime.timedelta(days=20), p_mastery=0.25)
    StudentMasteryHistory.create(student_id=s3_id, competency_id=2, snapshot_date=today - datetime.timedelta(days=14), p_mastery=0.19)
    StudentMasteryHistory.create(student_id=s3_id, competency_id=2, snapshot_date=today, p_mastery=0.15)

    ReviewSchedule.create(student_id=s3_id, competency_id=1, due_date=today - datetime.timedelta(days=8), interval_days=1, ease=2.1, status="vencida", created_at=last_seen_dt)
    ReviewSchedule.create(student_id=s3_id, competency_id=2, due_date=today - datetime.timedelta(days=6), interval_days=1, ease=2.0, status="vencida", created_at=last_seen_dt)
    ReviewSchedule.create(student_id=s3_id, competency_id=3, due_date=today - datetime.timedelta(days=4), interval_days=1, ease=2.0, status="vencida", created_at=last_seen_dt)

    StudentStreak.create(student_id=s3_id, current_days=0, best_days=1, last_activity_date=last_seen_date, shield_used_on=None)
    XpEvents.create(student_id=s3_id, rule="dia_de_estudo", points=10, awarded_on=last_seen_date, created_at=last_seen_dt)

    # Alerta com acentuação UTF-8 impecável
    Alerts.create(
        student_id=s3_id,
        type="risco_evasao",
        severity="alta",
        message="Aluno Pedro está inativo há 14 dias, com taxa de erro de 83% no quiz e 3 revisões vencidas acumuladas. Risco iminente de evasão.",
        read=False,
        status="aberto",
        created_at=now - datetime.timedelta(days=1),
        proposed_action={
            "acao": "contato_urgente",
            "detalhe": "Disparar mensagem no WhatsApp/e-mail oferecendo tutoria individual e retomada do módulo 1."
        }
    )

    Interventions.create(
        student_id=s3_id,
        date=today - datetime.timedelta(days=7),
        type="inatividade",
        description="Sentimos sua falta! Que tal retomar os estudos de Computação Quântica com um resumo rápido?",
        result="pendente"
    )

    # =========================================================================
    # PERFIL 4: THIAGO (RA 6) - ALUNO ZERADO (PRIMEIRO ACESSO)
    # =========================================================================
    # Permanece completamente zerado (sem attempts, sem ova_progress, sem mastery, sem xp).

    print("Sucesso: todos os registros foram inseridos com caracteres e acentos UTF-8 limpos!")

if __name__ == "__main__":
    seed()
