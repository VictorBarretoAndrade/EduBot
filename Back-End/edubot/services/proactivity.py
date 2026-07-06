"""Proatividade do EduBot (A13) — o agente "fala primeiro".

Antes, o agente era 100% reativo: a recomendação só rodava no clique do aluno
(`/edubot/recommendation`) e a avaliação da turma só no clique do tutor
(`/tutor/evaluate`). Não havia gatilho por evento nem varredura agendada.

Este serviço centraliza a avaliação de UM aluno (perfil -> regras -> recomendação)
e a materializa como:
  - Intervenção (para o aluno ver no dashboard), deduplicada por tipo/dia;
  - Alerta (para o tutor), deduplicado por tipo enquanto não lido.

É chamado por gatilho de evento (pós-quiz/pós-conclusão de OVA) e pela varredura
agendada da turma. A regra decide QUANDO; a redação da mensagem já vem do agente
(mock determinístico ou LLM real via llm.py).
"""
import datetime
import logging

from edubot.agent import get_recommendation
from edubot.data.models.alerts import Alerts
from edubot.data.models.attempts import Attempts
from edubot.data.models.interactions import Interactions
from edubot.data.models.interventions import Interventions
from edubot.data.models.ova_progress import OVAProgress
from edubot.data.models.students import Students
from edubot.services.student_context import build_student_profile

logger = logging.getLogger("edubot.proactivity")

# Só materializa recomendações que valem a pena empurrar sem pedir.
ACTIONABLE_PRIORITIES = ("alta", "media")


def evaluate_student(student, *, create_alert=True, lang="pt"):
    """Avalia as regras do aluno e materializa a recomendação acionável.

    `lang` (Fase 4 — A12): idioma da mensagem da intervenção (o gatilho por
    evento usa o idioma da requisição do aluno; a varredura agendada usa PT).
    Retorna a recomendação criada (dict) ou None se nada acionável.
    Pode levantar exceção (use `trigger_evaluation` no caminho de escrita)."""
    profile = build_student_profile(student, lang=lang)
    rec = get_recommendation(profile, lang=lang)
    if rec.get("prioridade") not in ACTIONABLE_PRIORITIES:
        return None

    today = datetime.date.today()

    # Intervenção para o aluno — dedup por (aluno, tipo, dia) ainda pendente.
    has_intervention = (Interventions
                        .select()
                        .where((Interventions.student_id == student) &
                               (Interventions.date == today) &
                               (Interventions.type == rec["tipo"]) &
                               (Interventions.result == "pendente"))
                        .exists())
    if not has_intervention:
        Interventions.create(
            student_id=student, date=today, type=rec["tipo"],
            description=rec["mensagem_aluno"], result="pendente")

    # Alerta para o tutor — dedup por (aluno, tipo) enquanto não lido.
    if create_alert:
        has_alert = (Alerts
                     .select()
                     .where((Alerts.student_id == student) &
                            (Alerts.type == rec["tipo"]) &
                            (Alerts.read == False))
                     .exists())
        if not has_alert:
            Alerts.create(
                student_id=student, type=rec["tipo"],
                message=f"{student.student_name}: {rec['titulo']}",
                severity=rec["prioridade"],
                created_at=datetime.datetime.now(), read=False)

    return rec


def trigger_evaluation(student, lang="pt"):
    """Versão best-effort para o caminho de escrita (pós-quiz/progresso): nunca
    quebra a requisição principal se a avaliação falhar. Retorna a recomendação
    ou None.

    Guard de custo (A9): montar o perfil é caro (N+1); um quiz com N erros
    dispararia N avaliações na mesma submissão. Se o aluno já tem uma
    intervenção pendente criada HOJE, o gatilho por evento pula — ele já foi
    avisado; a varredura agendada e o /tutor/evaluate continuam avaliando
    por completo."""
    try:
        already_notified_today = (Interventions
                                  .select()
                                  .where((Interventions.student_id == student) &
                                         (Interventions.date == datetime.date.today()) &
                                         (Interventions.result == "pendente"))
                                  .exists())
        if already_notified_today:
            return None
        return evaluate_student(student, lang=lang)
    except Exception:
        logger.exception("Falha ao avaliar proatividade do aluno %s",
                         getattr(student, "student_id", "?"))
        return None


def active_student_ids():
    """IDs de alunos com ALGUMA atividade (interação, leitura ou tentativa).
    Fonte única usada pela varredura agendada e pelo painel do tutor — evita
    varrer os 500 alunos do seed e mantém a lógica em um só lugar (A15)."""
    ids = set()
    for query in (
        Interactions.select(Interactions.student_id).distinct().tuples(),
        OVAProgress.select(OVAProgress.student_id).distinct().tuples(),
        Attempts.select(Attempts.student_id).distinct().tuples(),
    ):
        for row in query:
            if row[0] is not None:
                ids.add(row[0])
    return ids


def run_class_evaluation(limit=200):
    """Varredura periódica (chamada pelo scheduler): avalia todos os alunos com
    atividade e materializa intervenções/alertas para quem entrou em risco —
    inclusive inatividade (Regra 1), pois um aluno que estudou e parou continua
    na lista. Retorna quantas recomendações acionáveis foram criadas."""
    ids = list(active_student_ids())[:limit]
    if not ids:
        return 0
    created = 0
    for student in (Students
                    .select()
                    .where((Students.student_id.in_(ids)) &
                           (Students.role == "aluno"))):
        try:
            if evaluate_student(student) is not None:
                created += 1
        except Exception:
            logger.exception("Falha ao avaliar aluno %s na varredura", student.student_id)
    return created
