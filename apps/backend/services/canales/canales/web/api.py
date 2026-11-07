import httpx
from fastapi import APIRouter, HTTPException, status
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, identidad, pagos, polizas, siniestros

router = APIRouter(prefix="/web", tags=["BFF Web"])


@router.get("/")
def info() -> dict:
    return {"component": "BFF Web"}


RAMOS_COTIZABLES_WEB = {
    "ramo-viaje",
    "ramo-microseguro-vida",
    "ramo-vida-hipotecario",
    "ramo-parametrico",
}

RAMOS_CON_CONSENTIMIENTO = {"vida-hipotecario", "ramo-vida-hipotecario"}


@router.get("/ramos")
def listar_ramos() -> list:
    ramos = call_upstream(cotizacion.get, "/catalogo/ramos")
    return [r for r in ramos if r.get("id") in RAMOS_COTIZABLES_WEB]


def _extraer_identificacion(solicitud: dict) -> tuple[str, str]:
    tipo_doc = str(solicitud.get("tipo_documento") or solicitud.get("tipoDocumento") or "").strip()
    num_doc = str(solicitud.get("numero_documento") or solicitud.get("numeroDocumento") or "").strip()
    return tipo_doc, num_doc


def _buscar_cliente_por_documento(tipo_doc: str, num_doc: str) -> str | None:
    try:
        cliente = identidad.get(f"/identidad/clientes/por-documento/{tipo_doc}/{num_doc}")
        if cliente and cliente.get("id"):
            return cliente["id"]
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != status.HTTP_404_NOT_FOUND:
            raise
    return None


def _asegurar_nuevo_cliente(solicitud: dict, tipo_doc: str, num_doc: str) -> str | None:
    nombre = str(solicitud.get("nombre") or "").strip() or "Cliente"
    apellido = str(solicitud.get("apellido") or "").strip()
    email = str(solicitud.get("email") or "").strip()
    telefono = str(solicitud.get("telefono") or "").strip()
    fecha_nac = solicitud.get("fecha_nacimiento") or solicitud.get("fechaNacimiento")
    fecha_nac_str = str(fecha_nac) if fecha_nac else None

    nuevo = call_upstream(
        identidad.post,
        "/identidad/clientes/asegurar",
        json={
            "tipo_documento": tipo_doc,
            "numero_documento": num_doc,
            "nombre": nombre,
            "apellido": apellido,
            "email": email,
            "telefono": telefono,
            "fecha_nacimiento": fecha_nac_str,
        },
    )
    if not nuevo:
        return None
    return nuevo.get("id")


def _resolver_cliente_id(solicitud: dict) -> str | None:
    tipo_doc, num_doc = _extraer_identificacion(solicitud)
    if not (tipo_doc and num_doc):
        return solicitud.get("cliente_id")

    # 1. Validar si el usuario existe por tipo de documento y número de documento
    cliente_id = _buscar_cliente_por_documento(tipo_doc, num_doc)
    if cliente_id:
        return cliente_id

    # 2. Si no existe, se debe crear el nuevo cliente
    return _asegurar_nuevo_cliente(solicitud, tipo_doc, num_doc)


def _validar_consentimiento_si_aplica(solicitud: dict) -> None:
    producto_id = solicitud.get("producto_id", "")
    if producto_id not in RAMOS_CON_CONSENTIMIENTO:
        return
    consentimiento_id = solicitud.get("consentimiento_id")
    if not consentimiento_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El ramo vida hipotecario requiere consentimiento digital previamente validado",
        )
    consentimiento = call_upstream(identidad.get, f"/identidad/{consentimiento_id}")
    if not consentimiento or str(consentimiento.get("estado", "")).strip().upper() != "OTORGADO":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El consentimiento digital no se encuentra otorgado o no es válido",
        )


@router.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    _validar_consentimiento_si_aplica(solicitud)

    cliente_id = _resolver_cliente_id(solicitud)
    if cliente_id:
        solicitud["cliente_id"] = cliente_id

    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud,
        headers={"X-Canal": "web"},
    )


@router.get("/cotizaciones/{cotizacion_id}")
def obtener_cotizacion(cotizacion_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/consenso/cotizaciones/{cotizacion_id}")


@router.post("/socios", status_code=status.HTTP_201_CREATED)
def dar_de_alta_socio(alta: dict) -> dict:
    return call_upstream(cotizacion.post, "/gobierno-socios/socios", json=alta)


@router.get("/socios")
def listar_socios() -> list:
    return call_upstream(cotizacion.get, "/gobierno-socios/socios")


@router.get("/socios/{socio_id}")
def obtener_socio(socio_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/gobierno-socios/socios/{socio_id}")


@router.get("/socios/{socio_id}/configuracion")
def consultar_configuracion_socio(socio_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/gobierno-socios/socios/{socio_id}/configuracion")


@router.put("/socios/{socio_id}/configuracion")
def actualizar_configuracion_socio(socio_id: str, configuracion: dict) -> dict:
    return call_upstream(cotizacion.put, f"/gobierno-socios/socios/{socio_id}/configuracion", json=configuracion)


# --- HU005: consulta de pólizas para el portal (vista ya armada para la UI) ---

ESTADO_POLIZA = {"activa": "Activa", "cancelada": "Cancelada", "vencida": "Vencida"}
ESTADO_PAGO = {"aprobado": "Aprobado", "procesando": "Pendiente", "rechazado": "Rechazado"}
ESTADO_SINIESTRO = {"borrador": "Reportado", "radicado": "En revisión"}


def _o_vacio(fn, *args, **kwargs) -> dict:
    """Un cliente o socio que ya no existe no debe tumbar el listado."""
    try:
        return call_upstream(fn, *args, **kwargs) or {}
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            return {}
        raise


def _vista_poliza(poliza: dict, cliente: dict, socio: dict) -> dict:
    return {
        "id": poliza["id"],
        "number": poliza["numero"],
        "tipoDocumento": cliente.get("tipo_documento", ""),
        "identification": cliente.get("numero_documento", ""),
        "insuredName": f"{cliente.get('nombre', '')} {cliente.get('apellido', '')}".strip() or "Sin datos del asegurado",
        "ramo": poliza["producto_id"],
        "producto": poliza["producto_id"],
        "socioOrigen": socio.get("nombre") or poliza.get("socio_id") or poliza["canal"],
        "status": ESTADO_POLIZA.get(poliza["estado"], poliza["estado"]),
        "startDate": poliza["vigencia"]["desde"],
        "endDate": poliza["vigencia"]["hasta"],
        "premium": float(poliza["prima"]),
        "phone": cliente.get("telefono", ""),
        "email": cliente.get("email", ""),
        "coverages": [{"name": c["nombre"], "included": True} for c in poliza.get("coberturas", [])],
        "beneficiaries": [],
        "payments": [],
        "claims": [],
        "endorsements": [],
    }


def _contexto(poliza: dict, clientes: dict, socios: dict) -> tuple[dict, dict]:
    cliente_id, socio_id = poliza.get("cliente_id"), poliza.get("socio_id")
    if cliente_id and cliente_id not in clientes:
        clientes[cliente_id] = _o_vacio(identidad.get, f"/identidad/clientes/{cliente_id}")
    if socio_id and socio_id not in socios:
        socios[socio_id] = _o_vacio(cotizacion.get, f"/gobierno-socios/socios/{socio_id}")
    return clientes.get(cliente_id, {}), socios.get(socio_id, {})


@router.get("/polizas")
def buscar_polizas(q: str | None = None) -> list[dict]:
    """Busca por número de póliza (parcial) o por número de identificación del cliente."""
    texto = (q or "").strip()
    params: dict = {}
    if texto:
        params["q"] = texto
        cliente = _o_vacio(identidad.get, f"/identidad/clientes/por-numero/{texto}")
        if cliente.get("id"):
            params["cliente_id"] = [cliente["id"]]
    encontradas = call_upstream(polizas.get, "/polizas", params=params)
    clientes: dict = {}
    socios: dict = {}
    return [_vista_poliza(p, *_contexto(p, clientes, socios)) for p in encontradas]


def _pagos(poliza: dict) -> list[dict]:
    cobro = _o_vacio(pagos.get, f"/pagos/cobros/{poliza['cobro_id']}")
    if not cobro:
        return []
    return [
        {
            "ref": cobro["id"],
            "date": cobro["creado_en"][:10],
            "tipo": "Prima",
            "amount": float(cobro["monto"]),
            "status": ESTADO_PAGO.get(cobro["estado"], "Pendiente"),
        }
    ]


def _siniestros(poliza: dict) -> list[dict]:
    if not poliza.get("cliente_id"):
        return []
    avisos = call_upstream(siniestros.get, "/siniestros/avisos", headers={"X-Cliente-Id": poliza["cliente_id"]})
    return [
        {
            "id": a.get("radicado") or a["id"],
            "tipo": a["tipo"],
            "fechaOcurrencia": a["ocurrido_en"][:10],
            "status": ESTADO_SINIESTRO.get(a["estado"], "Reportado"),
        }
        for a in avisos
        if a["poliza_id"] == poliza["id"]
    ]


@router.get("/polizas/{poliza_id}")
def obtener_poliza(poliza_id: str) -> dict:
    poliza = call_upstream(polizas.get, f"/polizas/{poliza_id}")
    vista = _vista_poliza(poliza, *_contexto(poliza, {}, {}))
    beneficiarios = call_upstream(polizas.get, f"/polizas/{poliza_id}/beneficiarios")
    return {
        **vista,
        "beneficiaries": [
            {"name": b["nombre"], "parentesco": b["parentesco"], "porcentaje": float(b["porcentaje"])}
            for b in beneficiarios
        ],
        "payments": _pagos(poliza),
        "claims": _siniestros(poliza),
    }


# --- HU002: Proxy de Consentimiento Digital hacia identidad ---


@router.post("/consentimientos/solicitar", status_code=status.HTTP_201_CREATED)
def solicitar_consentimiento(solicitud: dict) -> dict:
    return call_upstream(identidad.post, "/identidad/solicitar", json=solicitud)


@router.post("/consentimientos/validar")
def validar_consentimiento(solicitud: dict) -> dict:
    return call_upstream(identidad.post, "/identidad/validar", json=solicitud)


@router.get("/consentimientos/{consentimiento_id}")
def consultar_consentimiento(consentimiento_id: str) -> dict:
    return call_upstream(identidad.get, f"/identidad/{consentimiento_id}")
