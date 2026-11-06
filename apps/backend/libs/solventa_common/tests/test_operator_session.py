from datetime import UTC, datetime, timedelta

import pytest
from solventa_common.operator_session import ADMIN, ADVISOR, sign_operator_token, verify_operator_token
from solventa_common.sesion import InvalidToken, sign_token

SECRET = "secreto-de-prueba"
NOW = datetime(2026, 11, 6, 12, tzinfo=UTC)


def _token(**extra) -> str:
    args = {"expires_at": NOW + timedelta(hours=8)} | extra
    return sign_operator_token("op-1", "ana@solventa.test", "Ana Gómez", [ADMIN], SECRET, **args)


def test_signed_token_carries_the_operator_and_roles():
    operator = verify_operator_token(_token(), SECRET, now=NOW)

    assert operator.operator_id == "op-1"
    assert operator.name == "Ana Gómez"
    assert operator.roles == (ADMIN,)
    assert operator.has_any(ADMIN, ADVISOR)
    assert not operator.has_any(ADVISOR)


@pytest.mark.parametrize(
    "token",
    [
        "sin-punto",
        _token() + "x",
        _token(expires_at=NOW - timedelta(seconds=1)),
        sign_token("cli-1", "c@t.co", SECRET, first_name="C", last_name="L", expires_at=NOW + timedelta(hours=1)),
        sign_operator_token("op-1", "a@t.co", "A", ["superusuario"], SECRET, expires_at=NOW + timedelta(hours=1)),
    ],
)
def test_rejects_forged_expired_customer_or_unknown_role_tokens(token):
    with pytest.raises(InvalidToken):
        verify_operator_token(token, SECRET, now=NOW)


def test_rejects_another_secret():
    with pytest.raises(InvalidToken):
        verify_operator_token(_token(), "otro-secreto", now=NOW)
