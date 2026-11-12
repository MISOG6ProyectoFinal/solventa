from solventa_common.errors import api_error, error_detail


def test_every_service_answers_business_errors_with_the_same_shape():
    error = api_error(409, "clave_reutilizada", "La clave ya se usó.")

    assert error.status_code == 409
    assert error.detail == error_detail("clave_reutilizada", "La clave ya se usó.")
    assert error.detail == {"codigo": "clave_reutilizada", "mensaje": "La clave ya se usó."}
