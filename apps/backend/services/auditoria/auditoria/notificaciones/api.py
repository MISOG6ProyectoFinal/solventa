from fastapi import APIRouter

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("/")
def info() -> dict:
    return {"component": "Notificaciones"}
