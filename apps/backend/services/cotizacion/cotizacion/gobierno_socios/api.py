from fastapi import APIRouter

router = APIRouter(prefix="/gobierno-socios", tags=["Socios y Gobierno de API"])


@router.get("/")
def info() -> dict:
    return {"component": "Socios y Gobierno de API"}
