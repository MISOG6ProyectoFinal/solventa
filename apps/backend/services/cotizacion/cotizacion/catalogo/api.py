from fastapi import APIRouter

router = APIRouter(prefix="/catalogo", tags=["Catálogo de Productos"])


@router.get("/")
def info() -> dict:
    return {"component": "Catálogo de Productos"}
