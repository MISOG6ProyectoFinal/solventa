import httpx
import pytest
from canales.clients import cotizacion, identidad, pagos, polizas, siniestros
from canales.config import settings
from solventa_common.integration import ServiceClient


def test_el_cliente_de_cotizacion_usa_el_timeout_configurado():
    assert settings.cotizacion_timeout_s == 5.0
    assert cotizacion.timeout_s == settings.cotizacion_timeout_s
    assert cotizacion.client.timeout == httpx.Timeout(settings.cotizacion_timeout_s)
    assert ServiceClient.timeout_s == 1.0


@pytest.mark.parametrize(
    "cliente",
    [polizas, siniestros, identidad, pagos],
    ids=["polizas", "siniestros", "identidad", "pagos"],
)
def test_los_demas_clientes_conservan_timeout_de_un_segundo(cliente):
    assert cliente.timeout_s == 1.0
    assert "timeout_s" not in cliente.__dict__
    assert cliente.client.timeout == httpx.Timeout(1.0)
