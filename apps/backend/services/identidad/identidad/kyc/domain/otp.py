import hashlib
import secrets


def generar_codigo() -> str:
    """Genera un código OTP de 6 dígitos."""
    return str(secrets.randbelow(900000) + 100000)


def hash_codigo(codigo: str) -> str:
    """Genera hash SHA-256 del código OTP."""
    return hashlib.sha256(codigo.strip().encode("utf-8")).hexdigest()


def verificar_codigo(codigo: str, hash_guardado: str) -> bool:
    """Verifica si el código provisto coincide con el hash almacenado."""
    return hash_codigo(codigo) == hash_guardado
