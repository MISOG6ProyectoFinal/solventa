"""Llamada en paralelo a cada réplica de Cotización y Rating."""

import asyncio
import socket

import httpx


def resolver_replicas(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    return sorted({info[4][0] for info in infos})


async def cotizar_en_replicas(ips: list[str], port: int, body: dict, timeout_s: float) -> list[dict]:
    """Devuelve solo las respuestas que llegaron a tiempo y sin error."""
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        calls = [client.post(f"http://{ip}:{port}/cotizaciones/calcular", json=body) for ip in ips]
        responses = await asyncio.gather(*calls, return_exceptions=True)
    return [r.json() for r in responses if isinstance(r, httpx.Response) and r.status_code == 200]
