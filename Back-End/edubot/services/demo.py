# Modo DEMO (login com Google) — workspace-sandbox no modelo "Student View" do Canvas.
#
# Quem entra com o Google ganha, uma vez só (idempotente pelo `sub` do Google):
#   - um curso próprio (`is_demo`), com as MESMAS matérias do curso base via
#     offerings — o conteúdo (módulos, recursos, questões) é compartilhado, os
#     dados de aluno não;
#   - a conta de COORDENADOR (role admin) — a própria pessoa;
#   - um ALUNO DE TESTE ligado a ela, sem dados, para viver a jornada do aluno
#     e ver o reflexo no painel (troca de visão em /demo/switch);
#   - alunos de EXEMPLO com perfis distintos (destaque, mediano, em risco,
#     inativo), gerados pelos serviços REAIS: as tentativas passam pelo BKT
#     (services.mastery) e a avaliação pelo motor de regras da proatividade, que
#     cria intervenções e alertas como faria em produção.
#
# Isolamento: todas as rotas de tutor filtram por course_id; o coordenador da demo
# só enxerga o próprio curso-sandbox. Nada aqui chama LLM (consentimento de IA só
# é concedido depois da avaliação inicial) — o login fica rápido e sem custo.
import datetime
import hashlib
import os
import random
import secrets
import string

from peewee import IntegrityError, fn

from edubot.api.auth import hash_password
from edubot.data.models.base import db
from edubot.data.models.answers import Answers
from edubot.data.models.attempts import Attempts
from edubot.data.models.consents import Consents
from edubot.data.models.courses import Courses
from edubot.data.models.interactions import Interactions
from edubot.data.models.learning_events import LearningEvents
from edubot.data.models.offerings import Offerings
from edubot.data.models.ova_progress import OVAProgress
from edubot.data.models.ovas import OVAs
from edubot.data.models.questions import Questions
from edubot.data.models.resource_progress import ResourceProgress
from edubot.data.models.resources import Resources
from edubot.data.models.review_schedule import ReviewSchedule
from edubot.data.models.student_mastery import StudentMastery
from edubot.data.models.student_mastery_history import StudentMasteryHistory
from edubot.data.models.student_streak import StudentStreak
from edubot.data.models.students import Students
from edubot.data.models.xp_events import XpEvents

KIND_COORD = "coordenador"
KIND_TEST_STUDENT = "aluno_teste"
KIND_SAMPLE = "exemplo"
KIND_CREATED = "criado"

CONSENT_PURPOSES = ("tracking_pedagogico", "ia_sobre_dados", "imagem_voz", "ranking_turma")

# Perfis de exemplo: taxa de acerto, fração dos módulos percorridos, dias desde o
# último acesso, se o domínio vem caindo (esquecimento) e revisões vencidas. Os
# números foram escolhidos para cada um cair numa faixa diferente do risco
# composto (services.risk, limiar 40): destaque ~0, mediano < 40, os outros > 40.
PROFILES = {
    "destaque": {"acerto": 0.9, "conclusao": 1.0, "dias_sem_acesso": 0, "streak": 6,
                 "caindo": False, "revisoes_vencidas": 0},
    "mediano": {"acerto": 0.6, "conclusao": 0.6, "dias_sem_acesso": 2, "streak": 2,
                "caindo": False, "revisoes_vencidas": 0},
    "em_risco": {"acerto": 0.2, "conclusao": 0.35, "dias_sem_acesso": 6, "streak": 0,
                 "caindo": False, "revisoes_vencidas": 1},
    "inativo": {"acerto": 0.5, "conclusao": 0.15, "dias_sem_acesso": 13, "streak": 0,
                "caindo": True, "revisoes_vencidas": 3},
}
SAMPLE_STUDENTS = (
    ("Ana Ribeiro", "destaque"),
    ("Bruno Costa", "mediano"),
    ("Carla Mendes", "em_risco"),
    ("Diego Almeida", "inativo"),
)


def base_course_id():
    return int(os.environ.get("EDUBOT_DEMO_BASE_COURSE", "1"))


def anonymous_demo_enabled():
    """Botão "Demo" sem login na tela de entrada: EDUBOT_DEMO_SEM_LOGIN=1."""
    return os.environ.get("EDUBOT_DEMO_SEM_LOGIN", "").lower() in ("1", "true", "on", "yes")


# ---------------------------------------------------------------------------
# Demo sem login: identidade por NAVEGADOR. O servidor sorteia um segredo de
# dispositivo (token_urlsafe), o front guarda e reenvia; no banco fica só o hash
# em google_sub ("anon:<sha256>"). Quem tem o segredo reabre a turma — ele vive
# apenas naquele navegador, como um cookie de sessão de visitante.
# ---------------------------------------------------------------------------
ANON_NAME = {"pt": "Visitante", "en": "Visitor"}
TEST_STUDENT_SUFFIX = {"pt": "aluno de teste", "en": "test student"}


def _lang(lang):
    return "en" if lang == "en" else "pt"


def new_device():
    return secrets.token_urlsafe(32)


def valid_device(value):
    if (isinstance(value, str) and 32 <= len(value) <= 100
            and all(c.isalnum() or c in "-_" for c in value)):
        return value
    return None


def device_sub(device):
    return "anon:" + hashlib.sha256(device.encode()).hexdigest()[:48]


def is_demo_course(course_id):
    return (Courses.select()
            .where((Courses.course_id == course_id) & (Courses.is_demo == True))  # noqa: E712
            .exists())


# ---------------------------------------------------------------------------
# Credenciais
# ---------------------------------------------------------------------------
def _new_ra(prefix="d"):
    """RA curto (a coluna é VARCHAR(10)) e único: prefixo + 7 dígitos."""
    for _ in range(20):
        ra = prefix + "".join(secrets.choice(string.digits) for _ in range(7))
        if not Students.select().where(fn.LOWER(Students.ra) == ra).exists():
            return ra
    raise RuntimeError("Não foi possível gerar um RA único")


def _new_password():
    # Sem caracteres ambíguos (0/O, 1/l/I): a senha é lida na tela e digitada.
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _grant_consents(student, now):
    for purpose in CONSENT_PURPOSES:
        row, created = Consents.get_or_create(
            student_id=student, purpose=purpose,
            defaults={"granted": True, "granted_at": now})
        if not created and not row.granted:
            row.granted, row.granted_at, row.revoked_at = True, now, None
            row.save()


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------
def _first_name(name):
    return (name or "").strip().split(" ")[0] or "Demo"


def workspace_exists(google_sub):
    return Students.select().where(Students.google_sub == google_sub).exists()


def get_or_create_workspace(google_sub, email, name, lang="pt"):
    """Devolve o coordenador do workspace DEMO desta identidade (cria na 1ª vez)."""
    existing = Students.get_or_none(Students.google_sub == google_sub)
    if existing is not None:
        if email and existing.email != email:
            existing.email = email
            existing.save()
        return existing

    try:
        return _create_workspace(google_sub, email, name, lang)
    except IntegrityError:
        # Duas requisições simultâneas no 1º login: a outra criou antes (unique
        # em google_sub) e esta transação foi desfeita — usa a dela.
        existing = Students.get_or_none(Students.google_sub == google_sub)
        if existing is None:
            raise
        return existing


def _create_workspace(google_sub, email, name, lang="pt"):
    now = datetime.datetime.now()
    first = _first_name(name)
    with db.atomic():
        course = Courses.create(
            course_name=f"Demo · {first}", course_name_en=f"Demo · {first}",
            is_demo=True, demo_created_at=now)
        for off in Offerings.select().where(Offerings.course_id == base_course_id()):
            Offerings.create(course_id=course, subject_id=off.subject_id)

        coord = Students.create(
            ra=_new_ra("c"), student_password=hash_password(secrets.token_urlsafe(24)),
            student_name=(name or first)[:100], course_id=course, is_admin=True,
            role="admin", email=email, google_sub=google_sub, demo_kind=KIND_COORD)
        coord.demo_owner_id = coord.student_id
        coord.save()

        test_student = Students.create(
            ra=_new_ra("t"), student_password=hash_password(secrets.token_urlsafe(24)),
            student_name=f"{first} ({TEST_STUDENT_SUFFIX[_lang(lang)]})"[:100], course_id=course,
            is_admin=False, role="aluno", demo_owner_id=coord.student_id,
            demo_kind=KIND_TEST_STUDENT)
        _grant_consents(coord, now)
        _grant_consents(test_student, now)

        for sample_name, profile in SAMPLE_STUDENTS:
            create_student(coord, sample_name, profile=profile, kind=KIND_SAMPLE)
    return coord


def workspace_owner(student):
    """Coordenador dono do workspace do `student` (ou None se não for conta demo)."""
    if not student.demo_owner_id:
        return None
    return Students.get_or_none(Students.student_id == student.demo_owner_id)


def switch_target(student):
    """Conta para a qual a troca de visão leva (coordenador <-> aluno de teste).

    Só esses dois trocam entre si: aluno de exemplo ou criado pelo coordenador tem
    senha conhecida, e trocar a partir dele daria acesso de coordenador a quem
    tivesse só a senha do aluno."""
    if student.demo_kind == KIND_COORD:
        return (Students.select()
                .where((Students.demo_owner_id == student.student_id) &
                       (Students.demo_kind == KIND_TEST_STUDENT))
                .first())
    if student.demo_kind == KIND_TEST_STUDENT:
        owner = workspace_owner(student)
        if owner is not None and owner.demo_kind == KIND_COORD:
            return owner
    return None


# ---------------------------------------------------------------------------
# Criação de aluno (coordenador) e dados de exemplo
# ---------------------------------------------------------------------------
def create_student(coordinator, name, profile=None, kind=KIND_CREATED):
    """Cria um aluno no curso do coordenador. Devolve (aluno, senha_em_texto).

    `profile` (só em curso DEMO) gera um histórico sintético coerente para o aluno
    aparecer no painel com risco, domínio e alertas — em curso real é ignorado."""
    now = datetime.datetime.now()
    password = _new_password()
    course_id = coordinator.course_id_id
    demo = is_demo_course(course_id)
    with db.atomic():
        student = Students.create(
            ra=_new_ra("d"), student_password=hash_password(password),
            student_name=name.strip()[:100], course_id=course_id, is_admin=False,
            role="aluno",
            demo_owner_id=(coordinator.demo_owner_id or coordinator.student_id) if demo else None,
            demo_kind=kind if demo else None)
        if demo and profile in PROFILES:
            _seed_activity(student, course_id, PROFILES[profile], now)
            _evaluate(student)
        if demo:
            _grant_consents(student, now)
    return student, password


def _course_content(course_id):
    ovas = list(OVAs.select()
                .join(Offerings, on=(OVAs.subject_id == Offerings.subject_id))
                .where(Offerings.course_id == course_id)
                .order_by(OVAs.ova_id))
    ova_ids = [o.ova_id for o in ovas]
    questions = list(Questions.select().where(Questions.ova_id.in_(ova_ids))
                     .order_by(Questions.question_id)) if ova_ids else []
    resources = list(Resources.select().where(Resources.ova_id.in_(ova_ids))) if ova_ids else []
    return ovas, questions, resources


def _seed_activity(student, course_id, prof, now):
    rng = random.Random(student.student_id)
    today = now.date()
    last_seen = now - datetime.timedelta(days=prof["dias_sem_acesso"], hours=rng.randint(1, 5))
    ovas, questions, resources = _course_content(course_id)
    if not ovas:
        return

    n_ovas = max(1, round(len(ovas) * prof["conclusao"]))
    touched = ovas[:n_ovas]
    touched_ids = {o.ova_id for o in touched}

    # Leitura dos módulos: os primeiros concluídos, o último parcial (exceto destaque).
    for i, ova in enumerate(touched):
        complete = prof["conclusao"] >= 1.0 or i < len(touched) - 1
        when = last_seen - datetime.timedelta(days=(len(touched) - i) * 2)
        OVAProgress.create(
            student_id=student, ova_id=ova, read_time=rng.randint(600, 1800),
            perc_scrolled=100 if complete else rng.randint(30, 70),
            completed=complete, last_access=when)
        Interactions.create(
            interaction_date=when.date(), interaction_time=when.time(),
            student_action="ova_concluded" if complete else "ova_opened",
            student_id=student, ova_id=ova)

    for res in resources:
        if res.ova_id_id not in touched_ids or rng.random() > prof["conclusao"] + 0.1:
            continue
        perc = 100 if rng.random() < prof["acerto"] + 0.1 else rng.randint(20, 80)
        ResourceProgress.create(
            student_id=student, resource_id=res, perc_consumed=perc,
            seconds_consumed=rng.randint(60, 420), completed=perc == 100,
            last_access=last_seen - datetime.timedelta(days=rng.randint(0, 3)))

    # Quiz: as tentativas passam pelo BKT real, em ordem cronológica.
    from edubot.services.mastery import update_on_attempt
    pool = [q for q in questions if q.ova_id_id in touched_ids]
    rng.shuffle(pool)
    pool = pool[: max(4, int(len(pool) * 0.7))]
    pool.sort(key=lambda q: q.question_id)
    start = last_seen - datetime.timedelta(days=12)
    span = max((last_seen - start).total_seconds(), 1)
    comps = set()
    for i, q in enumerate(pool):
        when = start + datetime.timedelta(seconds=span * (i + 1) / (len(pool) + 1))
        correct = rng.random() < prof["acerto"]
        Attempts.create(student_id=student, question_id=q, is_correct=correct, attempt_time=when)
        if correct:
            Answers.create(student_id=student, question_id=q)
        update_on_attempt(student.student_id, q.competency_id_id, correct, now=when)
        comps.add(q.competency_id_id)

    # Histórico de domínio (gráfico de tendência): sobe de ~0.3 até o valor atual
    # ou, para quem sumiu, desce de um pico — o esquecimento que o BKT modela.
    for row in StudentMastery.select().where(StudentMastery.student_id == student):
        start_p = min(0.95, row.p_mastery + 0.3) if prof["caindo"] else min(0.3, row.p_mastery)
        for days_ago, w in ((14, 0.0), (7, 0.5), (0, 1.0)):
            StudentMasteryHistory.create(
                student_id=student, competency_id=row.competency_id,
                snapshot_date=today - datetime.timedelta(days=days_ago),
                p_mastery=round(start_p + (row.p_mastery - start_p) * w, 3))

    # Revisões espaçadas que venceram enquanto o aluno estava fora.
    for comp_id in sorted(comps)[: prof["revisoes_vencidas"]]:
        ReviewSchedule.create(
            student_id=student, competency_id=comp_id,
            due_date=today - datetime.timedelta(days=rng.randint(2, 6)),
            interval_days=3, ease=2.3, status="vencida", created_at=last_seen)

    LearningEvents.create(student_id=student, verb="logged_in", object_type="session",
                          occurred_at=last_seen)
    streak = prof["streak"]
    StudentStreak.create(student_id=student, current_days=streak, best_days=max(streak, 3),
                         last_activity_date=last_seen.date())
    for d in range(streak):
        XpEvents.create(student_id=student, rule="dia_de_estudo", points=10,
                        awarded_on=today - datetime.timedelta(days=d),
                        created_at=now - datetime.timedelta(days=d))
    for ova in touched:
        XpEvents.create(student_id=student, rule="modulo_concluido", object_type="ova",
                        object_id=ova.ova_id, points=40, awarded_on=last_seen.date(),
                        created_at=last_seen)


def _evaluate(student):
    """Roda o motor de regras da proatividade (sem LLM: consentimento de IA ainda
    não concedido) — cria intervenção e alerta como a varredura de produção."""
    try:
        from edubot.services.proactivity import evaluate_student
        evaluate_student(student, create_alert=True, lang="pt", trigger_type="sweep")
    except Exception:  # best-effort: a demo não pode falhar por causa do agente
        import logging
        logging.getLogger("edubot.demo").exception("Avaliação inicial do aluno demo falhou")
