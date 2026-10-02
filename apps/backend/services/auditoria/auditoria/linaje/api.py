from fastapi import APIRouter

router = APIRouter(prefix="/auditoria", tags=["Auditoría y Linaje del Dato"])


@router.get("/")
def info() -> dict:
    return {"component": "Auditoría y Linaje del Dato"}
