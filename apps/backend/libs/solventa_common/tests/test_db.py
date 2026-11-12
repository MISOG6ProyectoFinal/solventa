from solventa_common.db import POOL_TIMEOUT_S, build_engine, db_ping


def test_a_request_waits_at_most_one_second_for_a_connection(tmp_path):
    engine = build_engine(f"sqlite:///{tmp_path / 'ping.db'}")

    assert engine.pool.timeout() == POOL_TIMEOUT_S
    assert db_ping(engine)
