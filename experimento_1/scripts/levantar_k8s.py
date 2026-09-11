#!/usr/bin/env python3
"""Levanta minikube y despliega Cotización (2 réplicas) más el API Gateway nginx.

No aplica cotizacion-probe-corrida-b.yaml: esa corrida se hace después, a mano.
Sirve en Windows y macOS: solo hace falta Python 3, Docker, minikube y kubectl.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
K8S = RAIZ / "k8s"

IMAGEN_COTIZACION = "cotizacion:experimento-1"
IMAGEN_NGINX = "nginx:1.27-alpine"

MANIFIESTOS = (
    "namespace.yaml",
    "cotizacion-deployment.yaml",
    "cotizacion-service.yaml",
    "gateway-configmap.yaml",
    "gateway-deployment.yaml",
    "gateway-service.yaml",
)


def comando(nombre: str) -> str:
    ruta = shutil.which(nombre)
    if not ruta:
        sys.exit(f"No se encontró '{nombre}' en el PATH.")
    return ruta


def correr(args: list[str], *, critico: bool = True, cwd: Path | None = None) -> int:
    print("+", " ".join(args), flush=True)
    resultado = subprocess.run(args, cwd=cwd)
    if critico and resultado.returncode != 0:
        sys.exit(f"Falló: {' '.join(args)} (código {resultado.returncode}).")
    return resultado.returncode


def minikube_en_marcha(minikube: str) -> bool:
    resultado = subprocess.run(
        [minikube, "status", "--format", "{{.Host}}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return resultado.returncode == 0 and resultado.stdout.strip() == "Running"


def main() -> None:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
    docker = comando("docker")
    minikube = comando("minikube")
    kubectl = comando("kubectl")

    print("==> Herramientas")
    correr([kubectl, "version", "--client"])
    correr([minikube, "version"])
    if correr([docker, "version", "--format", "Docker {{.Server.Version}}"], critico=False) != 0:
        sys.exit("Docker no está en marcha. Abre Docker Desktop y vuelve a correr el script.")

    print("==> minikube")
    if minikube_en_marcha(minikube):
        print("minikube ya está en marcha.")
    else:
        correr([minikube, "start", "--driver=docker"])

    print("==> Imagen de Cotización")
    correr([docker, "build", "-t", IMAGEN_COTIZACION, "."], cwd=RAIZ)
    correr([minikube, "image", "load", IMAGEN_COTIZACION])

    print("==> Imagen de nginx")
    if correr([docker, "pull", IMAGEN_NGINX], critico=False) == 0:
        if correr([minikube, "image", "load", IMAGEN_NGINX], critico=False) != 0:
            print("Aviso: no se pudo cargar nginx en minikube. El clúster intentará descargarla.")
    else:
        print("Aviso: docker pull nginx falló. El clúster intentará descargarla.")

    print("==> Manifiestos")
    for archivo in MANIFIESTOS:
        correr([kubectl, "apply", "-f", str(K8S / archivo)])

    print("==> Esperando réplicas")
    correr(
        [
            kubectl,
            "rollout",
            "status",
            "deployment/cotizacion",
            "-n",
            "solventa",
            "--timeout=120s",
        ]
    )
    correr(
        [
            kubectl,
            "rollout",
            "status",
            "deployment/gateway",
            "-n",
            "solventa",
            "--timeout=120s",
        ]
    )

    print("==> Estado")
    correr([kubectl, "get", "pods,svc,endpoints", "-n", "solventa"])

    print()
    print("Listo. Para pegarle desde el host, deja este comando corriendo:")
    print("  kubectl port-forward svc/gateway 8080:80 -n solventa")
    print("Luego POST http://127.0.0.1:8080/cotizaciones")


if __name__ == "__main__":
    main()
