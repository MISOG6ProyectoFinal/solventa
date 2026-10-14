"""Contraseña de un cliente. El token vive en solventa_common porque el BFF también lo verifica."""

import hashlib
import hmac
import secrets

# A password a person types. Partner API secrets use SHA-256 because they already have high entropy.
ITERATIONS = 210_000


def new_salt() -> str:
    return secrets.token_bytes(16).hex()


def hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), ITERATIONS)
    return digest.hex()


def password_matches(password: str, password_hash: str, salt: str) -> bool:
    try:
        candidate = hash_password(password, salt)
    except ValueError:
        return False
    return hmac.compare_digest(candidate, password_hash)
