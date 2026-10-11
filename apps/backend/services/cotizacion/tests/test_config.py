from cotizacion.config import CotizacionSettings

SERVICE_LINKS = {
    "COTIZACION_PORT": "tcp://cotizacion.solventa.svc:80",
    "COTIZACION_SERVICE_HOST": "cotizacion.solventa.svc",
    "COTIZACION_SERVICE_PORT": "80",
    "COTIZACION_PORT_80_TCP": "tcp://cotizacion.solventa.svc:80",
}


def test_variables_inyectadas_por_kubernetes_no_alteran_los_ajustes(monkeypatch):
    for nombre, valor in SERVICE_LINKS.items():
        monkeypatch.setenv(nombre, valor)

    settings = CotizacionSettings()

    assert settings.puerto_replicas == 8000
    assert settings.cotizacion_replicas_host == "cotizacion-replicas"


def test_el_puerto_de_las_replicas_se_configura_por_entorno(monkeypatch):
    monkeypatch.setenv("PUERTO_REPLICAS", "9000")

    assert CotizacionSettings().puerto_replicas == 9000
