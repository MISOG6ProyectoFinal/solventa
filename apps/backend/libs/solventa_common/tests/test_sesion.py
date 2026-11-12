from solventa_common.sesion import bearer_token


def test_bearer_token_reads_the_authorization_header():
    assert bearer_token("Bearer abc ") == "abc"
    assert bearer_token(None) is None
    assert bearer_token("Basic abc") is None
    assert bearer_token("Bearer   ") is None
