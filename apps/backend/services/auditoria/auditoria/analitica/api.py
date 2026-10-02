from fastapi import APIRouter

router = APIRouter(prefix="/analitica", tags=["Analítica, Fraude y Cumplimiento"])


@router.get("/")
def info() -> dict:
    return {"component": "Analítica, Fraude y Cumplimiento"}
