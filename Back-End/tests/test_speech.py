"""V.1 — voz do EduBot (Polly + visemas) com degradação graciosa."""
import json

from edubot.services import speech


def test_speak_unavailable_returns_fallback(client, auth, monkeypatch):
    # Polly indisponível (sem credencial): a rota diz available:false e o front
    # usa o Web Speech. Nada quebra.
    monkeypatch.setattr(speech, "synthesize", lambda text, lang="pt": None)
    resp = client.post("/edubot/speak", data=json.dumps({"text": "olá", "lang": "pt"}),
                       headers=auth())
    assert resp.status_code == 200
    assert json.loads(resp.data)["available"] is False


def test_speak_available_returns_audio_and_visemes(client, auth, monkeypatch):
    fake = {"key": "a" * 64, "visemes": [{"time_ms": 0, "viseme": "sil"},
                                         {"time_ms": 120, "viseme": "a"}], "cached": False}
    monkeypatch.setattr(speech, "synthesize", lambda text, lang="pt": fake)
    resp = client.post("/edubot/speak", data=json.dumps({"text": "oi", "lang": "pt"}),
                       headers=auth())
    data = json.loads(resp.data)
    assert data["available"] is True
    assert data["audio_url"] == f"/edubot/speech/{'a' * 64}.mp3"
    assert data["visemes"][1]["viseme"] == "a"


def test_speak_requires_auth(client):
    resp = client.post("/edubot/speak", data=json.dumps({"text": "x"}),
                       headers={"Content-Type": "application/json"})
    assert resp.status_code == 401


def test_mp3_unknown_key_404(client):
    resp = client.get(f"/edubot/speech/{'b' * 64}.mp3")
    assert resp.status_code == 404


def test_cached_mp3_path_rejects_traversal():
    # key inválida (não é hash sha256) -> None (evita path traversal)
    assert speech.cached_mp3_path("../../etc/passwd") is None
    assert speech.cached_mp3_path("not-hex-zz") is None
    assert speech.cached_mp3_path("a" * 63) is None  # tamanho errado


def test_parse_visemes():
    marks = '{"time":0,"type":"viseme","value":"sil"}\n{"time":90,"type":"viseme","value":"p"}\n'
    out = speech._parse_visemes(marks)
    assert out == [{"time_ms": 0, "viseme": "sil"}, {"time_ms": 90, "viseme": "p"}]
