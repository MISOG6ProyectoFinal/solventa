"""El socio declara la versión del contrato en X-Api-Version y el gateway la enruta a esa versión."""

import re

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from canales.socios.api import SUPPORTED_VERSIONS

API_VERSION_HEADER = "X-Api-Version"
PREFIX = "/socios"
_VERSIONED_PATH = re.compile(rf"^{PREFIX}/v\d+(/|$)")


class DeclaredVersionRouter:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not self._routable(scope["path"]):
            await self.app(scope, receive, send)
            return
        version = Headers(scope=scope).get(API_VERSION_HEADER)
        if version is None:
            await self.app(scope, receive, send)
            return
        if version not in SUPPORTED_VERSIONS:
            detail = {
                "codigo": "version_no_soportada",
                "mensaje": f"La versión '{version}' del contrato no está disponible.",
                "versiones": list(SUPPORTED_VERSIONS),
            }
            await JSONResponse({"detail": detail}, status_code=400)(scope, receive, send)
            return
        path = f"{PREFIX}/{version}{scope['path'][len(PREFIX) :]}"
        await self.app({**scope, "path": path, "raw_path": path.encode()}, receive, send)

    @staticmethod
    def _routable(path: str) -> bool:
        return path.startswith(f"{PREFIX}/") and path != f"{PREFIX}/" and not _VERSIONED_PATH.match(path)
