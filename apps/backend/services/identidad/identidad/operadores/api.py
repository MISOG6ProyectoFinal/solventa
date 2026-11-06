from fastapi import APIRouter, HTTPException, status

from identidad.container import container
from identidad.operadores.domain.models import (
    EmailTaken,
    InvalidOperatorCredentials,
    NewOperator,
    OperatorLogin,
    OperatorNotFound,
    OperatorSession,
    OperatorUpdate,
    OperatorView,
)

router = APIRouter(prefix="/identidad/operadores", tags=["Operadores del portal"])


@router.post("/sesiones", response_model=OperatorSession)
def start_session(request: OperatorLogin) -> OperatorSession:
    try:
        return container.start_operator_session.execute(request.correo, request.contrasena)
    except InvalidOperatorCredentials as exc:
        detail = {"codigo": "credenciales_invalidas", "mensaje": "Correo o contraseña incorrectos."}
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail) from exc


@router.get("", response_model=list[OperatorView])
def list_operators() -> list[OperatorView]:
    return container.list_operators.execute()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=OperatorView)
def create_operator(request: NewOperator) -> OperatorView:
    try:
        return container.create_operator.execute(request)
    except EmailTaken as exc:
        detail = {"codigo": "correo_registrado", "mensaje": "Ya existe un operador con este correo."}
        raise HTTPException(status.HTTP_409_CONFLICT, detail) from exc


@router.patch("/{operator_id}", response_model=OperatorView)
def update_operator(operator_id: str, request: OperatorUpdate) -> OperatorView:
    try:
        return container.update_operator.execute(operator_id, request)
    except OperatorNotFound as exc:
        detail = {"codigo": "operador_no_encontrado", "mensaje": "El operador no existe."}
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail) from exc
