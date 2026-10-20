"""HU014: API de cotización embebida para el socio de distribución."""

import json
import threading
import time
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from statistics import quantiles

import httpx
import pytest
from cotizacion.config import CotizacionSettings
from cotizacion.container import container
from cotizacion.main import app
from cotizacion.senales.adapters.open_finance import (
    OpenFinanceCotizacionAdapter,
    PerfilOpenFinance,
    PerfilOpenFinanceSimulado,
    construir_proveedor,
)
from cotizacion.senales.domain.models import ConsentimientoOpenFinance, OrigenSenal
from cotizacion.senales.domain.use_cases import ResolverScoreRiesgoUseCase
from fastapi.testclient import TestClient
from pydantic import ValidationError
from solventa_common.resilience import InMemoryCache

client = TestClient(app)

VIAJE = {
    "producto_id": "viaje-internacional",
    "destino": "España",
    "fecha_salida": "2027-01-10",
    "fecha_regreso": "2027-01-20",
    "viajeros": 2,
}
HIPOTECARIO = {
    "producto_id": "vida-hipotecario",
    "fecha_nacimiento": "1986-01-01",
    "entidad": "Banco Aurora",
    "valor_credito": "250000000",
    "plazo_anios": 15,
}
CONSENTIMIENTO = {"cliente_ref": "cliente-77", "consentimiento_id": "consent-1"}
PRIMA_HIPOTECARIO_NEUTRAL = Decimal("3000000.00")


class _Proveedor:
    fuente = "open-finance"

    def __init__(self, score: str | None = None, error: Exception | None = None) -> None:
        self.score = score
        self.error = error
        self.llamadas = 0

    def score_riesgo(self, consentimiento: ConsentimientoOpenFinance) -> Decimal:
        self.llamadas += 1
        if self.error:
            raise self.error
        return Decimal(str(self.score))


class _CacheCaida:
    def get(self, key):
        raise ConnectionError("redis caído")

    def set(self, key, value, ttl_s):
        raise ConnectionError("redis caído")


@pytest.fixture(autouse=True)
def almacenes_vacios():
    container.socios.socios.clear()
    container.configuraciones.configuraciones.clear()
    original = container.resolver_score
    yield
    container.resolver_score = original


def usar_proveedor(proveedor, cache=None) -> None:
    container.resolver_score = ResolverScoreRiesgoUseCase(proveedor, cache or InMemoryCache(), ttl_s=60)


def socio_con(*ramos: dict) -> dict:
    alta = {
        "nombre": "Banco Aurora",
        "identificador": "banco-aurora",
        "tipo": "Banco",
        "correo_contacto": "api@aurora.test",
        "alcances": ["cotizacion"],
        "autorizado_por": "Ana Gómez",
    }
    socio = client.post("/gobierno-socios/socios", json=alta).json()
    body = {"ramos": list(ramos), "actualizado_por": "Ana Gómez"}
    assert client.put(f"/gobierno-socios/socios/{socio['id']}/configuracion", json=body).status_code == 200
    return socio


def viaje(*coberturas: str) -> dict:
    return {"ramo_id": "ramo-viaje", "coberturas": list(coberturas)}


def hipotecario(*coberturas: str) -> dict:
    return {"ramo_id": "ramo-vida-hipotecario", "coberturas": list(coberturas)}


def cotizar(socio: dict, solicitud: dict, secreto: str | None = None):
    headers = {"X-Client-Id": socio["client_id"], "X-Api-Key": secreto or socio["secreto"]}
    return client.post("/gobierno-socios/cotizaciones", json=solicitud, headers=headers)


# Criterio 1: prima y coberturas dentro del presupuesto de latencia.


def test_solicitud_valida_devuelve_prima_y_coberturas_habilitadas():
    socio = socio_con(viaje("viaje-gastos-medicos", "viaje-asistencia"))

    respuesta = cotizar(socio, VIAJE)

    assert respuesta.status_code == 200
    oferta = respuesta.json()
    assert Decimal(oferta["prima"]) == Decimal("214200.00")
    assert [c["id"] for c in oferta["coberturas"]] == ["viaje-gastos-medicos", "viaje-asistencia"]
    assert oferta["canal"] == "socios"
    assert oferta["degradada"] is False
    assert oferta["senales"] == []


def test_la_oferta_persistida_conserva_solo_las_coberturas_del_socio():
    socio = socio_con(viaje("viaje-equipaje"))

    oferta = cotizar(socio, VIAJE).json()

    guardada = next(item for item in container.cotizaciones.items if item.id == oferta["id"])
    assert [c.id for c in guardada.coberturas] == ["viaje-equipaje"]


def test_p95_en_proceso_queda_dentro_de_400_ms():
    socio = socio_con(viaje("viaje-gastos-medicos"))
    duraciones = []
    for _ in range(60):
        inicio = time.perf_counter()
        assert cotizar(socio, VIAJE).status_code == 200
        duraciones.append((time.perf_counter() - inicio) * 1000)

    assert quantiles(duraciones, n=20)[18] < 400


def catalogo(socio: dict, secreto: str | None = None):
    headers = {"X-Client-Id": socio["client_id"], "X-Api-Key": secreto or socio["secreto"]}
    return client.get("/gobierno-socios/catalogo", headers=headers)


def test_el_socio_consulta_lo_que_puede_cotizar_y_el_contrato_de_cada_producto():
    socio = socio_con(hipotecario("hipotecario-fallecimiento"), viaje("viaje-asistencia"))

    respuesta = catalogo(socio)

    assert respuesta.status_code == 200
    productos = {p["producto_id"]: p for p in respuesta.json()}
    assert list(productos) == ["viaje-internacional", "vida-hipotecario"]
    assert productos["viaje-internacional"]["ramo"] == {"id": "ramo-viaje", "nombre": "Viaje"}
    assert productos["viaje-internacional"]["coberturas"] == [
        {"id": "viaje-asistencia", "nombre": "Asistencia en viaje"}
    ]
    contrato = productos["viaje-internacional"]["contrato"]
    assert set(contrato["required"]) == {"producto_id", "destino", "fecha_salida", "fecha_regreso", "viajeros"}
    assert contrato["properties"]["producto_id"]["const"] == "viaje-internacional"
    hipotecario_contrato = productos["vida-hipotecario"]["contrato"]
    assert "consentimiento_open_finance" in hipotecario_contrato["properties"]
    assert "score_riesgo" not in hipotecario_contrato["properties"]


def test_el_catalogo_omite_ramos_no_habilitados_y_productos_sin_tarifa():
    socio = socio_con({"ramo_id": "ramo-dispositivos", "coberturas": ["celular-robo"]})

    assert catalogo(socio).json() == []


def test_el_contrato_publicado_es_el_mismo_que_valida_la_cotizacion():
    socio = socio_con(viaje())
    contrato = catalogo(socio).json()[0]["contrato"]
    ejemplo = {campo: VIAJE[campo] for campo in contrato["required"]}

    assert cotizar(socio, ejemplo).status_code == 200


def test_el_catalogo_exige_credenciales_validas():
    socio = socio_con(viaje())

    assert catalogo(socio, secreto="otro").status_code == 401


# Criterio 2: error claro y sin cálculo.


def test_dato_obligatorio_faltante_responde_campo_y_motivo_sin_calcular():
    socio = socio_con(viaje())
    antes = container.cotizaciones.count()
    incompleta = {k: v for k, v in VIAJE.items() if k != "fecha_salida"}

    respuesta = cotizar(socio, incompleta)

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == {
        "codigo": "datos_invalidos",
        "mensaje": "La solicitud tiene datos faltantes o inválidos. No se calculó la prima.",
        "campos": [{"campo": "fecha_salida", "error": "Campo obligatorio"}],
    }
    assert container.cotizaciones.count() == antes


def test_valores_fuera_de_contrato_se_explican_en_espanol():
    socio = socio_con(viaje())

    respuesta = cotizar(socio, {**VIAJE, "destino": "Marte", "viajeros": 0})

    campos = {c["campo"]: c["error"] for c in respuesta.json()["detail"]["campos"]}
    assert respuesta.status_code == 422
    assert campos["destino"].startswith("Valor no permitido. Opciones:")
    assert campos["viajeros"] == "Debe ser mayor o igual que 1"


def test_regla_entre_campos_devuelve_el_mensaje_de_negocio():
    socio = socio_con(viaje())

    respuesta = cotizar(socio, {**VIAJE, "fecha_regreso": "2027-01-05"})

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"]["campos"] == [
        {"campo": "solicitud", "error": "La fecha de regreso debe ser posterior a la fecha de salida"}
    ]


def test_sin_producto_se_rechaza_antes_de_buscar_el_ramo():
    socio = socio_con(viaje())

    respuesta = cotizar(socio, {"destino": "España"})

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"]["campos"] == [{"campo": "producto_id", "error": "Campo obligatorio"}]


def test_ramo_no_habilitado_responde_403_aunque_falten_datos():
    socio = socio_con(viaje())

    respuesta = cotizar(socio, {"producto_id": "vida-hipotecario"})

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"]["codigo"] == "ramo_no_habilitado"


def test_credencial_invalida_no_revela_el_contrato():
    socio = socio_con(viaje())

    respuesta = cotizar(socio, {"producto_id": "viaje-internacional"}, secreto="otro")

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"]["codigo"] == "credencial_invalida"


def test_el_socio_no_puede_fijar_su_propio_score():
    socio = socio_con(hipotecario())

    respuesta = cotizar(socio, {**HIPOTECARIO, "score_riesgo": "0"})

    assert respuesta.status_code == 200
    assert Decimal(respuesta.json()["prima"]) == PRIMA_HIPOTECARIO_NEUTRAL


def test_consentimiento_incompleto_se_rechaza():
    socio = socio_con(hipotecario())

    respuesta = cotizar(socio, {**HIPOTECARIO, "consentimiento_open_finance": {"cliente_ref": "cliente-77"}})

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"]["campos"] == [
        {"campo": "consentimiento_open_finance.consentimiento_id", "error": "Campo obligatorio"}
    ]


# Criterio 3: dependencia externa fuera de presupuesto → caché o valor por defecto, marcada como degradada.


def test_con_consentimiento_el_score_de_open_finance_entra_al_precio():
    usar_proveedor(_Proveedor(score="0.7"))
    socio = socio_con(hipotecario())

    oferta = cotizar(socio, {**HIPOTECARIO, "consentimiento_open_finance": CONSENTIMIENTO}).json()

    assert Decimal(oferta["prima"]) == Decimal("3360000.00")
    assert oferta["degradada"] is False
    assert oferta["senales"][0]["fuente"] == "open-finance"
    assert oferta["senales"][0]["origen"] == "proveedor"
    assert Decimal(oferta["senales"][0]["score_riesgo"]) == Decimal("0.7")


def test_proveedor_caido_sin_cache_usa_el_valor_por_defecto_y_marca_degradada():
    usar_proveedor(_Proveedor(error=httpx.ReadTimeout("timeout")))
    socio = socio_con(hipotecario())

    oferta = cotizar(socio, {**HIPOTECARIO, "consentimiento_open_finance": CONSENTIMIENTO}).json()

    assert Decimal(oferta["prima"]) == PRIMA_HIPOTECARIO_NEUTRAL
    assert oferta["degradada"] is True
    assert oferta["senales"][0]["origen"] == "valor_por_defecto"
    guardada = next(item for item in container.cotizaciones.items if item.id == oferta["id"])
    assert guardada.degradada is True
    assert guardada.senales[0].origen is OrigenSenal.VALOR_POR_DEFECTO


def test_proveedor_caido_con_cache_usa_el_ultimo_valor_bueno():
    proveedor = _Proveedor(score="0.7")
    usar_proveedor(proveedor)
    socio = socio_con(hipotecario())
    solicitud = {**HIPOTECARIO, "consentimiento_open_finance": CONSENTIMIENTO}
    cotizar(socio, solicitud)

    proveedor.error = ConnectionError("circuito abierto")
    oferta = cotizar(socio, solicitud).json()

    assert Decimal(oferta["prima"]) == Decimal("3360000.00")
    assert oferta["degradada"] is True
    assert oferta["senales"][0]["origen"] == "cache"


def test_cache_caida_no_tumba_la_cotizacion():
    usar_proveedor(_Proveedor(error=TimeoutError()), cache=_CacheCaida())
    socio = socio_con(hipotecario())

    respuesta = cotizar(socio, {**HIPOTECARIO, "consentimiento_open_finance": CONSENTIMIENTO})

    assert respuesta.status_code == 200
    assert respuesta.json()["senales"][0]["origen"] == "valor_por_defecto"


def test_sin_consentimiento_no_se_consulta_open_finance():
    proveedor = _Proveedor(score="0.7")
    usar_proveedor(proveedor)
    socio = socio_con(hipotecario())

    oferta = cotizar(socio, HIPOTECARIO).json()

    assert proveedor.llamadas == 0
    assert oferta["degradada"] is False
    assert Decimal(oferta["prima"]) == PRIMA_HIPOTECARIO_NEUTRAL


# Adaptador real: timeout duro, un solo intento y respuesta inválida tratada como falla.


@pytest.fixture
def open_finance():
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.server.llamadas += 1
            time.sleep(self.server.retraso_s)
            cuerpo = json.dumps(self.server.cuerpo).encode()
            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(cuerpo)))
                self.end_headers()
                self.wfile.write(cuerpo)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *args):
            pass

    servidor = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    servidor.retraso_s = 0
    servidor.cuerpo = {"score_riesgo": "0.62"}
    servidor.llamadas = 0
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    yield servidor
    servidor.shutdown()


def _url(servidor) -> str:
    return f"http://127.0.0.1:{servidor.server_port}"


def test_adapter_real_responde_a_tiempo(open_finance):
    caso = ResolverScoreRiesgoUseCase(construir_proveedor(_url(open_finance), None, 0.3), InMemoryCache(), ttl_s=60)

    senal = caso.execute(ConsentimientoOpenFinance(**CONSENTIMIENTO))

    assert senal.origen is OrigenSenal.PROVEEDOR
    assert senal.score_riesgo == Decimal("0.62")


def test_adapter_real_corta_al_superar_el_timeout_sin_reintentar(open_finance):
    open_finance.retraso_s = 1.0
    caso = ResolverScoreRiesgoUseCase(construir_proveedor(_url(open_finance), None, 0.3), InMemoryCache(), ttl_s=60)

    inicio = time.perf_counter()
    senal = caso.execute(ConsentimientoOpenFinance(**CONSENTIMIENTO))
    transcurrido = time.perf_counter() - inicio

    assert senal.origen is OrigenSenal.VALOR_POR_DEFECTO
    assert transcurrido < 0.8
    assert open_finance.llamadas == 1


@pytest.mark.parametrize("cuerpo", [{"score_riesgo": "1.5"}, {"score_riesgo": "alto"}, {"otro": 1}])
def test_respuesta_invalida_de_open_finance_se_trata_como_falla(open_finance, cuerpo):
    open_finance.cuerpo = cuerpo
    caso = ResolverScoreRiesgoUseCase(construir_proveedor(_url(open_finance), None, 0.3), InMemoryCache(), ttl_s=60)

    assert caso.execute(ConsentimientoOpenFinance(**CONSENTIMIENTO)).origen is OrigenSenal.VALOR_POR_DEFECTO


def test_el_adapter_hereda_el_timeout_configurado_y_no_reintenta():
    proveedor = construir_proveedor("https://open-finance.test", None, 0.3)

    assert isinstance(proveedor, PerfilOpenFinance)
    assert isinstance(proveedor.adapter, OpenFinanceCotizacionAdapter)
    assert proveedor.adapter.retries == 0
    assert proveedor.adapter.client.timeout == httpx.Timeout(0.3)
    proveedor.adapter.client.close()


def test_sin_url_responde_el_sandbox_determinista():
    proveedor = construir_proveedor(None, None, 0.3)
    consentimiento = ConsentimientoOpenFinance(**CONSENTIMIENTO)

    assert isinstance(proveedor, PerfilOpenFinanceSimulado)
    assert proveedor.score_riesgo(consentimiento) == proveedor.score_riesgo(consentimiento)
    assert Decimal("0.30") <= proveedor.score_riesgo(consentimiento) <= Decimal("0.70")


def test_el_timeout_no_puede_superar_el_techo_de_3000_ms():
    with pytest.raises(ValidationError):
        CotizacionSettings(open_finance_timeout_s=3.5)
