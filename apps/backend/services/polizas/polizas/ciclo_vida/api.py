from fastapi import APIRouter

router = APIRouter(prefix="/polizas", tags=["Pólizas y Ciclo de Vida"])


@router.get("/")
def info() -> dict:
    return {"component": "Pólizas y Ciclo de Vida"}
