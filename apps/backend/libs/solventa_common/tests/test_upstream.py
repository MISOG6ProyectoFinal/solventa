import httpx
import pytest
from fastapi import HTTPException
from solventa_common.integration.base import call_upstream


def _falla(response: httpx.Response):
    def llamar():
        request = httpx.Request("GET", "https://servicio/recurso")
        response.request = request
        raise httpx.HTTPStatusError("error", request=request, response=response)

    return llamar


@pytest.mark.parametrize(
    ("response", "detalle"),
    [
        (httpx.Response(409, json={"detail": {"codigo": "x", "mensaje": "y"}}), {"codigo": "x", "mensaje": "y"}),
        (httpx.Response(422, json={"detail": "Tipo no permitido."}), "Tipo no permitido."),
        (httpx.Response(409, text="Límite alcanzado."), "Límite alcanzado."),
        (httpx.Response(400, json=["sin", "detalle"]), '["sin","detalle"]'),
    ],
)
def test_el_bff_conserva_estado_y_detalle_del_servicio_interno(response, detalle):
    with pytest.raises(HTTPException) as error:
        call_upstream(_falla(response))

    assert error.value.status_code == response.status_code
    assert error.value.detail == detalle
