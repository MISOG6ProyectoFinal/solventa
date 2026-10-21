from datetime import UTC, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from identidad.container import container
from identidad.kyc.adapters.consentimiento_repository import PostgresConsentimientoRepository
from identidad.kyc.domain.models import Consentimiento
from identidad.kyc.domain.otp import generar_codigo, hash_codigo, verificar_codigo
from identidad.main import app

client = TestClient(app)


def test_otp_helpers():
    codigo = generar_codigo()
    assert len(codigo) == 6
    assert codigo.isdigit()
    hash_val = hash_codigo(codigo)
    assert verificar_codigo(codigo, hash_val) is True
    assert verificar_codigo("000000", hash_val) is False


def test_solicitar_consentimiento_modelo_dominio_cliente():
    payload = {
        "tipo_documento": "CC",
        "numero_documento": "1098700941",
        "nombre": "Pedro Perez",
        "email": "pperez@notmail.com",
        "telefono": "3176663766",
        "canal": "sms",
        "contacto": "3176663766",
        "alcance": ["Open Finance", "Open Data"],
        "asesor": "Ana Gómez (asesor)",
    }
    response = client.post("/identidad/solicitar", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["cliente_id"] == "CLI-1098700941"
    assert data["fuente"] == "SMS: 3176663766"
    assert data["alcance"] == ["Open Finance", "Open Data"]
    assert data["estado"] == "PENDIENTE"

    # Verificar que el Cliente fue creado en el repositorio
    cliente = container.clients.get("CLI-1098700941")
    assert cliente is not None
    assert cliente.nombre == "Pedro Perez"
    assert cliente.numero_documento == "1098700941"
    assert cliente.email == "pperez@notmail.com"
    assert cliente.telefono == "3176663766"

    # Validar consentimiento
    val_resp = client.post(
        "/identidad/validar",
        json={"consentimiento_id": data["consentimiento_id"], "codigo": data["codigo_demo"]},
    )
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["estado"] == "OTORGADO"
    assert val_data["fecha_otorgamiento"] is not None

    # Consultar consentimiento
    get_resp = client.get(f"/identidad/{data['consentimiento_id']}")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["cliente_id"] == "CLI-1098700941"
    assert get_data["cliente_nombre"] == "Pedro Perez"
    assert get_data["fuente"] == "SMS: 3176663766"


def test_solicitar_consentimiento_con_celular_real():
    payload = {
        "cliente_id": "CLI-1098700941",
        "ramo": "VIDA_HIPOTECARIO",
        "canal": "sms",
        "contacto": "3176663766",
        "open_finance": True,
        "open_data": True,
        "asesor": "Ana Gómez (asesor)",
    }
    response = client.post("/identidad/solicitar", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["contacto"] == "3176663766"
    assert data["contacto_mask"] == "***3766"


def test_solicitar_consentimiento_con_correo_real():
    payload = {
        "cliente_id": "CLI-1098700941",
        "ramo": "VIDA_HIPOTECARIO",
        "canal": "email",
        "contacto": "pperez@notmail.com",
        "open_finance": True,
        "open_data": True,
        "asesor": "Ana Gómez (asesor)",
    }
    response = client.post("/identidad/solicitar", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["contacto"] == "pperez@notmail.com"
    assert data["contacto_mask"] == "pp***@notmail.com"


def test_solicitar_consentimiento_exitoso():
    payload = {
        "cliente_id": "CLI-100",
        "ramo": "VIDA_HIPOTECARIO",
        "canal": "sms",
        "contacto_mask": "***4567",
        "open_finance": True,
        "open_data": True,
        "asesor": "Ana Gómez (asesor)",
    }
    response = client.post("/identidad/solicitar", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["consentimiento_id"].startswith("CNS-")
    assert data["estado"] == "PENDIENTE"
    assert data["contacto_mask"] == "***4567"
    assert len(data["codigo_demo"]) == 6
    assert data["codigo_demo"].isdigit()
    assert "expira_en" in data


def test_validar_consentimiento_codigo_correcto():
    # 1. Solicitar
    solicitud_resp = client.post(
        "/identidad/solicitar",
        json={
            "cliente_id": "CLI-100",
            "ramo": "VIDA_HIPOTECARIO",
            "canal": "sms",
            "contacto_mask": "***4567",
            "open_finance": True,
            "open_data": True,
            "asesor": "Ana Gómez (asesor)",
        },
    ).json()

    cns_id = solicitud_resp["consentimiento_id"]
    codigo = solicitud_resp["codigo_demo"]

    # 2. Validar con código correcto
    val_resp = client.post(
        "/identidad/validar",
        json={"consentimiento_id": cns_id, "codigo": codigo},
    )
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["consentimiento_id"] == cns_id
    assert val_data["estado"] == "OTORGADO"
    assert val_data["asesor"] == "Ana Gómez (asesor)"
    assert val_data["canal"] == "sms"
    assert val_data["open_finance"] is True
    assert val_data["open_data"] is True
    assert val_data["validado_en"] is not None

    # 3. Consultar
    get_resp = client.get(f"/identidad/{cns_id}")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["consentimiento_id"] == cns_id
    assert get_data["estado"] == "Otorgado"
    assert get_data["asesor"] == "Ana Gómez (asesor)"
    assert get_data["canal"] == "Código por SMS"
    assert get_data["alcance"] == "Open Finance, Open Data"


def test_validar_consentimiento_codigo_incorrecto():
    solicitud_resp = client.post(
        "/identidad/solicitar",
        json={
            "cliente_id": "CLI-200",
            "ramo": "PROTECCION_PAGOS",
            "canal": "email",
            "contacto_mask": "cli***@test.com",
            "open_finance": True,
            "open_data": False,
            "asesor": "Carlos Pérez",
        },
    ).json()

    cns_id = solicitud_resp["consentimiento_id"]

    val_resp = client.post(
        "/identidad/validar",
        json={"consentimiento_id": cns_id, "codigo": "999999"},
    )
    assert val_resp.status_code == 422
    assert "incorrecto" in val_resp.json()["detail"].lower()


def test_validar_consentimiento_no_encontrado():
    val_resp = client.post(
        "/identidad/validar",
        json={"consentimiento_id": "CNS-NONEXISTENT", "codigo": "123456"},
    )
    assert val_resp.status_code == 404


def test_validar_consentimiento_expirado():
    # Insert direct expired consent into repository
    cns_id = "CNS-EXPIRED"
    codigo = "111111"
    ahora = datetime.now(UTC)
    expirado = Consentimiento(
        id=cns_id,
        cliente_id="CLI-EXP",
        ramo="VIDA_HIPOTECARIO",
        canal="sms",
        contacto_mask="***1111",
        open_finance=True,
        open_data=True,
        estado="PENDIENTE",
        codigo_hash=hash_codigo(codigo),
        codigo_demo=codigo,
        asesor="Ana Gómez (asesor)",
        solicitado_en=ahora - timedelta(minutes=10),
        expira_en=ahora - timedelta(minutes=5),
    )
    container.consentimientos.add(expirado)

    val_resp = client.post(
        "/identidad/validar",
        json={"consentimiento_id": cns_id, "codigo": codigo},
    )
    assert val_resp.status_code == 410
    assert "expirado" in val_resp.json()["detail"].lower()


def test_postgres_consentimiento_repository_roundtrip():
    engine = create_engine("sqlite:///:memory:")
    repo = PostgresConsentimientoRepository(engine)
    repo.create_schema()

    ahora = datetime.now(UTC)
    cns = Consentimiento(
        id="CNS-SQLITE-1",
        cliente_id="CLI-SQLITE",
        ramo="VIDA_HIPOTECARIO",
        canal="email",
        contacto="user@test.com",
        contacto_mask="us***@test.com",
        open_finance=True,
        open_data=False,
        estado="PENDIENTE",
        codigo_hash=hash_codigo("123456"),
        codigo_demo="123456",
        asesor="Test Asesor",
        solicitado_en=ahora,
        expira_en=ahora + timedelta(minutes=5),
    )
    repo.add(cns)

    fetched = repo.get("CNS-SQLITE-1")
    assert fetched is not None
    assert fetched.id == "CNS-SQLITE-1"
    assert fetched.cliente_id == "CLI-SQLITE"
    assert fetched.contacto == "user@test.com"
    assert fetched.estado == "PENDIENTE"
    assert fetched.open_finance is True
    assert fetched.open_data is False

    fetched.estado = "OTORGADO"
    fetched.validado_en = ahora + timedelta(minutes=1)
    repo.update(fetched)

    updated = repo.get("CNS-SQLITE-1")
    assert updated is not None
    assert updated.estado == "OTORGADO"
