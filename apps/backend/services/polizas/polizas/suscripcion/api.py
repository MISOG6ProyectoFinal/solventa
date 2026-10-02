from fastapi import APIRouter

router = APIRouter(prefix="/suscripciones", tags=["Suscripción"])


@router.get("/")
def info() -> dict:
    return {"component": "Suscripción"}
