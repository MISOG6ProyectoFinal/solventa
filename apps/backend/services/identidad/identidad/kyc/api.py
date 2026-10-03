from fastapi import APIRouter

router = APIRouter(prefix="/identidad", tags=["Identidad, Consentimiento y KYC"])


@router.get("/")
def info() -> dict:
    return {"component": "Identidad, Consentimiento y KYC"}
