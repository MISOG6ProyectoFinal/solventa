from fastapi import APIRouter

router = APIRouter(prefix="/pagos", tags=["Cobros y Pagos"])


@router.get("/")
def info() -> dict:
    return {"component": "Cobros y Pagos"}
