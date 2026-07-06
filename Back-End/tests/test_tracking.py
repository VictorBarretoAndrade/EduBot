"""A1 — tempo de leitura por delta acumulado no servidor."""
import json

from edubot.data.models.ova_progress import OVAProgress


def _post(client, headers, body):
    return client.post("/progress/ova", headers=headers, data=json.dumps(body))


def test_read_time_accumulates_across_syncs(client, auth):
    h = auth(1)
    _post(client, h, {"ova_id": 1, "seconds_delta": 30, "perc_scrolled": 10})
    _post(client, h, {"ova_id": 1, "seconds_delta": 45, "perc_scrolled": 5})
    row = OVAProgress.get(OVAProgress.student_id == 1, OVAProgress.ova_id == 1)
    # Antes o backend fazia max() -> 45; agora acumula -> 75
    assert row.read_time == 75


def test_perc_scrolled_is_high_water_mark(client, auth):
    h = auth(1)
    _post(client, h, {"ova_id": 1, "seconds_delta": 5, "perc_scrolled": 80})
    _post(client, h, {"ova_id": 1, "seconds_delta": 5, "perc_scrolled": 20})
    row = OVAProgress.get(OVAProgress.student_id == 1, OVAProgress.ova_id == 1)
    assert row.perc_scrolled == 80


def test_legacy_absolute_read_time_still_supported(client, auth):
    h = auth(1)
    # cliente legado manda read_time absoluto (sem seconds_delta) -> max()
    _post(client, h, {"ova_id": 1, "read_time": 100, "perc_scrolled": 10})
    _post(client, h, {"ova_id": 1, "read_time": 60, "perc_scrolled": 10})
    row = OVAProgress.get(OVAProgress.student_id == 1, OVAProgress.ova_id == 1)
    assert row.read_time == 100


def test_unknown_ova_returns_400(client, auth):
    r = _post(client, auth(1), {"ova_id": 999, "seconds_delta": 5})
    assert r.status_code == 400
