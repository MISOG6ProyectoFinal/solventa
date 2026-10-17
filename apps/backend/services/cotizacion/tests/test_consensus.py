import pytest
from cotizacion.consenso.domain.consensus import SinConsenso, votar


def test_dos_de_tres_gana():
    assert votar(["100.00", "100.00", "999.99"], quorum=2) == "100.00"


def test_dos_respuestas_que_coinciden_bastan():
    assert votar(["100.00", "100.00"], quorum=2) == "100.00"


@pytest.mark.parametrize("resultados", [[], ["1"], ["1", "2", "3"]])
def test_sin_mayoria(resultados):
    with pytest.raises(SinConsenso):
        votar(resultados, quorum=2)
