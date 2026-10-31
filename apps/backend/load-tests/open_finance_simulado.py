"""Open Finance simulado para la prueba de degradación (HU018).

python load-tests/open_finance_simulado.py --puerto 9090
curl -X POST localhost:9090/modo/lento    # responde después del timeout de Cotización
curl -X POST localhost:9090/modo/caido    # responde 503
curl -X POST localhost:9090/modo/normal
curl localhost:9090/estadisticas          # llamadas recibidas por modo
"""

import argparse
import hashlib
import json
import threading
import time
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODES = ("normal", "lento", "caido")


class Simulator:
    def __init__(self, delay_s: float) -> None:
        self.mode = "normal"
        self.delay_s = delay_s
        self.calls: Counter[str] = Counter()
        self.lock = threading.Lock()

    def record(self) -> str:
        with self.lock:
            self.calls[self.mode] += 1
            return self.mode


def score_for(customer_id: str) -> str:
    digest = hashlib.sha256(customer_id.encode()).digest()
    return f"{(30 + digest[0] % 41) / 100:.2f}"


def build_handler(simulator: Simulator) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status: int, body: dict) -> None:
            payload = json.dumps(body).encode()
            try:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            if self.path == "/estadisticas":
                with simulator.lock:
                    self._send(200, {"modo": simulator.mode, "llamadas": dict(simulator.calls)})
                return
            if not self.path.startswith("/customers/"):
                self._send(404, {"detail": "Ruta desconocida"})
                return
            mode = simulator.record()
            if mode == "caido":
                self._send(503, {"detail": "Open Finance no disponible"})
                return
            if mode == "lento":
                time.sleep(simulator.delay_s)
            self._send(200, {"score_riesgo": score_for(self.path.split("/")[2])})

        def do_POST(self):
            mode = self.path.removeprefix("/modo/")
            if mode not in MODES:
                self._send(400, {"detail": f"Modo inválido. Use {', '.join(MODES)}"})
                return
            with simulator.lock:
                simulator.mode = mode
            print(f"{time.strftime('%H:%M:%S')} modo {mode}", flush=True)
            self._send(200, {"modo": mode})

        def log_message(self, *args):
            pass

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--puerto", type=int, default=9090)
    parser.add_argument("--demora", type=float, default=2.0, help="Segundos que tarda en modo lento")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("0.0.0.0", args.puerto), build_handler(Simulator(args.demora)))
    print(f"Open Finance simulado en el puerto {args.puerto}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
