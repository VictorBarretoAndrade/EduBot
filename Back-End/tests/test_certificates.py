"""Plano 6 — curso externo (Cisco) com envio de certificado em PDF."""
import io
import json
import zlib

from edubot.data.models.certificate_submissions import CertificateSubmissions
from edubot.data.models.resource_progress import ResourceProgress
from edubot.data.models.resources import Resources
from edubot.services.certificates import evaluate_certificate

COURSE = "Introduction to Cybersecurity"


def _pdf(text: str, compress=True) -> bytes:
    body = text.encode("latin-1")
    stream = zlib.compress(body) if compress else body
    return b"%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n" + stream + b"\nendstream\nendobj\n%%EOF"


def _external_course():
    return Resources.create(resource_id=500, ova_id=1, resource_type="curso_externo",
                            resource_title="Curso Cisco: Introduction to Cybersecurity",
                            resource_title_en="Cisco course: Introduction to Cybersecurity",
                            resource_url="https://www.netacad.com/courses/introduction-to-cybersecurity",
                            competency_id=1)


def test_evaluate_recognizes_compressed_cisco_certificate():
    good = _pdf("Cisco Networking Academy - Certificate of Course Completion - Introduction to Cybersecurity")
    assert evaluate_certificate(good, "cert.pdf", COURSE)["status"] == "aprovado"


def test_evaluate_rejects_non_pdf_and_unrelated_pdf():
    assert evaluate_certificate(b"hello", "cert.pdf", COURSE)["status"] == "recusado"
    other = _pdf("Boleto bancario numero 123")
    result = evaluate_certificate(other, "boleto.pdf", COURSE)
    assert result["status"] == "recusado" and result["mock"] is True


def _post(client, auth, sid, data, name="cert.pdf", lang="pt"):
    return client.post(f"/resource/500/certificate?lang={lang}", headers=auth(sid),
                       data={"file": (io.BytesIO(data), name)},
                       content_type="multipart/form-data")


def test_approved_certificate_completes_resource(client, auth, seeded_db):
    _external_course()
    listed = json.loads(client.get("/external-courses?lang=en", headers=auth(1)).data)
    assert listed[0]["titulo"].startswith("Cisco course") and listed[0]["certificado"]["status"] is None

    r = _post(client, auth, 1, _pdf("Cisco NetAcad certificate " + COURSE), lang="en")
    assert r.status_code == 201
    body = json.loads(r.data)
    assert body["status"] == "aprovado" and body["feedback"].startswith("Certificate recognized")
    rp = ResourceProgress.get((ResourceProgress.student_id == 1) & (ResourceProgress.resource_id == 500))
    assert rp.completed and rp.perc_consumed == 100
    sub = CertificateSubmissions.get()
    assert len(sub.sha256) == 64            # só a impressão digital, não o arquivo


def test_rejected_certificate_does_not_complete(client, auth, seeded_db):
    _external_course()
    r = _post(client, auth, 1, b"not a pdf")
    assert json.loads(r.data)["status"] == "recusado"
    assert ResourceProgress.get_or_none(ResourceProgress.resource_id == 500) is None


def test_certificate_only_for_external_courses(client, auth, seeded_db):
    Resources.create(resource_id=501, ova_id=1, resource_type="video", resource_title="v")
    r = client.post("/resource/501/certificate", headers=auth(1),
                    data={"file": (io.BytesIO(_pdf("Cisco certificate")), "c.pdf")},
                    content_type="multipart/form-data")
    assert r.status_code == 404
