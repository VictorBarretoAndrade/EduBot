# MELHORIA (4.2) — Contexto completo do aluno.
#
# Monta, a partir do banco, o perfil completo do aluno logado:
#   - quais recursos ele já consumiu (por OVA e por tipo de mídia)
#   - histórico de desempenho por competência
#   - dias de inatividade, taxa de erro em quizzes, atividades pendentes
#   - formato de conteúdo preferido (vídeo / texto / podcast)
#
# Este dicionário é a ÚNICA entrada do edubot_agent (4.3) e também alimenta o
# painel de rastreamento (4.4) via GET /student/me. Centralizar a montagem aqui
# evita que cada rota re-derive as mesmas métricas de formas divergentes.
import datetime

from peewee import fn

from edubot.i18n import tr

from edubot.data.models.students import Students
from edubot.data.models.courses import Courses
from edubot.data.models.ovas import OVAs
from edubot.data.models.interactions import Interactions
from edubot.data.models.questions import Questions
from edubot.data.models.answers import Answers
from edubot.data.models.attempts import Attempts
from edubot.data.models.competencies import Competencies
from edubot.data.models.ova_progress import OVAProgress
from edubot.data.models.resources import Resources
from edubot.data.models.resource_progress import ResourceProgress
from edubot.data.models.interventions import Interventions
from edubot.data.models.offerings import Offerings
from edubot.data.models.subjects import Subjects

# Thresholds (kept in one place so the pedagogy team can tune them)
COMPETENCY_DEVELOPED_RATIO = 0.8   # >= 80% of the competency questions correct
MEDIA_COMPLETED_PERC = 90          # video/podcast considered concluded at >= 90%
TEXT_CONSUMED_PERC = 80            # texto considered consumed at >= 80% scrolled


def _as_date(value):
    """Normaliza um valor de data/hora (date, datetime ou string do SQLite)
    para datetime.date, ou None."""
    if not value:
        return None
    if isinstance(value, str):  # SQLite devolve strings em agregações
        value = value.replace("/", "-")
        try:
            return datetime.date.fromisoformat(value[:10])
        except ValueError:
            return None
    if isinstance(value, datetime.datetime):
        return value.date()
    return value  # já é datetime.date


def _days_without_access(student):
    """Dias desde a última atividade do aluno (A2).

    Antes derivava só de `interactions`, que o front novo quase não alimenta
    (só ao abrir o assistente / clicar em carrossel). Um aluno que lê, assiste
    vídeo e responde quiz todo dia — sem tocar num carrossel — aparecia como
    inativo, e a regra de MAIOR prioridade do agente disparava um falso "há N
    dias sem acessar". Agora a inatividade considera TODO sinal de estudo:
    interações, leitura de OVA, consumo de mídia e tentativas de quiz."""
    candidates = [
        Interactions.select(fn.MAX(Interactions.interaction_date))
                    .where(Interactions.student_id == student).scalar(),
        OVAProgress.select(fn.MAX(OVAProgress.last_access))
                   .where(OVAProgress.student_id == student).scalar(),
        ResourceProgress.select(fn.MAX(ResourceProgress.last_access))
                        .where(ResourceProgress.student_id == student).scalar(),
        Attempts.select(fn.MAX(Attempts.attempt_time))
                .where(Attempts.student_id == student).scalar(),
    ]
    dates = [d for d in (_as_date(c) for c in candidates) if d is not None]
    if not dates:
        return None
    return (datetime.date.today() - max(dates)).days


def _competency_statuses(student, lang="pt"):
    """Status per competency of the student's course: não iniciada /
    em desenvolvimento / desenvolvida (ratio of correct answers).

    MELHORIA (OVA personalizada): cada competência traz também o desempenho no
    quiz (tentativas/erros/taxa_erro vindos de `attempts`). É esse erro POR
    competência — e não a taxa global — que o agente usa para decidir QUAL
    assunto remediar com uma OVA personalizada."""
    statuses = []
    competencies = (Competencies
                    .select()
                    .join(Subjects, on=(Competencies.subject_id == Subjects.subject_id))
                    .join(Offerings, on=(Offerings.subject_id == Subjects.subject_id))
                    .where(Offerings.course_id == student.course_id))
    for comp in competencies:
        total = Questions.select().where(Questions.competency_id == comp.competency_id).count()
        correct = (Answers
                   .select()
                   .join(Questions, on=(Answers.question_id == Questions.question_id))
                   .where((Answers.student_id == student) &
                          (Questions.competency_id == comp.competency_id))
                   .count())
        # Quiz attempts on this competency's questions (right and wrong)
        comp_questions = Questions.select(Questions.question_id).where(
            Questions.competency_id == comp.competency_id)
        attempts_total = (Attempts
                          .select()
                          .where((Attempts.student_id == student) &
                                 (Attempts.question_id.in_(comp_questions)))
                          .count())
        attempts_wrong = (Attempts
                          .select()
                          .where((Attempts.student_id == student) &
                                 (Attempts.question_id.in_(comp_questions)) &
                                 (Attempts.is_correct == False))
                          .count())
        taxa_erro = round(attempts_wrong / attempts_total, 2) if attempts_total else None

        ratio = (correct / total) if total else 0
        if total == 0 or correct == 0:
            status = "não iniciada"
        elif ratio >= COMPETENCY_DEVELOPED_RATIO:
            status = "desenvolvida"
        else:
            status = "em desenvolvimento"
        statuses.append({
            "competency_id": comp.competency_id,
            "nome": tr(comp.competency_description, comp.competency_description_en, lang),
            "acertos": correct,
            "total_questoes": total,
            "status": status,
            "tentativas": attempts_total,
            "erros": attempts_wrong,
            "taxa_erro": taxa_erro
        })
    return statuses


def _resource_state(student, resource, ova_progress_row, has_quiz_attempt, lang="pt"):
    """Computes consumption of one resource, regardless of its kind."""
    consumed = False
    perc = 0
    seconds = 0
    completed = False

    if resource.resource_type in ("video", "podcast", "atividade"):
        rp = ResourceProgress.get_or_none(
            (ResourceProgress.student_id == student) &
            (ResourceProgress.resource_id == resource.resource_id))
        if rp:
            perc = rp.perc_consumed or 0
            seconds = rp.seconds_consumed or 0
            completed = bool(rp.completed) or perc >= MEDIA_COMPLETED_PERC
            consumed = completed or perc > 0 or seconds > 0
    elif resource.resource_type == "texto":
        # Texto lives in the OVA page itself: consumption = scroll/read tracking
        if ova_progress_row:
            perc = ova_progress_row.perc_scrolled or 0
            seconds = ova_progress_row.read_time or 0
            completed = perc >= TEXT_CONSUMED_PERC
            consumed = perc > 0 or seconds > 0
    elif resource.resource_type == "quiz":
        consumed = has_quiz_attempt
        completed = has_quiz_attempt

    return {
        "resource_id": resource.resource_id,
        "titulo": tr(resource.resource_title, resource.resource_title_en, lang),
        "tipo": resource.resource_type,
        "url": resource.resource_url,
        "media_type": resource.media_type,
        "perc_consumido": perc,
        "segundos_consumidos": seconds,
        "consumido": consumed,
        "concluido": completed
    }


def build_student_profile(student, lang="pt"):
    """Builds the full profile dict for a Students row (the agent's input).

    `lang` (Fase 4 — A12): nomes de OVA, títulos de recursos e competências são
    servidos no idioma pedido (fallback PT). Métricas independem do idioma."""
    course = Courses.get_or_none(Courses.course_id == student.course_id)

    # --- per-OVA consumption -------------------------------------------------
    ovas_data = []
    total_resources = 0
    consumed_resources = 0
    consumption_by_type = {}

    course_ovas = (OVAs
                   .select()
                   .join(Subjects, on=(OVAs.subject_id == Subjects.subject_id))
                   .join(Offerings, on=(Offerings.subject_id == Subjects.subject_id))
                   .where(Offerings.course_id == student.course_id))

    for ova in course_ovas:
        progress = OVAProgress.get_or_none(
            (OVAProgress.student_id == student) & (OVAProgress.ova_id == ova.ova_id))
        ova_questions = Questions.select(Questions.question_id).where(Questions.ova_id == ova.ova_id)
        has_quiz_attempt = (Attempts
                            .select()
                            .where((Attempts.student_id == student) &
                                   (Attempts.question_id.in_(ova_questions)))
                            .count()) > 0

        resources_data = []
        for resource in Resources.select().where(Resources.ova_id == ova.ova_id):
            state = _resource_state(student, resource, progress, has_quiz_attempt, lang)
            resources_data.append(state)
            total_resources += 1
            stats = consumption_by_type.setdefault(
                resource.resource_type, {"total": 0, "consumidos": 0, "concluidos": 0})
            stats["total"] += 1
            if state["consumido"]:
                consumed_resources += 1
                stats["consumidos"] += 1
            if state["concluido"]:
                stats["concluidos"] += 1

        ovas_data.append({
            "ova_id": ova.ova_id,
            "ova_name": tr(ova.ova_name, ova.ova_name_en, lang),
            # link da página HTML do OVA — usado pelo frontend React para abrir
            # o leitor clássico (iframe.html) com o conteúdo de texto
            "link": ova.link,
            "read_time": progress.read_time if progress else 0,
            "perc_scrolled": progress.perc_scrolled if progress else 0,
            "completed": bool(progress.completed) if progress else False,
            "recursos": resources_data
        })

    perc_consumed = round(100 * consumed_resources / total_resources) if total_resources else 0

    # --- preferred format (which media type the student engages with most) ---
    preferencia = None
    best = 0
    for rtype in ("video", "podcast", "texto"):
        stats = consumption_by_type.get(rtype)
        if stats and stats["consumidos"] > best:
            best = stats["consumidos"]
            preferencia = rtype

    # --- quiz performance ----------------------------------------------------
    attempts_total = Attempts.select().where(Attempts.student_id == student).count()
    attempts_wrong = (Attempts
                      .select()
                      .where((Attempts.student_id == student) & (Attempts.is_correct == False))
                      .count())
    quiz_error_rate = round(attempts_wrong / attempts_total, 2) if attempts_total else None

    # --- pending activities: accessed the OVA but didn't conclude it ---------
    pendentes = (OVAProgress
                 .select()
                 .where((OVAProgress.student_id == student) & (OVAProgress.completed == False))
                 .count())

    # --- intervention/recommendation history ---------------------------------
    historico = []
    for it in (Interventions
               .select()
               .where(Interventions.student_id == student)
               .order_by(Interventions.date.desc())
               .limit(10)):
        historico.append({
            "data": str(it.date),
            "tipo": it.type,
            "descricao": it.description,
            "resultado": it.result
        })

    return {
        "estudante": {
            "student_id": student.student_id,
            "nome": student.student_name,
            "ra": student.ra,
            "curso": course.course_name if course else None,
            # MELHORIA (Cena 4): papel do usuário, para o frontend liberar o painel
            "role": getattr(student, "role", "aluno") or "aluno"
        },
        "dias_sem_acesso": _days_without_access(student),
        "recursos": {
            "total": total_resources,
            "consumidos": consumed_resources,
            "percentual_consumido": perc_consumed,
            "por_tipo": consumption_by_type
        },
        "preferencia_formato": preferencia,
        "quiz": {
            "tentativas": attempts_total,
            "erros": attempts_wrong,
            "taxa_erro": quiz_error_rate
        },
        "atividades_pendentes": pendentes,
        "ovas": ovas_data,
        "competencias": _competency_statuses(student, lang),
        "historico_intervencoes": historico
    }
