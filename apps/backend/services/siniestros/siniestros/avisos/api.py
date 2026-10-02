from fastapi import APIRouter

router = APIRouter(prefix="/siniestros", tags=["Siniestros"])


@router.get("/")
def info() -> dict:
    return {"component": "Siniestros"}
