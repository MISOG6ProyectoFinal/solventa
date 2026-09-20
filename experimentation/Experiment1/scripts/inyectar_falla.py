#!/usr/bin/env python3
"""Inyecta o revierte la falla de salud en UNA réplica de Cotización.

No borra el Pod. /health pasa a 503 (o vuelve a 200) para que el readiness
probe retire o reincorpore la instancia. Sirve en Windows y macOS.

  python scripts/inyectar_falla.py
  python scripts/inyectar_falla.py --pod cotizacion-xxxxx
  python scripts/inyectar_falla.py --recuperar
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone

NAMESPACE = "solventa"
ETIQUETA = "app=cotizacion"


def kubectl_json(args: list[str]) -> dict:
    resultado = subprocess.run(
        ["kubectl", *args, "-o", "json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if resultado.returncode != 0:
        sys.exit(resultado.stderr.strip() or f"Falló kubectl {' '.join(args)}")
    return json.loads(resultado.stdout)


def pod_listo(pod: dict) -> bool:
    for condicion in pod.get("status", {}).get("conditions", []):
        if condicion.get("type") == "Ready":
            return condicion.get("status") == "True"
    return False


def listar_pods() -> list[dict]:
    data = kubectl_json(["get", "pods", "-n", NAMESPACE, "-l", ETIQUETA])
    return data.get("items", [])


def elegir_pod(pods: list[dict], nombre: str | None, recuperar: bool) -> dict:
    if nombre:
        for pod in pods:
            if pod["metadata"]["name"] == nombre:
                return pod
        sys.exit(f"No está el Pod '{nombre}' en {NAMESPACE}.")

    if recuperar:
        no_listos = [p for p in pods if not pod_listo(p)]
        if not no_listos:
            sys.exit("Ningún Pod está no listo. Pasa --pod si quieres recuperar uno concreto.")
        return no_listos[0]

    listos = [p for p in pods if pod_listo(p)]
    if len(listos) < 2:
        sys.exit("Hacen falta dos réplicas Ready para inyectar la falla en una sola.")
    return listos[0]


def post_en_pod(nombre: str, ruta: str) -> str:
    codigo = (
        "import urllib.request\n"
        f"req = urllib.request.Request('http://127.0.0.1:8000{ruta}', method='POST')\n"
        "print(urllib.request.urlopen(req).read().decode())\n"
    )
    resultado = subprocess.run(
        ["kubectl", "exec", "-n", NAMESPACE, "-i", nombre, "--", "python", "-"],
        input=codigo,
        capture_output=True,
        text=True,
        check=False,
    )
    if resultado.returncode != 0:
        sys.exit(resultado.stderr.strip() or f"kubectl exec falló en {nombre}")
    return resultado.stdout.strip()


def esperar_ready(nombre: str, listo: bool, segundos: float) -> float:
    inicio = time.monotonic()
    while time.monotonic() - inicio < segundos:
        pods = {p["metadata"]["name"]: p for p in listar_pods()}
        actual = pods.get(nombre)
        if actual is not None and pod_listo(actual) is listo:
            return time.monotonic() - inicio
        time.sleep(0.5)
    sys.exit(
        f"El Pod {nombre} no pasó a Ready={str(listo).lower()} en {segundos:.0f}s."
    )


def mostrar_estado() -> None:
    subprocess.run(
        ["kubectl", "get", "pods", "-n", NAMESPACE, "-l", ETIQUETA],
        check=False,
    )
    subprocess.run(
        ["kubectl", "get", "endpoints", "cotizacion", "-n", NAMESPACE],
        check=False,
    )


def main() -> None:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(
        description="Inyecta o revierte la falla de /health en un Pod de Cotización."
    )
    parser.add_argument("--pod", help="Nombre del Pod. Si se omite, se elige uno.")
    parser.add_argument(
        "--recuperar",
        action="store_true",
        help="Vuelve /health a 200 en el Pod no listo (o en --pod).",
    )
    args = parser.parse_args()

    pods = listar_pods()
    if len(pods) < 2:
        sys.exit("Se esperaban 2 Pods de Cotización. Corre antes scripts/levantar_k8s.py.")

    print("==> Réplicas")
    for pod in pods:
        estado = "Ready" if pod_listo(pod) else "no Ready"
        print(f"  {pod['metadata']['name']}  {estado}")

    elegido = elegir_pod(pods, args.pod, args.recuperar)
    nombre = elegido["metadata"]["name"]
    ruta = "/experimentos/recupera-salud" if args.recuperar else "/experimentos/falla-salud"
    marca = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    print(f"==> POST {ruta} en {nombre}")
    print(f"    instante={marca}")
    cuerpo = post_en_pod(nombre, ruta)
    print(f"    respuesta={cuerpo}")

    esperado_listo = args.recuperar
    transcurrido = esperar_ready(nombre, esperado_listo, 30)
    print(f"==> Ready={str(esperado_listo).lower()} en {transcurrido:.1f}s (sin borrar el Pod)")

    print("==> Estado")
    mostrar_estado()


if __name__ == "__main__":
    main()
