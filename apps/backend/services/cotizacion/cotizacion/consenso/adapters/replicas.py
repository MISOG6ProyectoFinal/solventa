"""Llamada en paralelo a cada réplica de Cotización y Rating."""

import asyncio
import socket
from collections import Counter
from decimal import Decimal

import httpx
from solventa_common.integration.simulators import CLUSTER_SCHEME


def resolver_replicas(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    return sorted({info[4][0] for info in infos})


def _premium(answer: dict) -> Decimal:
    return Decimal(str(answer["prima"])).quantize(Decimal("0.01"))


async def cotizar_en_replicas(
    ips: list[str],
    port: int,
    body: dict,
    timeout_s: float,
    quorum: int,
    transport: httpx.AsyncBaseTransport | None = None,
) -> list[dict]:
    """Devuelve las respuestas que llegaron antes del plazo total. Corta en cuanto `quorum` réplicas coinciden."""
    answers: list[dict] = []
    votes: Counter[Decimal] = Counter()
    async with httpx.AsyncClient(timeout=timeout_s, transport=transport) as client:
        urls = [f"{CLUSTER_SCHEME}://{ip}:{port}/cotizaciones/calcular" for ip in ips]
        calls = [asyncio.ensure_future(client.post(url, json=body)) for url in urls]
        try:
            async with asyncio.timeout(timeout_s):
                for finished in asyncio.as_completed(calls):
                    try:
                        response = await finished
                    except httpx.HTTPError:
                        continue
                    if response.status_code != httpx.codes.OK:
                        continue
                    answer = response.json()
                    answers.append(answer)
                    votes[_premium(answer)] += 1
                    if max(votes.values()) >= quorum:
                        break
        except TimeoutError:
            pass
        finally:
            for call in calls:
                call.cancel()
            await asyncio.gather(*calls, return_exceptions=True)
    return answers
