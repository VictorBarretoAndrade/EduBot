"""Plano 6 — "Esqueci minha senha": pedido vira alerta; o professor gera senha temporária."""
import json

from edubot.data.models.alerts import Alerts


def _forgot(client, ra):
    return client.post("/login/forgot-password", data=json.dumps({"ra": ra}),
                       content_type="application/json")


def test_forgot_creates_single_alert_and_hides_existence(client, seeded_db):
    known = _forgot(client, "111")
    unknown = _forgot(client, "nao-existe")
    # Mesma resposta para conta existente e inexistente (não revela quem é aluno).
    assert known.status_code == unknown.status_code == 202
    assert known.data == unknown.data
    _forgot(client, "111")                       # pedido repetido não duplica
    alerts = list(Alerts.select().where(Alerts.type == "redefinir_senha"))
    assert len(alerts) == 1 and alerts[0].student_id.student_id == 1
    assert alerts[0].message_en.endswith("asked to reset their password.")


def test_forgot_accepts_username(client, seeded_db):
    _forgot(client, "ana souza")
    assert Alerts.select().where(Alerts.type == "redefinir_senha").count() == 1


def test_tutor_reset_gives_working_temporary_password(client, auth, seeded_db):
    _forgot(client, "111")
    alert = Alerts.get(Alerts.type == "redefinir_senha")
    r = client.post("/tutor/reset-password", headers=auth(9),
                    data=json.dumps({"alert_id": alert.alert_id}))
    assert r.status_code == 200
    temp = json.loads(r.data)["senha_temporaria"]
    assert len(temp) == 8
    assert Alerts.get_by_id(alert.alert_id).read is True
    old = client.post("/login", data=json.dumps({"ra": "111", "password": "111"}),
                      content_type="application/json")
    new = client.post("/login", data=json.dumps({"ra": "111", "password": temp}),
                      content_type="application/json")
    assert old.status_code == 401 and new.status_code == 200


def test_reset_only_for_tutors_and_password_alerts(client, auth, seeded_db):
    _forgot(client, "111")
    alert = Alerts.get(Alerts.type == "redefinir_senha")
    r = client.post("/tutor/reset-password", headers=auth(2),
                    data=json.dumps({"alert_id": alert.alert_id}))
    assert r.status_code == 403
    import datetime
    other = Alerts.create(student_id=1, type="inatividade", message="x", severity="alta",
                          created_at=datetime.datetime.now(), read=False)
    r = client.post("/tutor/reset-password", headers=auth(9),
                    data=json.dumps({"alert_id": other.alert_id}))
    assert r.status_code == 400
