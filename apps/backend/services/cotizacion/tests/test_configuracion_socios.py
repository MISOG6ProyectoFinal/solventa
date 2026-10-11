"""HU010: configuración de ramos y coberturas habilitados por socio."""

import pytest
from cotizacion.container import container
from cotizacion.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

VIAJE = {
    "producto_id": "viaje-internacional",
    "destino": "España",
    "fecha_salida": "2027-01-10",
    "fecha_regreso": "2027-01-20",
    "viajeros": 2,
}
RAMOS_DEL_CANAL = [
    "ramo-viaje",
    "ramo-dispositivos",
    "ramo-microseguro-vida",
    "ramo-parametrico",
    "ramo-proteccion-pagos",
    "ramo-vida-hipotecario",
]


@pytest.fixture(autouse=True)
def almacenes_vacios():
    container.socios.socios.clear()
    container.configuraciones.configuraciones.clear()


def dar_de_alta(identificador: str = "fintech-demo") -> dict:
    alta = {
        "nombre": "Fintech Demo",
        "identificador": identificador,
        "tipo": "Fintech",
        "correo_contacto": "ops@fintech.demo",
        "alcances": ["cotizacion"],
        "autorizado_por": "Ana Gómez",
    }
    response = client.post("/gobierno-socios/socios", json=alta)
    assert response.status_code == 201, response.text
    return response.json()


def configurar(socio: dict, *ramos: dict, usuario: str = "Ana Gómez"):
    body = {"ramos": list(ramos), "actualizado_por": usuario}
    return client.put(f"/gobierno-socios/socios/{socio['id']}/configuracion", json=body)


def ramo(ramo_id: str, *coberturas: str) -> dict:
    return {"ramo_id": ramo_id, "coberturas": list(coberturas)}


def consultar(socio: dict) -> dict:
    response = client.get(f"/gobierno-socios/socios/{socio['id']}/configuracion")
    assert response.status_code == 200
    return response.json()


def cotizar(socio: dict, solicitud: dict = VIAJE):
    headers = {"X-Client-Id": socio["client_id"], "X-Api-Key": socio["secreto"]}
    return client.post("/gobierno-socios/cotizaciones", json=solicitud, headers=headers)


def habilitados(configuracion: dict) -> dict[str, list[str]]:
    return {
        r["id"]: [c["id"] for c in r["coberturas"] if c["habilitada"]]
        for r in configuracion["ramos"]
        if r["habilitado"]
    }


def test_socio_nuevo_ve_los_seis_ramos_del_canal_deshabilitados():
    configuracion = consultar(dar_de_alta())

    assert [r["id"] for r in configuracion["ramos"]] == RAMOS_DEL_CANAL
    assert habilitados(configuracion) == {}
    assert configuracion["actualizado_en"] is None
    viaje = configuracion["ramos"][0]
    assert viaje["nombre"] == "Viaje"
    assert [c["nombre"] for c in viaje["coberturas"]] == [
        "Gastos médicos en el exterior",
        "Cancelación de viaje",
        "Pérdida de equipaje",
        "Asistencia en viaje",
    ]


def test_ramo_habilitado_acepta_la_llamada_del_socio():
    socio = dar_de_alta()

    assert configurar(socio, ramo("ramo-viaje")).status_code == 200

    respuesta = cotizar(socio)
    assert respuesta.status_code == 200
    assert respuesta.json()["producto_id"] == "viaje-internacional"


def test_ramo_no_habilitado_se_rechaza_con_error_de_alcance():
    socio = dar_de_alta()
    configurar(socio, ramo("ramo-dispositivos"))

    respuesta = cotizar(socio)

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == {
        "codigo": "ramo_no_habilitado",
        "mensaje": "El ramo 'Viaje' no está habilitado para este socio.",
    }


def test_socio_sin_configuracion_no_puede_cotizar_ningun_ramo():
    assert cotizar(dar_de_alta()).status_code == 403


def test_ramo_ajeno_al_canal_de_socios_se_rechaza():
    socio = dar_de_alta()
    configurar(socio, ramo("ramo-viaje"))

    respuesta = cotizar(socio, {"producto_id": "vida-temporal", "suma_asegurada": "1000000", "edad": 40})

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"]["codigo"] == "ramo_no_habilitado"


def test_producto_inexistente_responde_404():
    socio = dar_de_alta()

    assert cotizar(socio, {**VIAJE, "producto_id": "no-existe"}).status_code == 404


def test_coberturas_consultadas_corresponden_exactamente_a_lo_definido():
    socio = dar_de_alta()

    configurar(
        socio,
        ramo("ramo-proteccion-pagos", "pagos-desempleo", "pagos-fallecimiento", "pagos-desempleo"),
        ramo("ramo-viaje"),
    )

    assert habilitados(consultar(socio)) == {
        "ramo-viaje": [],
        "ramo-proteccion-pagos": ["pagos-desempleo", "pagos-fallecimiento"],
    }


def test_cambio_de_configuracion_aplica_a_la_siguiente_llamada():
    socio = dar_de_alta()
    assert cotizar(socio).status_code == 403

    configurar(socio, ramo("ramo-viaje"))

    assert cotizar(socio).status_code == 200


def test_ramo_retirado_rechaza_las_llamadas_posteriores():
    socio = dar_de_alta()
    configurar(socio, ramo("ramo-viaje"), ramo("ramo-dispositivos"))
    assert cotizar(socio).status_code == 200

    configurar(socio, ramo("ramo-dispositivos"))

    assert cotizar(socio).status_code == 403
    assert habilitados(consultar(socio)) == {"ramo-dispositivos": []}


def test_consulta_muestra_la_configuracion_vigente_y_quien_la_cambio():
    socio = dar_de_alta()
    configurar(socio, ramo("ramo-viaje", "viaje-cancelacion"), usuario="Carlos Ruiz")

    configuracion = consultar(socio)

    assert configuracion["actualizado_por"] == "Carlos Ruiz"
    assert configuracion["actualizado_en"] is not None
    viaje = configuracion["ramos"][0]
    assert viaje["habilitado"] is True
    assert {c["id"]: c["habilitada"] for c in viaje["coberturas"]} == {
        "viaje-gastos-medicos": False,
        "viaje-cancelacion": True,
        "viaje-equipaje": False,
        "viaje-asistencia": False,
    }


def test_listado_de_socios_incluye_sus_ramos_habilitados():
    socio = dar_de_alta()
    configurar(socio, ramo("ramo-viaje"), ramo("ramo-parametrico"))

    listado = client.get("/gobierno-socios/socios").json()

    assert listado[0]["ramos_habilitados"] == [
        {"id": "ramo-viaje", "nombre": "Viaje"},
        {"id": "ramo-parametrico", "nombre": "Paramétrico (clima / vuelo)"},
    ]


def test_configuracion_de_un_socio_no_afecta_a_los_demas():
    aurora = dar_de_alta("banco-aurora")
    andina = dar_de_alta("aerolinea-andina")
    configurar(aurora, ramo("ramo-proteccion-pagos", "pagos-desempleo"))
    configurar(andina, ramo("ramo-viaje", "viaje-cancelacion"))

    configurar(aurora, ramo("ramo-vida-hipotecario"))

    assert habilitados(consultar(andina)) == {"ramo-viaje": ["viaje-cancelacion"]}
    assert habilitados(consultar(aurora)) == {"ramo-vida-hipotecario": []}
    assert cotizar(andina).status_code == 200
    assert cotizar(aurora).status_code == 403


@pytest.mark.parametrize(
    ("ramos", "codigo"),
    [
        ([ramo("ramo-hogar")], "ramo_fuera_del_canal"),
        ([ramo("ramo-inexistente")], "ramo_fuera_del_canal"),
        ([ramo("ramo-viaje", "pagos-desempleo")], "cobertura_fuera_del_ramo"),
    ],
)
def test_configuracion_invalida_se_rechaza_y_conserva_la_vigente(ramos, codigo):
    socio = dar_de_alta()
    configurar(socio, ramo("ramo-viaje", "viaje-cancelacion"))

    respuesta = configurar(socio, *ramos)

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"]["codigo"] == codigo
    assert habilitados(consultar(socio)) == {"ramo-viaje": ["viaje-cancelacion"]}


def test_ramo_repetido_o_sin_usuario_no_se_acepta():
    socio = dar_de_alta()
    ruta = f"/gobierno-socios/socios/{socio['id']}/configuracion"

    repetido = configurar(socio, ramo("ramo-viaje"), ramo("ramo-viaje"))
    sin_usuario = client.put(ruta, json={"ramos": []})

    assert repetido.status_code == sin_usuario.status_code == 422
    assert habilitados(consultar(socio)) == {}


def test_configuracion_de_socio_inexistente_responde_404():
    ruta = "/gobierno-socios/socios/no-existe/configuracion"

    assert client.get(ruta).status_code == 404
    respuesta = client.put(ruta, json={"ramos": [], "actualizado_por": "Ana Gómez"})
    assert respuesta.status_code == 404
    assert respuesta.json()["detail"]["codigo"] == "socio_no_encontrado"


def test_flujo_completo_configurar_consultar_y_autorizar():
    socio = dar_de_alta()

    guardada = configurar(socio, ramo("ramo-viaje", "viaje-gastos-medicos", "viaje-asistencia")).json()

    assert guardada == consultar(socio)
    assert habilitados(guardada) == {"ramo-viaje": ["viaje-gastos-medicos", "viaje-asistencia"]}
    assert cotizar(socio).status_code == 200
    assert cotizar(socio, {"producto_id": "vida-temporal", "suma_asegurada": "1000000", "edad": 40}).status_code == 403
