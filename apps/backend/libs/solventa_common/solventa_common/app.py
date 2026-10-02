"""Fábrica de aplicaciones FastAPI con las piezas comunes ya conectadas."""

import uuid
from collections.abc import Iterable

from fastapi import APIRouter, FastAPI, Request

from solventa_common.health import ReadinessCheck, build_health_router
from solventa_common.logging import configure_logging
from solventa_common.settings import ServiceSettings


def create_app(
    settings: ServiceSettings,
    routers: Iterable[APIRouter] = (),
    readiness_checks: dict[str, ReadinessCheck] | None = None,
    **fastapi_kwargs,
) -> FastAPI:
    configure_logging(settings.service_name, settings.log_level)
    app = FastAPI(title=settings.service_name, **fastapi_kwargs)

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["x-request-id"] = rid
        return response

    app.include_router(build_health_router(settings.service_name, readiness_checks))
    for router in routers:
        app.include_router(router)
    return app
