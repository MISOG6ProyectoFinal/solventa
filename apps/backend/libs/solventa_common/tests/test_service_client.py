import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
from solventa_common.integration import ExternalAdapter, ServiceClient


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


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self.server.client_ports.append(self.client_address[1])
        if self.path == "/lento":
            time.sleep(0.3)
        body = b'{"ok": true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


@pytest.fixture
def servidor():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    server.client_ports = []
    hilo = threading.Thread(target=server.serve_forever, daemon=True)
    hilo.start()
    yield server
    server.shutdown()
    server.server_close()


def test_service_client_abre_una_conexion_por_peticion(servidor):
    cliente = ServiceClient("destino", f"http://127.0.0.1:{servidor.server_port}")
    try:
        for _ in range(3):
            assert cliente.get("/recurso") == {"ok": True}
    finally:
        cliente.client.close()

    assert len(set(servidor.client_ports)) == 3


def test_adaptador_externo_reutiliza_la_conexion(servidor):
    adaptador = ExternalAdapter(f"http://127.0.0.1:{servidor.server_port}")
    try:
        for _ in range(3):
            assert adaptador._request("GET", "/recurso") == {"ok": True}
    finally:
        adaptador.client.close()

    assert len(set(servidor.client_ports)) == 1


def test_service_client_sin_keep_alive_respeta_su_timeout(servidor):
    cliente = ServiceClient("destino", f"http://127.0.0.1:{servidor.server_port}", timeout_s=0.1)
    try:
        with pytest.raises(httpx.TimeoutException):
            cliente.get("/lento")
        assert cliente.get("/recurso") == {"ok": True}
    finally:
        cliente.client.close()
