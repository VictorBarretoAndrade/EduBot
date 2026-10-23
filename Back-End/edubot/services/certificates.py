"""Plano 6 — avaliação do certificado de um curso externo (ex.: Cisco NetAcad).

O aluno faz o curso fora da plataforma e envia o certificado em PDF; o Engage-
Agent confere se o arquivo parece mesmo o certificado daquele curso.

Hoje a avaliação é SIMULADA (determinística, sem custo): lê o texto que o PDF
expõe — inclusive dentro de streams comprimidos com FlateDecode — e procura os
sinais de um certificado da Cisco. O ponto de troca para uma LLM real é
`evaluate_certificate`: mesma entrada (texto extraído + curso esperado), mesma
saída ({status, feedback, feedback_en, mock}).
"""
import re
import zlib

MAX_BYTES = 5 * 1024 * 1024
ISSUER_SIGNS = ("cisco", "netacad", "networking academy")
CERT_SIGNS = ("certificate", "certificado", "completion", "conclusão", "conclusao",
              "has successfully", "concluiu", "achievement", "badge")


def _pdf_text(data: bytes) -> str:
    """Texto legível do PDF: bytes crus + streams FlateDecode descomprimidos."""
    chunks = [data]
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", data, re.S):
        try:
            chunks.append(zlib.decompress(m.group(1)))
        except zlib.error:
            continue
    return " ".join(c.decode("latin-1", errors="ignore") for c in chunks).lower()


def evaluate_certificate(data: bytes, filename: str, course_title: str) -> dict:
    """Avalia o arquivo enviado. Retorna {status, feedback, feedback_en, mock}."""
    if not data.startswith(b"%PDF-"):
        return {"status": "recusado", "mock": True,
                "feedback": "O arquivo não é um PDF válido. Envie o certificado exportado pela Cisco em PDF.",
                "feedback_en": "This file isn't a valid PDF. Please upload the certificate exported from Cisco as a PDF."}

    text = _pdf_text(data) + " " + (filename or "").lower()
    has_issuer = any(sign in text for sign in ISSUER_SIGNS)
    has_cert = any(sign in text for sign in CERT_SIGNS)
    title_words = [w for w in re.findall(r"[a-z]{5,}", course_title.lower())]
    mentions_course = bool(title_words) and all(w in text for w in title_words)

    if has_issuer and (has_cert or mentions_course):
        return {"status": "aprovado", "mock": True,
                "feedback": f"Certificado reconhecido: emitido pela Cisco Networking Academy para \"{course_title}\". Parabéns!",
                "feedback_en": f"Certificate recognized: issued by Cisco Networking Academy for \"{course_title}\". Congratulations!"}
    if has_issuer:
        return {"status": "recusado", "mock": True,
                "feedback": "O PDF é da Cisco, mas não parece um certificado de conclusão deste curso. Envie o certificado final.",
                "feedback_en": "The PDF is from Cisco, but it doesn't look like a completion certificate for this course. Please upload the final certificate."}
    return {"status": "recusado", "mock": True,
            "feedback": "Não encontrei sinais de um certificado da Cisco Networking Academy neste PDF.",
            "feedback_en": "I couldn't find signs of a Cisco Networking Academy certificate in this PDF."}
