import httpx
import pytest
from solventa_common.integration import ServiceClient


def test_service_client_conserva_timeout_de_un_segundo():
    cliente = ServiceClient("destino", "https://service.test")
    try:
        assert ServiceClient.timeout_s == pytest.approx(1.0)
        assert cliente.timeout_s == pytest.approx(1.0)
        assert "timeout_s" not in cliente.__dict__
        assert cliente.client.timeout == httpx.Timeout(1.0)
    finally:
        cliente.client.close()


def test_service_client_acepta_timeout_por_instancia():
    cliente = ServiceClient("destino", "https://service.test", timeout_s=5.0)
    try:
        assert cliente.timeout_s == pytest.approx(5.0)
        assert cliente.client.timeout == httpx.Timeout(5.0)
        assert ServiceClient.timeout_s == pytest.approx(1.0)
    finally:
        cliente.client.close()
