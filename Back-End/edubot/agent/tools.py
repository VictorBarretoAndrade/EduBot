# MELHORIA (OVA personalizada) — Ferramentas (tools) do agente EduBot.
#
# O EduBot deixa de ser um classificador de uma chamada só e passa a ser um
# AGENTE com tool-use: ele inspeciona o desempenho do aluno, consulta o banco de
# conteúdo (recursos + questões) por competência e MONTA uma OVA de reforço.
#
# Cada tool tem:
#   - um JSON-schema (formato `tools` da Anthropic Messages API / Bedrock), e
#   - uma função Python pura que executa a ação contra o banco.
#
# As funções recebem `ctx` (contém o aluno logado, resolvido do token na rota —
# NUNCA do payload) para impedir que o agente leia/escreva dados de outro aluno.
# IDs escolhidos pelo modelo são SEMPRE validados antes de persistir.
import sys, os


import datetime

from edubot.data.models.competencies import Competencies
from edubot.data.models.subjects import Subjects
from edubot.data.models.offerings import Offerings
from edubot.data.models.questions import Questions
from edubot.data.models.answers import Answers
from edubot.data.models.attempts import Attempts
from edubot.data.models.resources import Resources
from edubot.data.models.personalized_ova import PersonalizedOVA, PersonalizedOVAItem

# Limiar de competência desenvolvida (mesmo critério do student_context)
COMPETENCY_DEVELOPED_RATIO = 0.8


# ---------------------------------------------------------------------------
# JSON-schemas das tools (o que é enviado ao modelo)
# ---------------------------------------------------------------------------
TOOLS_SCHEMA = [
    {
        "name": "listar_competencias_fracas",
        "description": (
            "Lista as competências do curso do aluno ordenadas da mais fraca "
            "para a mais forte, com status (não iniciada / em desenvolvimento / "
            "desenvolvida) e taxa de erro no quiz por competência. Use primeiro, "
            "para descobrir QUAL assunto remediar."),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "listar_recursos_remediacao",
        "description": (
            "Lista os recursos (vídeos, textos, podcasts) do banco de conteúdo "
            "associados a uma competência. São os materiais candidatos a compor "
            "a OVA de reforço daquele assunto."),
        "input_schema": {
            "type": "object",
            "properties": {
                "competency_id": {"type": "integer", "description": "Competência-alvo."},
                "tipo": {
                    "type": "string",
                    "enum": ["video", "texto", "podcast"],
                    "description": "Opcional: filtra por tipo de mídia."},
            },
            "required": ["competency_id"],
        },
    },
    {
        "name": "listar_questoes_reforco",
        "description": (
            "Lista as questões do banco associadas a uma competência (sem o "
            "gabarito), candidatas a compor o quiz da OVA de reforço."),
        "input_schema": {
            "type": "object",
            "properties": {
                "competency_id": {"type": "integer", "description": "Competência-alvo."},
            },
            "required": ["competency_id"],
        },
    },
    {
        "name": "criar_ova_personalizada",
        "description": (
            "Monta e PERSISTE a OVA de reforço para o aluno, a partir dos "
            "recursos e questões escolhidos. Chame por último, uma única vez. "
            "Retorna o id da OVA criada."),
        "input_schema": {
            "type": "object",
            "properties": {
                "target_competency_id": {"type": "integer"},
                "titulo": {"type": "string"},
                "mensagem_aluno": {
                    "type": "string",
                    "description": "Mensagem motivacional dirigida ao aluno pelo nome."},
                "justificativa": {
                    "type": "string",
                    "description": "Por que esta OVA foi gerada (para o professor)."},
                "resource_ids": {
                    "type": "array", "items": {"type": "integer"},
                    "description": "IDs dos recursos a incluir (na ordem desejada)."},
                "question_ids": {
                    "type": "array", "items": {"type": "integer"},
                    "description": "IDs das questões de reforço a incluir."},
            },
            "required": ["target_competency_id", "titulo", "mensagem_aluno",
                         "justificativa", "resource_ids", "question_ids"],
        },
    },
]


# ---------------------------------------------------------------------------
# Implementações
# ---------------------------------------------------------------------------
def _course_competencies(student):
    return (Competencies
            .select()
            .join(Subjects, on=(Competencies.subject_id == Subjects.subject_id))
            .join(Offerings, on=(Offerings.subject_id == Subjects.subject_id))
            .where(Offerings.course_id == student.course_id))


def listar_competencias_fracas(ctx, **_):
    student = ctx["student"]
    rows = []
    for comp in _course_competencies(student):
        total = Questions.select().where(Questions.competency_id == comp.competency_id).count()
        correct = (Answers
                   .select()
                   .join(Questions, on=(Answers.question_id == Questions.question_id))
                   .where((Answers.student_id == student) &
                          (Questions.competency_id == comp.competency_id))
                   .count())
        comp_questions = Questions.select(Questions.question_id).where(
            Questions.competency_id == comp.competency_id)
        att_total = (Attempts.select()
                     .where((Attempts.student_id == student) &
                            (Attempts.question_id.in_(comp_questions))).count())
        att_wrong = (Attempts.select()
                     .where((Attempts.student_id == student) &
                            (Attempts.question_id.in_(comp_questions)) &
                            (Attempts.is_correct == False)).count())
        taxa_erro = round(att_wrong / att_total, 2) if att_total else None
        mastery = (correct / total) if total else 0
        if total == 0 or correct == 0:
            status = "não iniciada"
        elif mastery >= COMPETENCY_DEVELOPED_RATIO:
            status = "desenvolvida"
        else:
            status = "em desenvolvimento"
        rows.append({
            "competency_id": comp.competency_id,
            "nome": comp.competency_description,
            "status": status,
            "acertos": correct,
            "total_questoes": total,
            "taxa_erro": taxa_erro,
            "fraca": status != "desenvolvida",
            "_score": (taxa_erro or 0.0, -mastery),  # ordenação interna
        })
    # mais fraca primeiro: maior taxa de erro, depois menor domínio
    rows.sort(key=lambda r: r["_score"], reverse=True)
    for r in rows:
        r.pop("_score", None)
    return {"competencias": rows}


def listar_recursos_remediacao(ctx, competency_id=None, tipo=None, **_):
    query = Resources.select().where(Resources.competency_id == competency_id)
    if tipo:
        query = query.where(Resources.resource_type == tipo)
    recursos = [{
        "resource_id": r.resource_id,
        "titulo": r.resource_title,
        "tipo": r.resource_type,
        "url": r.resource_url,
        "media_type": r.media_type,
    } for r in query]
    return {"competency_id": competency_id, "recursos": recursos}


def listar_questoes_reforco(ctx, competency_id=None, **_):
    # Nunca devolve o gabarito (mesma política de B9/questionRoute).
    questoes = [{
        "question_id": q.question_id,
        "enunciado": q.statement,
    } for q in Questions.select().where(Questions.competency_id == competency_id)]
    return {"competency_id": competency_id, "questoes": questoes}


def criar_ova_personalizada(ctx, target_competency_id=None, titulo="OVA de reforço",
                            mensagem_aluno="", justificativa="",
                            resource_ids=None, question_ids=None, **_):
    student = ctx["student"]
    resource_ids = resource_ids or []
    question_ids = question_ids or []

    # VALIDAÇÃO: só persiste itens que existem E pertencem à competência-alvo,
    # para o agente não conseguir inventar IDs nem misturar assuntos.
    valid_resources = [
        r.resource_id for r in Resources.select(Resources.resource_id).where(
            (Resources.resource_id.in_(resource_ids)) &
            (Resources.competency_id == target_competency_id))
    ] if resource_ids else []
    valid_questions = [
        q.question_id for q in Questions.select(Questions.question_id).where(
            (Questions.question_id.in_(question_ids)) &
            (Questions.competency_id == target_competency_id))
    ] if question_ids else []

    if not valid_resources and not valid_questions:
        return {"error": "Nenhum recurso/questão válido para a competência-alvo."}

    # Preserva a ordem pedida pelo modelo
    valid_resources = [rid for rid in resource_ids if rid in set(valid_resources)]
    valid_questions = [qid for qid in question_ids if qid in set(valid_questions)]

    pova = PersonalizedOVA.create(
        student_id=student,
        target_competency_id=target_competency_id,
        title=titulo,
        message=mensagem_aluno,
        rationale=justificativa,
        status="ativa",
        created_at=datetime.datetime.now(),
    )
    position = 0
    for rid in valid_resources:
        PersonalizedOVAItem.create(personalized_ova_id=pova, item_kind="resource",
                                   resource_id=rid, position=position)
        position += 1
    for qid in valid_questions:
        PersonalizedOVAItem.create(personalized_ova_id=pova, item_kind="question",
                                   question_id=qid, position=position)
        position += 1

    return {
        "personalized_ova_id": pova.personalized_ova_id,
        "titulo": titulo,
        "target_competency_id": target_competency_id,
        "itens_recursos": len(valid_resources),
        "itens_questoes": len(valid_questions),
    }


# Registro nome -> função, usado pelo loop do agente.
TOOL_FUNCTIONS = {
    "listar_competencias_fracas": listar_competencias_fracas,
    "listar_recursos_remediacao": listar_recursos_remediacao,
    "listar_questoes_reforco": listar_questoes_reforco,
    "criar_ova_personalizada": criar_ova_personalizada,
}


def execute_tool(name, tool_input, ctx):
    """Despacha a chamada de tool feita pelo modelo. Erros viram payload de
    erro (devolvido ao modelo como tool_result), nunca exceção que mata o loop."""
    fn = TOOL_FUNCTIONS.get(name)
    if fn is None:
        return {"error": f"Tool desconhecida: {name}"}
    try:
        return fn(ctx, **(tool_input or {}))
    except Exception as err:  # noqa: BLE001 — robustez do loop é proposital
        return {"error": f"Falha ao executar {name}: {err}"}
