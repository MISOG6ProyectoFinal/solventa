"""Fábrica de aplicaciones FastAPI con las piezas comunes ya conectadas."""

import logging
import time
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
    http_log = logging.getLogger("solventa.http")

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        quiet = request.url.path.startswith("/health/")
        started = time.perf_counter()
        if not quiet:
            http_log.info("request %s %s %s", request.method, request.url.path, rid)
        try:
            response = await call_next(request)
        except Exception:
            if not quiet:
                http_log.exception("failed %s %s %s", request.method, request.url.path, rid)
            raise
        response.headers["x-request-id"] = rid
        if not quiet:
            elapsed_ms = round((time.perf_counter() - started) * 1000)
            http_log.info(
                "response %s %s %s %s %sms",
                request.method,
                request.url.path,
                response.status_code,
                rid,
                elapsed_ms,
            )
        return response

    app.include_router(build_health_router(settings.service_name, readiness_checks))
    for router in routers:
        app.include_router(router)
    return app
