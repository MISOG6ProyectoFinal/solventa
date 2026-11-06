"""Aplicación HTTP de los terceros simulados y de su control de fallos."""

from solventa_common.app import create_app

from simuladores.config import settings
from simuladores.control import router as control_router
from simuladores.providers import assistance_network, notifications, open_finance, outbox_view, payment_gateway

app = create_app(
    settings,
    routers=[outbox_view, control_router, open_finance, payment_gateway, notifications, assistance_network],
)
