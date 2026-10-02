"""Endpoints de salud que consumen las probes de Kubernetes y el Monitor de Salud y Retiro."""

from collections.abc import Callable
from time import monotonic

from fastapi import APIRouter, Response, status

ReadinessCheck = Callable[[], bool]


def build_health_router(service_name: str, checks: dict[str, ReadinessCheck] | None = None) -> APIRouter:
    """/health/live responde si el proceso vive; /health/ready si sus dependencias responden.

    Un pod que falla readiness sale del Service y deja de recibir tráfico (retiro automático).
    """
    router = APIRouter(prefix="/health", tags=["health"])
    started = monotonic()
    checks = checks or {}

    @router.get("/live")
    def live() -> dict:
        return {"service": service_name, "status": "up", "uptime_s": round(monotonic() - started, 1)}

    @router.get("/ready")
    def ready(response: Response) -> dict:
        results = {}
        for name, check in checks.items():
            try:
                results[name] = bool(check())
            except Exception:  # noqa: BLE001 - una dependencia caída no debe tumbar la probe
                results[name] = False
        ok = all(results.values())
        if not ok:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"service": service_name, "status": "ready" if ok else "degraded", "checks": results}

    return router
