from concurrent.futures import ThreadPoolExecutor

from solventa_common.idempotency import InMemoryIdempotencyKeyValidator


def test_only_first_claim_wins_under_concurrency():
    validator = InMemoryIdempotencyKeyValidator()
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(lambda _: validator.claim("evento-1", "liquidacion"), range(100)))
    assert results.count(True) == 1


def test_scopes_are_independent():
    validator = InMemoryIdempotencyKeyValidator()
    assert validator.claim("k", "a")
    assert validator.claim("k", "b")
    assert not validator.claim("k", "a")
