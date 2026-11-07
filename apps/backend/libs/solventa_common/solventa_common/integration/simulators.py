"""Dirección de los terceros simulados dentro del clúster.

Entre pods el tráfico es HTTP plano, igual que entre los servicios de Solventa; TLS termina en el borde.
"""

CLUSTER_SCHEME = "http"
SIMULATORS_HOST = "simuladores"


def simulated_provider(provider: str) -> str:
    return f"{CLUSTER_SCHEME}://{SIMULATORS_HOST}/{provider}"
