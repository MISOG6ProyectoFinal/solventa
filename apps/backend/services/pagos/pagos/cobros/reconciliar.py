"""Closes payments left in PROCESANDO: python -m pagos.cobros.reconciliar [--antiguedad-s 120]."""

import argparse
import json
from datetime import timedelta

from solventa_common.db import build_engine

from pagos.cobros.adapters.pasarela import construir_pasarela
from pagos.cobros.adapters.repository import PostgresCobroRepository
from pagos.cobros.domain.use_cases import ReconciliarCobrosUseCase
from pagos.config import settings


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--antiguedad-s", type=float, default=120)
    args = parser.parse_args(argv)
    if not settings.database_url:
        raise SystemExit("DATABASE_URL is required")
    repositorio = PostgresCobroRepository(build_engine(settings.database_url))
    caso = ReconciliarCobrosUseCase(repositorio, construir_pasarela(), timedelta(seconds=args.antiguedad_s))
    cerrados = caso.execute()
    resumen = [{"idempotency_key": cobro.idempotency_key, "estado": cobro.estado.value} for cobro in cerrados]
    print(json.dumps({"cerrados": resumen}))


if __name__ == "__main__":
    main()
