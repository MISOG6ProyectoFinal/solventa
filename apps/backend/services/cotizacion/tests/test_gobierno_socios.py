"""HU008: alta y aprovisionamiento del socio con contrato de API."""

from datetime import UTC, datetime

import pytest
from cotizacion.container import container
from cotizacion.gobierno_socios.adapters.repository import InMemorySocioRepository
from cotizacion.gobierno_socios.domain import credenciales
from cotizacion.gobierno_socios.domain.models import (
    Alcance,
    AlcanceNoAutorizado,
    AltaSocio,
    ContratoSuspendido,
    CredencialInvalida,
    EstadoContrato,
    EstadoCredencial,
)
from cotizacion.gobierno_socios.domain.use_cases import AutorizarSocioUseCase, DarDeAltaSocioUseCase
from cotizacion.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

ALTA = {
    "nombre": "Fintech Demo",
    "identificador": "fintech-demo",
    "tipo": "Fintech",
    "pais": "Colombia",
    "correo_contacto": "Ops@Fintech.demo",
    "alcances": ["cotizacion", "emision"],
    "autorizado_por": "Ana Gómez",
}
SOLICITUD = {
    "producto_id": "viaje-internacional",
    "destino": "España",
    "fecha_salida": "2027-01-10",
    "fecha_regreso": "2027-01-20",
    "viajeros": 2,
}


@pytest.fixture(autouse=True)
def socios_vacios():
    container.socios.socios.clear()
    container.configuraciones.configuraciones.clear()


def dar_de_alta(**cambios) -> dict:
    response = client.post("/gobierno-socios/socios", json={**ALTA, **cambios})
    assert response.status_code == 201, response.text
    socio = response.json()
    # El alta no habilita ramos; las pruebas de credenciales cotizan viaje.
    configuracion = {"ramos": [{"ramo_id": "ramo-viaje", "coberturas": []}], "actualizado_por": "Ana Gómez"}
    client.put(f"/gobierno-socios/socios/{socio['id']}/configuracion", json=configuracion)
    return socio


def credenciales_de(socio: dict) -> dict:
    return {"X-Client-Id": socio["client_id"], "X-Api-Key": socio["secreto"]}


def test_alta_exitosa_deja_el_contrato_activo():
    socio = dar_de_alta()

    assert socio["identificador"] == "FINTECH-DEMO"
    assert socio["correo_contacto"] == "ops@fintech.demo"
    assert socio["estado_contrato"] == "Activo"
    assert socio["version_contrato"] == "v2"
    assert socio["estado_credencial"] == "Activa"


def test_alta_genera_client_id_y_secreto_del_socio():
    socio = dar_de_alta()

    assert socio["client_id"].startswith("sv_live_fintechdemo_")
    assert socio["secreto"].startswith("sv_sec_")
    assert socio["secreto_enmascarado"] == f"sv_sec_••••••••{socio['secreto'][-4:]}"
    otro = dar_de_alta(identificador="otro-socio")
    assert otro["client_id"] != socio["client_id"]
    assert otro["secreto"] != socio["secreto"]


def test_el_secreto_solo_se_entrega_en_el_alta_y_se_guarda_como_hash():
    socio = dar_de_alta()

    consultado = client.get(f"/gobierno-socios/socios/{socio['id']}").json()
    assert "secreto" not in consultado
    assert "secreto_hash" not in consultado
    guardado = container.socios.get(socio["id"])
    assert guardado.secreto_hash == credenciales.hash_secreto(socio["secreto"])
    assert socio["secreto"] not in guardado.model_dump_json()


def test_alta_guarda_fecha_usuario_y_alcance():
    antes = datetime.now(UTC)
    socio = dar_de_alta(alcances=["cotizacion", "consulta", "cotizacion"])

    assert socio["alta_usuario"] == "Ana Gómez"
    assert socio["alcances"] == ["cotizacion", "consulta"]
    assert antes <= datetime.fromisoformat(socio["alta_fecha"]) <= datetime.now(UTC)


def test_identificador_duplicado_bloquea_el_alta_e_indica_el_motivo():
    dar_de_alta()

    response = client.post("/gobierno-socios/socios", json={**ALTA, "identificador": "FINTECH-demo"})

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "codigo": "identificador_duplicado",
        "mensaje": "Ya existe un socio con este identificador. No es posible crearlo de nuevo.",
    }


def test_alta_fallida_no_deja_socio_ni_credenciales():
    original = dar_de_alta()

    client.post("/gobierno-socios/socios", json=ALTA)

    socios = client.get("/gobierno-socios/socios").json()
    assert [s["client_id"] for s in socios] == [original["client_id"]]


@pytest.mark.parametrize(
    "cambios",
    [
        {"nombre": "   "},
        {"identificador": "con espacios"},
        {"identificador": "x"},
        {"correo_contacto": "sin-arroba"},
        {"alcances": []},
        {"alcances": ["pagos"]},
        {"tipo": "Aseguradora"},
    ],
)
def test_datos_invalidos_no_crean_el_socio(cambios):
    response = client.post("/gobierno-socios/socios", json={**ALTA, **cambios})

    assert response.status_code == 422
    assert client.get("/gobierno-socios/socios").json() == []


def test_alta_exige_el_usuario_que_autoriza():
    sin_usuario = {k: v for k, v in ALTA.items() if k != "autorizado_por"}

    assert client.post("/gobierno-socios/socios", json=sin_usuario).status_code == 422
    assert client.get("/gobierno-socios/socios").json() == []


def test_credenciales_generadas_permiten_una_operacion_del_alcance():
    socio = dar_de_alta(alcances=["cotizacion"])

    response = client.post("/gobierno-socios/cotizaciones", json=SOLICITUD, headers=credenciales_de(socio))

    assert response.status_code == 200
    assert response.json()["producto_id"] == "viaje-internacional"


def test_secreto_incorrecto_o_socio_desconocido_son_rechazados():
    socio = dar_de_alta()
    headers = credenciales_de(socio)

    mal_secreto = client.post("/gobierno-socios/cotizaciones", json=SOLICITUD, headers={**headers, "X-Api-Key": "x"})
    desconocido = client.post("/gobierno-socios/cotizaciones", json=SOLICITUD, headers={**headers, "X-Client-Id": "x"})

    assert mal_secreto.status_code == desconocido.status_code == 401
    assert mal_secreto.json()["detail"]["codigo"] == "credencial_invalida"
    assert mal_secreto.json() == desconocido.json()


def test_operacion_fuera_del_alcance_es_rechazada():
    socio = dar_de_alta(alcances=["consulta"])

    response = client.post("/gobierno-socios/cotizaciones", json=SOLICITUD, headers=credenciales_de(socio))

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "alcance_no_autorizado"


def test_cotizacion_de_socio_exige_credenciales():
    assert client.post("/gobierno-socios/cotizaciones", json=SOLICITUD).status_code == 422


def test_flujo_completo_alta_y_consulta_posterior():
    primero = dar_de_alta()
    segundo = dar_de_alta(nombre="Banco Aurora", identificador="banco-aurora", tipo="Banco")

    listado = client.get("/gobierno-socios/socios").json()
    detalle = client.get(f"/gobierno-socios/socios/{primero['id']}").json()

    assert [s["identificador"] for s in listado] == ["BANCO-AURORA", "FINTECH-DEMO"]
    assert detalle == {
        **{k: v for k, v in primero.items() if k != "secreto"},
        "ramos_habilitados": [{"id": "ramo-viaje", "nombre": "Viaje"}],
    }
    assert detalle["alcances"] == ["cotizacion", "emision"]
    assert detalle["alta_usuario"] == "Ana Gómez"
    assert segundo["id"] != primero["id"]


def test_consultar_socio_inexistente_responde_404():
    response = client.get("/gobierno-socios/socios/no-existe")

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "socio_no_encontrado"


def _socio_registrado():
    repo = InMemorySocioRepository()
    datos = {k: v for k, v in ALTA.items() if k != "autorizado_por"}
    socio, secreto = DarDeAltaSocioUseCase(repo).execute(AltaSocio(**datos), "Ana Gómez")
    return repo, socio, secreto


def test_credencial_revocada_deja_de_ser_reconocida():
    repo, socio, secreto = _socio_registrado()
    repo.socios[socio.id] = socio.model_copy(update={"estado_credencial": EstadoCredencial.REVOCADA})

    with pytest.raises(CredencialInvalida):
        AutorizarSocioUseCase(repo).execute(socio.client_id, secreto, Alcance.COTIZACION)


def test_contrato_suspendido_rechaza_las_llamadas():
    repo, socio, secreto = _socio_registrado()
    repo.socios[socio.id] = socio.model_copy(update={"estado_contrato": EstadoContrato.SUSPENDIDO})

    with pytest.raises(ContratoSuspendido):
        AutorizarSocioUseCase(repo).execute(socio.client_id, secreto, Alcance.COTIZACION)


def test_autorizar_devuelve_el_socio_y_valida_el_alcance():
    repo, socio, secreto = _socio_registrado()
    autorizar = AutorizarSocioUseCase(repo)

    assert autorizar.execute(socio.client_id, secreto, Alcance.EMISION).id == socio.id
    with pytest.raises(AlcanceNoAutorizado):
        autorizar.execute(socio.client_id, secreto, Alcance.CONSULTA)


def test_contrato_suspendido_responde_403():
    socio = dar_de_alta()
    guardado = container.socios.get(socio["id"])
    container.socios.socios[socio["id"]] = guardado.model_copy(update={"estado_contrato": EstadoContrato.SUSPENDIDO})

    response = client.post("/gobierno-socios/cotizaciones", json=SOLICITUD, headers=credenciales_de(socio))

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "contrato_suspendido"
