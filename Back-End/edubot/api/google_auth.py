# Login com Google — verificação do ID token emitido pelo Google Identity Services.
#
# Fluxo: o front renderiza o botão "Entrar com Google" (GIS), o Google devolve um
# ID token (JWT) ao navegador e o front o manda para POST /auth/google. Aqui o
# token é validado no endpoint `tokeninfo` do próprio Google (assinatura, emissor
# e validade conferidos por ele) e nós conferimos o que é nosso: `aud` igual ao
# client id do Engage-Agent, emissor do Google, não expirado e e-mail verificado.
#
# Stdlib apenas (urllib), sem dependência nova — mesmo espírito do auth.py. A
# função de rede fica isolada em `_fetch_tokeninfo` para os testes a trocarem.
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger("edubot.google_auth")

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


def google_client_ids():
    """Client ids OAuth aceitos (EDUBOT_GOOGLE_CLIENT_ID; vírgula separa vários)."""
    raw = os.environ.get("EDUBOT_GOOGLE_CLIENT_ID", "")
    return [c.strip() for c in raw.split(",") if c.strip()]


def google_login_enabled():
    return bool(google_client_ids())


def _fetch_tokeninfo(credential):
    url = f"{TOKENINFO_URL}?{urllib.parse.urlencode({'id_token': credential})}"
    with urllib.request.urlopen(url, timeout=6) as resp:  # noqa: S310 (URL fixa https)
        return json.loads(resp.read().decode("utf-8"))


def verify_google_credential(credential):
    """Valida o ID token. Devolve {sub, email, name, picture} ou None se inválido."""
    if not credential or not isinstance(credential, str) or len(credential) > 4096:
        return None
    allowed = google_client_ids()
    if not allowed:
        return None
    try:
        info = _fetch_tokeninfo(credential)
    except urllib.error.HTTPError as err:
        # 400 do tokeninfo = token inválido/expirado/adulterado. 429/5xx é o
        # Google indisponível: sobe, e a rota responde 503 (não 401).
        if err.code == 400:
            return None
        logger.warning("tokeninfo do Google respondeu %s", err.code)
        raise
    except Exception:
        logger.exception("Falha ao consultar o tokeninfo do Google")
        raise

    if info.get("aud") not in allowed:
        return None
    if info.get("iss") not in GOOGLE_ISSUERS:
        return None
    try:
        if int(info.get("exp", 0)) < time.time():
            return None
    except (TypeError, ValueError):
        return None
    if str(info.get("email_verified", "")).lower() != "true":
        return None
    sub = info.get("sub")
    if not sub:
        return None
    return {
        "sub": str(sub),
        "email": info.get("email"),
        "name": info.get("name") or (info.get("email") or "").split("@")[0],
        "picture": info.get("picture"),
    }
