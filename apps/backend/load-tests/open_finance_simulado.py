"""Open Finance simulado para la prueba de degradación (HU018).

poetry run python load-tests/open_finance_simulado.py --puerto 9090
curl -X POST localhost:9090/modo/lento    # responde después del timeout de Cotización
curl -X POST localhost:9090/modo/caido    # responde 503
curl -X POST localhost:9090/modo/normal
curl localhost:9090/estadisticas          # llamadas recibidas por modo
"""

import argparse
import asyncio
import hashlib
import time
from collections import Counter

import uvicorn
from fastapi import FastAPI, HTTPException

MODES = ("normal", "lento", "caido")


class Simulator:
    def __init__(self, delay_s: float) -> None:
        self.mode = "normal"
        self.delay_s = delay_s
        self.calls: Counter[str] = Counter()

    def record(self) -> str:
        self.calls[self.mode] += 1
        return self.mode


def score_for(customer_id: str) -> str:
    digest = hashlib.sha256(customer_id.encode()).digest()
    return f"{(30 + digest[0] % 41) / 100:.2f}"


def build_app(simulator: Simulator) -> FastAPI:
    app = FastAPI(title="Open Finance simulado")

    @app.get("/customers/{customer_id}/profile")
    async def profile(customer_id: str) -> dict:
        mode = simulator.record()
        if mode == "caido":
            raise HTTPException(503, "Open Finance no disponible")
        if mode == "lento":
            await asyncio.sleep(simulator.delay_s)
        return {"score_riesgo": score_for(customer_id)}

    @app.post("/modo/{mode}")
    async def change_mode(mode: str) -> dict:
        if mode not in MODES:
            raise HTTPException(400, f"Modo inválido. Use {', '.join(MODES)}")
        simulator.mode = mode
        print(f"{time.strftime('%H:%M:%S')} modo {mode}", flush=True)
        return {"modo": mode}

    @app.get("/estadisticas")
    async def stats() -> dict:
        return {"modo": simulator.mode, "llamadas": dict(simulator.calls)}

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--puerto", type=int, default=9090)
    parser.add_argument("--demora", type=float, default=2.0, help="Segundos que tarda en modo lento")
    args = parser.parse_args()
    print(f"Open Finance simulado en el puerto {args.puerto}", flush=True)
    uvicorn.run(build_app(Simulator(args.demora)), host="127.0.0.1", port=args.puerto, log_level="warning")


if __name__ == "__main__":
    main()
