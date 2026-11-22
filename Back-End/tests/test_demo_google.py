"""Login com Google + workspace DEMO (migration 026).

O Google é simulado trocando `google_auth._fetch_tokeninfo`; nenhum teste vai à rede.
"""
import json
import time

import pytest

from edubot.api import google_auth
from edubot.data.models.alerts import Alerts
from edubot.data.models.attempts import Attempts
from edubot.data.models.courses import Courses
from edubot.data.models.offerings import Offerings
from edubot.data.models.student_mastery import StudentMastery
from edubot.data.models.students import Students

CLIENT_ID = "test-client.apps.googleusercontent.com"


@pytest.fixture()
def google(monkeypatch):
    """Liga o login Google e devolve um setter da resposta do tokeninfo."""
    monkeypatch.setenv("EDUBOT_GOOGLE_CLIENT_ID", CLIENT_ID)
    state = {}

    def _tokeninfo(credential):
        return state["info"]
    monkeypatch.setattr(google_auth, "_fetch_tokeninfo", _tokeninfo)

    def _set(**over):
        info = {"aud": CLIENT_ID, "iss": "https://accounts.google.com",
                "exp": str(int(time.time()) + 600), "email_verified": "true",
                "sub": "1234567890", "email": "maria@example.com", "name": "Maria Teste"}
        info.update(over)
        state["info"] = info
    _set()
    return _set


def _j(resp):
    return json.loads(resp.data)


def _bearer(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _google_login(client):
    return client.post("/auth/google", json={"credential": "x.y.z"})


def test_config_sem_google(client, monkeypatch):
    monkeypatch.delenv("EDUBOT_GOOGLE_CLIENT_ID", raising=False)
    body = _j(client.get("/auth/config"))
    assert body == {"google_client_id": None, "demo_sem_login": False}
    assert _google_login(client).status_code == 404


def test_login_google_cria_workspace_isolado(client, google):
    resp = _google_login(client)
    assert resp.status_code == 200
    body = _j(resp)
    assert body["role"] == "admin" and body["demo"] == "coordenador"

    coord = Students.get(Students.student_id == body["ids"]["student_id"])
    course = Courses.get(Courses.course_id == body["ids"]["course_id"])
    assert course.is_demo and course.course_id != 1
    assert coord.google_sub == "1234567890" and coord.email == "maria@example.com"
    # Mesmas matérias do curso base (conteúdo compartilhado).
    assert [o.subject_id_id for o in Offerings.select().where(Offerings.course_id == course)] == [1]

    turma = _j(client.get("/tutor/turma", headers=_bearer(body["token"])))
    nomes = {a["nome"] for a in turma["alunos"]}
    # Aluno de teste + 4 de exemplo; NENHUM aluno real do curso 1.
    assert "Maria (aluno de teste)" in nomes and "Ana Ribeiro" in nomes
    assert len(nomes) == 5
    assert not nomes & {"Ana Souza", "Bia Lima"}


def test_login_google_idempotente(client, google):
    a = _j(_google_login(client))
    b = _j(_google_login(client))
    assert a["ids"] == b["ids"]
    assert Courses.select().where(Courses.is_demo == True).count() == 1  # noqa: E712


def test_dados_de_exemplo_passam_pelos_servicos_reais(client, google):
    body = _j(_google_login(client))
    em_risco = Students.get((Students.course_id == body["ids"]["course_id"]) &
                            (Students.student_name == "Carla Mendes"))
    assert Attempts.select().where(Attempts.student_id == em_risco).count() > 0
    assert StudentMastery.select().where(StudentMastery.student_id == em_risco).exists()
    # Motor de regras da proatividade gerou alerta para quem está mal.
    assert Alerts.select().where(Alerts.student_id == em_risco).exists()


@pytest.mark.parametrize("over", [
    {"aud": "outro-app"},
    {"iss": "https://evil.example"},
    {"exp": "1"},
    {"email_verified": "false"},
])
def test_credencial_invalida(client, google, over):
    google(**over)
    assert _google_login(client).status_code == 401
    assert Courses.select().where(Courses.is_demo == True).count() == 0  # noqa: E712


def test_troca_de_visao_coordenador_aluno(client, google):
    coord = _j(_google_login(client))
    aluno = _j(client.post("/demo/switch", headers=_bearer(coord["token"])))
    assert aluno["role"] == "aluno" and aluno["demo"] == "aluno_teste"
    assert aluno["ids"]["course_id"] == coord["ids"]["course_id"]

    me = _j(client.get("/student/me", headers=_bearer(aluno["token"])))
    assert me["estudante"]["demo"] == "aluno_teste"

    volta = _j(client.post("/demo/switch", headers=_bearer(aluno["token"])))
    assert volta["ids"]["student_id"] == coord["ids"]["student_id"]


def test_troca_negada_para_conta_real_e_aluno_criado(client, google, auth):
    assert client.post("/demo/switch", headers=auth(1)).status_code == 403
    coord = _j(_google_login(client))
    criado = _j(client.post("/tutor/students", headers=_bearer(coord["token"]),
                            json={"nome": "Zé"}))
    # Quem tem só a senha de um aluno criado não vira coordenador.
    login = client.post("/login", json={"ra": criado["ra"], "password": criado["senha"]})
    assert login.status_code == 200
    token = _j(login)["token"]
    assert client.post("/demo/switch", headers=_bearer(token)).status_code == 403


def test_coordenador_cria_aluno_com_perfil(client, google):
    coord = _j(_google_login(client))
    resp = client.post("/tutor/students", headers=_bearer(coord["token"]),
                       json={"nome": "Eva Nova", "perfil": "em_risco"})
    assert resp.status_code == 201
    body = _j(resp)
    assert body["aluno"]["nome"] == "Eva Nova" and len(body["ra"]) <= 10
    nova = Students.get(Students.student_id == body["aluno"]["student_id"])
    assert nova.course_id_id == coord["ids"]["course_id"] and nova.demo_kind == "criado"
    assert Attempts.select().where(Attempts.student_id == nova).exists()

    assert client.post("/tutor/students", headers=_bearer(coord["token"]),
                       json={"nome": "X", "perfil": "hacker"}).status_code == 400
    assert client.post("/tutor/students", headers=_bearer(coord["token"]),
                       json={"nome": ""}).status_code == 400


def test_criar_aluno_negado_em_curso_real(client, auth):
    resp = client.post("/tutor/students", headers=auth(9), json={"nome": "Intruso"})
    assert resp.status_code == 403
    assert client.post("/tutor/students", headers=auth(1), json={"nome": "X"}).status_code == 403


def test_coordenador_demo_nao_lista_alunos_de_outro_curso(client, google):
    coord = _j(_google_login(client))
    h = _bearer(coord["token"])
    assert client.get("/student/course/1", headers=h).status_code == 403
    assert client.get(f"/student/course/{coord['ids']['course_id']}", headers=h).status_code == 200
    assert client.get("/tutor/student/1", headers=h).status_code == 404


def test_curso_demo_fora_da_lista_publica(client, google):
    _google_login(client)
    ids = [c["course_id"] for c in json.loads(client.get("/courses").data)]
    assert ids == [1]


def test_demo_sem_login_so_com_flag(client, monkeypatch):
    assert client.post("/auth/demo", json={}).status_code == 404
    monkeypatch.setenv("EDUBOT_DEMO_SEM_LOGIN", "1")
    assert _j(client.get("/auth/config"))["demo_sem_login"] is True
    body = _j(client.post("/auth/demo", json={}))
    assert body["demo"] == "coordenador" and len(body["device"]) >= 32


def test_demo_sem_login_uma_turma_por_navegador(client, monkeypatch):
    monkeypatch.setenv("EDUBOT_DEMO_SEM_LOGIN", "1")
    a = _j(client.post("/auth/demo", json={}))
    b = _j(client.post("/auth/demo", json={}))
    # Dois navegadores (sem segredo) -> duas turmas separadas.
    assert a["ids"]["course_id"] != b["ids"]["course_id"]
    # O mesmo navegador volta com o segredo -> mesma turma, sem criar outra.
    volta = _j(client.post("/auth/demo", json={"device": a["device"]}))
    assert volta["ids"] == a["ids"] and volta["device"] == a["device"]
    assert Courses.select().where(Courses.is_demo == True).count() == 2  # noqa: E712
    # Segredo malformado não quebra: vira um navegador novo.
    novo = _j(client.post("/auth/demo", json={"device": "curto"}))
    assert novo["ids"]["course_id"] not in (a["ids"]["course_id"], b["ids"]["course_id"])
    # O banco guarda só o hash do segredo.
    assert not Students.select().where(Students.google_sub.contains(a["device"])).exists()


def test_demo_sem_login_limita_criacao_mas_nao_retorno(client, monkeypatch):
    from edubot.api.routes import demoRoute
    monkeypatch.setenv("EDUBOT_DEMO_SEM_LOGIN", "1")
    monkeypatch.setattr(demoRoute, "NEW_WORKSPACES_PER_MINUTE", 1)
    a = _j(client.post("/auth/demo", json={}))
    assert client.post("/auth/demo", json={}).status_code == 429
    assert client.post("/auth/demo", json={"device": a["device"]}).status_code == 200


def test_intervencao_nao_conta_como_acesso(client, auth):
    """O evento `received_intervention` é gravado pelo sistema: não pode zerar a
    inatividade do aluno que o agente está justamente tentando resgatar."""
    import datetime
    from edubot.data.models.learning_events import LearningEvents
    from edubot.services.student_context import _days_without_access
    agora = datetime.datetime.now()
    LearningEvents.create(student_id=1, verb="logged_in", object_type="session",
                          occurred_at=agora - datetime.timedelta(days=9))
    LearningEvents.create(student_id=1, verb="received_intervention",
                          object_type="intervention", occurred_at=agora)
    assert _days_without_access(Students.get_by_id(1)) == 9


def test_perfis_de_exemplo_caem_em_faixas_de_risco_diferentes(client, google):
    coord = _j(_google_login(client))
    turma = _j(client.get("/tutor/turma", headers=_bearer(coord["token"])))
    risco = {a["nome"]: a["risco"] for a in turma["alunos"]}
    assert not risco["Ana Ribeiro"]["em_risco"]
    assert risco["Diego Almeida"]["em_risco"]
    assert risco["Diego Almeida"]["principal"] == "inatividade"


def test_google_fora_do_ar_responde_503(client, google, monkeypatch):
    import urllib.error

    def _cai(credential):
        raise urllib.error.HTTPError("u", 503, "indisponivel", {}, None)
    monkeypatch.setattr(google_auth, "_fetch_tokeninfo", _cai)
    assert _google_login(client).status_code == 503


def test_quem_volta_nao_e_barrado_pelo_limite_de_criacao(client, google, monkeypatch):
    from edubot.api.routes import demoRoute
    monkeypatch.setattr(demoRoute, "NEW_WORKSPACES_PER_MINUTE", 1)
    assert _google_login(client).status_code == 200      # cria
    for _ in range(3):
        assert _google_login(client).status_code == 200  # volta: sem limite de criação
    google(sub="outra-pessoa")
    assert _google_login(client).status_code == 429      # 2ª criação no minuto


def test_api_de_parceiros_ignora_dados_demo(client, google, api_key):
    _google_login(client)
    h = api_key("metrics:read", "tracking:read")
    questoes = _j(client.get("/api/v1/metrics/questions", headers=h))["data"]
    assert all(q["tentativas"] == 0 for q in questoes) or questoes == []
    assert _j(client.get("/api/v1/tracking/events", headers=h))["data"] == []
    assert _j(client.get("/api/v1/tracking/progress", headers=h))["data"] == []
