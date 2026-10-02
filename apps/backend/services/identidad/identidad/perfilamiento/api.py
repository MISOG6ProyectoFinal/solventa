from fastapi import APIRouter

router = APIRouter(prefix="/perfiles", tags=["Perfilamiento y Personalización"])


@router.get("/")
def info() -> dict:
    return {"component": "Perfilamiento y Personalización"}
