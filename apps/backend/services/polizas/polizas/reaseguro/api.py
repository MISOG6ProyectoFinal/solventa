from fastapi import APIRouter

router = APIRouter(prefix="/reaseguro", tags=["Reaseguro y Cesión"])


@router.get("/")
def info() -> dict:
    return {"component": "Reaseguro y Cesión"}
