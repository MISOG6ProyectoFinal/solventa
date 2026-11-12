"""Forma única del error de negocio que devuelven todos los servicios: {codigo, mensaje}."""

from fastapi import HTTPException


def error_detail(codigo: str, mensaje: str) -> dict:
    return {"codigo": codigo, "mensaje": mensaje}


def api_error(status_code: int, codigo: str, mensaje: str) -> HTTPException:
    return HTTPException(status_code, error_detail(codigo, mensaje))
