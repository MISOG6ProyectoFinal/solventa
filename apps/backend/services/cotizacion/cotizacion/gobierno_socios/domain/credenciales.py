"""Generación y verificación de las credenciales de API de un socio."""

import hashlib
import hmac
import re
import secrets

PREFIJO_CLIENT_ID = "sv_live_"
PREFIJO_SECRETO = "sv_sec_"


def generar_client_id(identificador: str) -> str:
    slug = re.sub(r"[^a-z0-9]", "", identificador.lower())[:12]
    return f"{PREFIJO_CLIENT_ID}{slug}_{secrets.token_hex(2)}"


def generar_secreto() -> str:
    return f"{PREFIJO_SECRETO}{secrets.token_urlsafe(24)}"


def hash_secreto(secreto: str) -> str:
    # El secreto tiene 192 bits de entropía: SHA-256 basta, sin sal ni función lenta.
    return hashlib.sha256(secreto.encode()).hexdigest()


def secreto_coincide(secreto: str, secreto_hash: str) -> bool:
    return hmac.compare_digest(hash_secreto(secreto), secreto_hash)


def enmascarar(secreto: str) -> str:
    return f"{PREFIJO_SECRETO}••••••••{secreto[-4:]}"
