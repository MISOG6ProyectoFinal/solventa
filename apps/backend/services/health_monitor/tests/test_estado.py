from health_monitor.domain.estado import EstadoServicio


def test_retiro_tras_fallas_consecutivas_y_reingreso():
    estado = EstadoServicio("polizas")
    estado.registrar(False, None, fallas_para_retiro=2)
    assert estado.sano
    estado.registrar(False, None, fallas_para_retiro=2)
    assert not estado.sano
    estado.registrar(True, 3.0, fallas_para_retiro=2)
    assert estado.sano
