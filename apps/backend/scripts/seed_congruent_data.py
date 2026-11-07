# ruff: noqa: E501
"""Seed script: Poblar las bases de datos con datos congruentes de Solventa.

Entidades pobladas:
- Ramo y Producto (cotizacion.ramos, cotizacion.productos, cotizacion.coberturas)
- Socio Aliado (cotizacion.socios)
- Cliente (identidad.clientes)
- Consentimiento (identidad.consentimientos)
- Cotización (cotizacion.cotizaciones)
- Póliza (polizas.polizas)
- Beneficiario (polizas.beneficiarios)
- Endoso (polizas.endosos)
- Cobro y Pago (pagos.cobros y pagos.pagos)
- Siniestro y Aviso (siniestros.avisos)
"""

import json
from datetime import UTC, date, datetime

from sqlalchemy import create_engine, text

DB_USER = "solventa"
DB_PASS = "solventa"
DB_HOST = "localhost"
DB_PORT = "5433"

COB_ASISTENCIA_VIAJE = "Asistencia en viaje"
COB_DANO_ACCIDENTAL = "Daño accidental"
COB_RETRASO_VUELO = "Retraso de vuelo"
COB_DESEMPLEO_INVOLUNTARIO = "Desempleo involuntario"
COB_FALLECIMIENTO_CREDITO = "Fallecimiento (saldo del crédito)"
CREADOR_SISTEMA_SOLVENTA = "Sistema Solventa"
BANNER_SEPARATOR = "================================================================="


def get_engine(db_name: str):
    return create_engine(f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{db_name}")


def seed_catalogo_y_cotizacion():
    print("-> Poblando base de datos 'cotizacion' (Ramos, Productos, Coberturas, Socios, Cotizaciones)...")
    engine = get_engine("cotizacion")
    with engine.begin() as conn:
        # 1. Esquema base de Catálogo
        conn.execute(
            text("""
        CREATE TABLE IF NOT EXISTS ramos (
            id VARCHAR(64) PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS productos (
            id VARCHAR(64) PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            ramo_id VARCHAR(64) NOT NULL REFERENCES ramos(id),
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            disponible_mobile BOOLEAN NOT NULL DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS coberturas (
            id VARCHAR(64) PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            producto_id VARCHAR(64) NOT NULL REFERENCES productos(id)
        );
        CREATE TABLE IF NOT EXISTS socios (
            id VARCHAR(36) PRIMARY KEY,
            nombre VARCHAR(120) NOT NULL,
            identificador VARCHAR(63) NOT NULL UNIQUE,
            tipo VARCHAR(32) NOT NULL,
            pais VARCHAR(120) NOT NULL,
            correo_contacto VARCHAR(254) NOT NULL,
            alcances JSON NOT NULL,
            client_id VARCHAR(64) NOT NULL UNIQUE,
            secreto_hash VARCHAR(64) NOT NULL,
            secreto_enmascarado VARCHAR(32) NOT NULL,
            estado_credencial VARCHAR(16) NOT NULL,
            estado_contrato VARCHAR(16) NOT NULL,
            version_contrato VARCHAR(16) NOT NULL,
            cuota_consumo INTEGER NOT NULL,
            alta_fecha TIMESTAMP WITH TIME ZONE NOT NULL,
            alta_usuario VARCHAR(120) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cotizaciones (
            id VARCHAR(36) PRIMARY KEY,
            producto_id VARCHAR(64) NOT NULL,
            prima NUMERIC(18, 2) NOT NULL,
            coberturas JSON NOT NULL,
            vigencia_desde DATE NOT NULL,
            vigencia_hasta DATE NOT NULL,
            version_reglas VARCHAR(64) NOT NULL,
            datos_riesgo JSON,
            canal VARCHAR(16) DEFAULT 'web',
            vigente_hasta VARCHAR(40),
            cliente_id VARCHAR(64),
            socio_id VARCHAR(36),
            degradada BOOLEAN DEFAULT FALSE,
            senales JSON,
            estado VARCHAR(32) DEFAULT 'VIGENTE',
            impuestos NUMERIC(18, 2) DEFAULT 0.00,
            desglose JSON,
            consentimiento_id VARCHAR(64)
        );
        """)
        )

        # 2. Ramos Oficiales de Solventa
        ramos_data = [
            ("ramo-viaje", "Viaje"),
            ("ramo-microseguro-vida", "Microseguro de vida"),
            ("ramo-parametrico", "Paramétrico (clima / vuelo)"),
            ("ramo-vida-hipotecario", "Vida hipotecario"),
            ("ramo-dispositivos", "Protección de dispositivos"),
            ("ramo-proteccion-pagos", "Protección de pagos"),
            ("ramo-hogar", "Hogar"),
            ("ramo-auto", "Automóviles"),
            ("ramo-vida", "Vida"),
        ]
        for r_id, r_nom in ramos_data:
            conn.execute(
                text(
                    "INSERT INTO ramos (id, nombre) VALUES (:id, :nom) ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;"
                ),
                {"id": r_id, "nom": r_nom},
            )

        # 3. Productos Oficiales
        productos_data = [
            ("viaje-internacional", "Viaje Internacional", "ramo-viaje", True, True),
            ("vida-esencial", "Vida Esencial", "ramo-microseguro-vida", True, True),
            ("parametrico-clima-vuelo", "Paramétrico Clima y Vuelo", "ramo-parametrico", True, False),
            ("vida-hipotecario", "Vida Hipotecario", "ramo-vida-hipotecario", True, False),
            ("proteccion-celular", "Protección Celular", "ramo-dispositivos", True, False),
            ("proteccion-pagos", "Protección de Pagos", "ramo-proteccion-pagos", True, False),
            ("hogar", "Seguro Hogar", "ramo-hogar", True, True),
            ("auto", "Seguro Auto", "ramo-auto", True, True),
            ("vida-temporal", "Vida Temporal", "ramo-vida", True, False),
        ]
        for p_id, p_nom, r_id, act, mob in productos_data:
            conn.execute(
                text("""
                INSERT INTO productos (id, nombre, ramo_id, activo, disponible_mobile)
                VALUES (:id, :nom, :rid, :act, :mob)
                ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, activo = EXCLUDED.activo;
                """),
                {"id": p_id, "nom": p_nom, "rid": r_id, "act": act, "mob": mob},
            )

        # 4. Coberturas (23 coberturas oficiales de Solventa)
        coberturas_data = [
            ("hogar-incendio", "Incendio", "hogar"),
            ("hogar-robo", "Robo", "hogar"),
            ("auto-rc", "Responsabilidad civil", "auto"),
            ("auto-danos", "Daños materiales", "auto"),
            ("vida-fallecimiento", "Fallecimiento", "vida-temporal"),
            ("viaje-gastos-medicos", "Gastos médicos en el exterior", "viaje-internacional"),
            ("viaje-cancelacion", "Cancelación de viaje", "viaje-internacional"),
            ("viaje-equipaje", "Pérdida de equipaje", "viaje-internacional"),
            ("viaje-asistencia", COB_ASISTENCIA_VIAJE, "viaje-internacional"),
            ("celular-dano-accidental", COB_DANO_ACCIDENTAL, "proteccion-celular"),
            ("celular-robo", "Robo", "proteccion-celular"),
            ("celular-liquidos", "Daño por líquidos", "proteccion-celular"),
            ("vida-esencial-fallecimiento", "Fallecimiento", "vida-esencial"),
            ("vida-esencial-auxilio", "Auxilio funerario", "vida-esencial"),
            ("parametrico-retraso-vuelo", COB_RETRASO_VUELO, "parametrico-clima-vuelo"),
            ("parametrico-lluvia", "Lluvia excesiva", "parametrico-clima-vuelo"),
            ("parametrico-sequia", "Sequía", "parametrico-clima-vuelo"),
            ("pagos-desempleo", COB_DESEMPLEO_INVOLUNTARIO, "proteccion-pagos"),
            ("pagos-incapacidad-temporal", "Incapacidad temporal", "proteccion-pagos"),
            ("pagos-fallecimiento", "Fallecimiento (saldo de la deuda)", "proteccion-pagos"),
            ("hipotecario-fallecimiento", COB_FALLECIMIENTO_CREDITO, "vida-hipotecario"),
            ("hipotecario-incapacidad", "Incapacidad total y permanente", "vida-hipotecario"),
            ("hipotecario-enfermedades", "Enfermedades graves", "vida-hipotecario"),
        ]
        for c_id, c_nom, p_id in coberturas_data:
            conn.execute(
                text(
                    "INSERT INTO coberturas (id, nombre, producto_id) VALUES (:id, :nom, :pid) ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;"
                ),
                {"id": c_id, "nom": c_nom, "pid": p_id},
            )

        # 5. Socios Comerciales
        now_utc = datetime(2025, 10, 1, 10, 0, tzinfo=UTC)
        socios_data = [
            (
                "socio-banco-aurora",
                "Banco Aurora",
                "banco-aurora",
                "Banco",
                "Colombia",
                "api@aurora.test",
                json.dumps(["cotizacion", "emision"]),
                "sv_live_aurora_01",
                "hash-aurora",
                "sv_sec_aurora_***",
                "ACTIVA",
                "VIGENTE",
                "1.0",
                10000,
                now_utc,
                CREADOR_SISTEMA_SOLVENTA,
            ),
            (
                "socio-aerolinea-andina",
                "Aerolínea Andina",
                "aerolinea-andina",
                "Aerolínea",
                "Colombia",
                "ops@andina.test",
                json.dumps(["cotizacion", "emision"]),
                "sv_live_andina_02",
                "hash-andina",
                "sv_sec_andina_***",
                "ACTIVA",
                "VIGENTE",
                "1.0",
                5000,
                now_utc,
                CREADOR_SISTEMA_SOLVENTA,
            ),
            (
                "socio-retail-pay",
                "RetailPay",
                "retail-pay",
                "Fintech",
                "Colombia",
                "contacto@retailpay.test",
                json.dumps(["cotizacion", "emision"]),
                "sv_live_retail_03",
                "hash-retail",
                "sv_sec_retail_***",
                "ACTIVA",
                "VIGENTE",
                "1.0",
                8000,
                now_utc,
                CREADOR_SISTEMA_SOLVENTA,
            ),
        ]
        for s in socios_data:
            conn.execute(
                text("""
                INSERT INTO socios (
                    id, nombre, identificador, tipo, pais, correo_contacto, alcances, client_id,
                    secreto_hash, secreto_enmascarado, estado_credencial, estado_contrato,
                    version_contrato, cuota_consumo, alta_fecha, alta_usuario
                )
                VALUES (:id, :nom, :ident, :tipo, :pais, :mail, :alc, :cid, :sh, :se, :ec, :ct, :vc, :cuota, :af, :au)
                ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
                """),
                {
                    "id": s[0],
                    "nom": s[1],
                    "ident": s[2],
                    "tipo": s[3],
                    "pais": s[4],
                    "mail": s[5],
                    "alc": s[6],
                    "cid": s[7],
                    "sh": s[8],
                    "se": s[9],
                    "ec": s[10],
                    "ct": s[11],
                    "vc": s[12],
                    "cuota": s[13],
                    "af": s[14],
                    "au": s[15],
                },
            )

        # 6. Cotizaciones Congruentes
        cotizaciones = [
            (
                "COT-2025-00391",
                "vida-hipotecario",
                1280000.00,
                json.dumps(
                    [
                        {
                            "id": "hipotecario-fallecimiento",
                            "nombre": COB_FALLECIMIENTO_CREDITO,
                            "included": True,
                        },
                        {"id": "hipotecario-incapacidad", "nombre": "Incapacidad total y permanente", "included": True},
                    ]
                ),
                date(2025, 12, 1),
                date(2026, 11, 30),
                "2025.12.0",
                "web",
                "2026-11-30T23:59:59",
                "CLI-CC-1020304050",
                "socio-banco-aurora",
                False,
                "VIGENTE",
                0.00,
                "consent-maria-1",
            ),
            (
                "COT-2025-01820",
                "proteccion-celular",
                420000.00,
                json.dumps(
                    [
                        {"id": "celular-dano-accidental", "nombre": COB_DANO_ACCIDENTAL, "included": True},
                        {"id": "celular-robo", "nombre": "Robo", "included": True},
                    ]
                ),
                date(2025, 10, 6),
                date(2026, 10, 5),
                "2025.10.0",
                "web",
                "2026-10-05T23:59:59",
                "CLI-CC-1020304050",
                "socio-retail-pay",
                False,
                "VIGENTE",
                67058.00,
                None,
            ),
            (
                "COT-2026-00901",
                "viaje-internacional",
                270000.00,
                json.dumps([{"id": "viaje-asistencia", "nombre": COB_ASISTENCIA_VIAJE, "included": True}]),
                date(2026, 4, 10),
                date(2026, 4, 24),
                "2026.04.0",
                "web",
                "2026-04-24T23:59:59",
                "CLI-CC-79800123",
                "socio-aerolinea-andina",
                False,
                "VENCIDA",
                43109.00,
                None,
            ),
            (
                "COT-2025-00412",
                "vida-esencial",
                90000.00,
                json.dumps([{"id": "vida-esencial-fallecimiento", "nombre": "Fallecimiento", "included": True}]),
                date(2025, 2, 1),
                date(2026, 1, 31),
                "2025.02.0",
                "mobile",
                "2026-01-31T23:59:59",
                "CLI-CC-52100300",
                None,
                False,
                "CANCELADA",
                0.00,
                None,
            ),
            (
                "COT-2026-02210",
                "parametrico-clima-vuelo",
                60000.00,
                json.dumps([{"id": "parametrico-retraso-vuelo", "nombre": COB_RETRASO_VUELO, "included": True}]),
                date(2026, 8, 1),
                date(2026, 12, 31),
                "2026.08.0",
                "web",
                "2026-12-31T23:59:59",
                "CLI-CC-80456789",
                "socio-aerolinea-andina",
                False,
                "VIGENTE",
                9580.00,
                None,
            ),
            (
                "COT-2025-03377",
                "proteccion-pagos",
                540000.00,
                json.dumps([{"id": "pagos-desempleo", "nombre": COB_DESEMPLEO_INVOLUNTARIO, "included": True}]),
                date(2025, 11, 15),
                date(2026, 11, 14),
                "2025.11.0",
                "web",
                "2026-11-14T23:59:59",
                "CLI-CC-1098765432",
                "socio-banco-aurora",
                False,
                "VIGENTE",
                0.00,
                "consent-luis-1",
            ),
        ]
        for cot in cotizaciones:
            conn.execute(
                text("""
                INSERT INTO cotizaciones (
                    id, producto_id, prima, coberturas, vigencia_desde, vigencia_hasta, version_reglas,
                    canal, vigente_hasta, cliente_id, socio_id, degradada, estado, impuestos, consentimiento_id
                )
                VALUES (
                    :id, :pid, :prima, :cob, :vd, :vh, :vr, :canal, :v_hasta, :cid, :sid, :deg, :est, :imp, :cons_id
                )
                ON CONFLICT (id) DO UPDATE SET prima = EXCLUDED.prima, estado = EXCLUDED.estado;
                """),
                {
                    "id": cot[0],
                    "pid": cot[1],
                    "prima": cot[2],
                    "cob": cot[3],
                    "vd": cot[4],
                    "vh": cot[5],
                    "vr": cot[6],
                    "canal": cot[7],
                    "v_hasta": cot[8],
                    "cid": cot[9],
                    "sid": cot[10],
                    "deg": cot[11],
                    "est": cot[12],
                    "imp": cot[13],
                    "cons_id": cot[14],
                },
            )
    print("  ✓ Ramos, Productos, Coberturas, Socios y Cotizaciones insertados.")


def seed_identidad():
    print("-> Poblando base de datos 'identidad' (Cliente, Consentimiento)...")
    engine = get_engine("identidad")
    with engine.begin() as conn:
        conn.execute(
            text("""
        CREATE TABLE IF NOT EXISTS clientes (
            id VARCHAR(36) PRIMARY KEY,
            tipo_documento VARCHAR(10) DEFAULT 'CC',
            numero_documento VARCHAR(30),
            nombre VARCHAR(120) NOT NULL,
            apellido VARCHAR(120) DEFAULT '',
            email VARCHAR(254) NOT NULL,
            telefono VARCHAR(30),
            fecha_nacimiento DATE
        );
        CREATE TABLE IF NOT EXISTS cuentas (
            cliente_id VARCHAR(36) PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
            password_hash VARCHAR(64) NOT NULL,
            salt VARCHAR(32) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS consentimientos (
            id VARCHAR(36) PRIMARY KEY,
            cliente_id VARCHAR(50) NOT NULL,
            alcance VARCHAR(254),
            fuente VARCHAR(120),
            estado VARCHAR(20) DEFAULT 'PENDIENTE',
            fecha_otorgamiento TIMESTAMP WITH TIME ZONE,
            fecha_revocacion TIMESTAMP WITH TIME ZONE,
            ramo VARCHAR(50) DEFAULT 'VIDA_HIPOTECARIO',
            canal VARCHAR(20) DEFAULT 'sms',
            contacto VARCHAR(120),
            contacto_mask VARCHAR(50),
            open_finance BOOLEAN DEFAULT TRUE,
            open_data BOOLEAN DEFAULT TRUE,
            codigo_hash VARCHAR(64) NOT NULL,
            codigo_demo VARCHAR(10) NOT NULL,
            asesor VARCHAR(120),
            solicitado_en TIMESTAMP WITH TIME ZONE NOT NULL,
            validado_en TIMESTAMP WITH TIME ZONE,
            expira_en TIMESTAMP WITH TIME ZONE NOT NULL
        );
        """)
        )

        clientes = [
            (
                "CLI-CC-1020304050",
                "CC",
                "1020304050",
                "María",
                "Rodríguez",
                "maria.rodriguez@email.com",
                "+57 300 123 4567",
                date(1986, 1, 1),
            ),
            (
                "CLI-CC-79800123",
                "CC",
                "79800123",
                "Carlos",
                "Méndez",
                "carlos.mendez@email.com",
                "+57 310 555 0101",
                date(1982, 5, 14),
            ),
            (
                "CLI-CC-52100300",
                "CC",
                "52100300",
                "Ana",
                "López",
                "ana.lopez@email.com",
                "+57 320 555 0102",
                date(1990, 9, 20),
            ),
            (
                "CLI-CC-80456789",
                "CC",
                "80456789",
                "Jorge",
                "Castillo",
                "jorge.castillo@email.com",
                "+57 315 555 0103",
                date(1988, 3, 10),
            ),
            (
                "CLI-CC-1098765432",
                "CC",
                "1098765432",
                "Luis",
                "Herrera",
                "luis.herrera@email.com",
                "+57 301 555 0104",
                date(1995, 11, 25),
            ),
        ]
        for c in clientes:
            conn.execute(
                text("""
                INSERT INTO clientes (id, tipo_documento, numero_documento, nombre, apellido, email, telefono, fecha_nacimiento)
                VALUES (:id, :td, :doc, :nom, :ape, :em, :tel, :fn)
                ON CONFLICT (id) DO UPDATE SET
                    nombre = EXCLUDED.nombre,
                    apellido = EXCLUDED.apellido,
                    telefono = EXCLUDED.telefono,
                    fecha_nacimiento = EXCLUDED.fecha_nacimiento;
                """),
                {"id": c[0], "td": c[1], "doc": c[2], "nom": c[3], "ape": c[4], "em": c[5], "tel": c[6], "fn": c[7]},
            )
            conn.execute(
                text("""
                INSERT INTO cuentas (cliente_id, password_hash, salt)
                VALUES (:cid, 'demo_hash_solventa_123', 'demo_salt')
                ON CONFLICT (cliente_id) DO NOTHING;
                """),
                {"cid": c[0]},
            )

        consentimientos = [
            (
                "consent-maria-1",
                "CLI-CC-1020304050",
                "Open Finance, Open Data",
                "SMS: +57 300 123 4567",
                "OTORGADO",
                datetime(2025, 11, 28, 10, 5, tzinfo=UTC),
                None,
                "VIDA_HIPOTECARIO",
                "sms",
                "+57 300 123 4567",
                "***4567",
                True,
                True,
                "hash-demo-1",
                "123456",
                "Ana Gómez",
                datetime(2025, 11, 28, 10, 0, tzinfo=UTC),
                datetime(2025, 11, 28, 10, 5, tzinfo=UTC),
                datetime(2026, 11, 28, 10, 5, tzinfo=UTC),
            ),
            (
                "consent-luis-1",
                "CLI-CC-1098765432",
                "Open Finance, Open Data",
                "SMS: +57 301 555 0104",
                "OTORGADO",
                datetime(2025, 11, 10, 9, 30, tzinfo=UTC),
                None,
                "PROTECCION_PAGOS",
                "sms",
                "+57 301 555 0104",
                "***0104",
                True,
                True,
                "hash-demo-2",
                "654321",
                "Carlos Asesor",
                datetime(2025, 11, 10, 9, 25, tzinfo=UTC),
                datetime(2025, 11, 10, 9, 30, tzinfo=UTC),
                datetime(2026, 11, 10, 9, 30, tzinfo=UTC),
            ),
        ]
        for cs in consentimientos:
            conn.execute(
                text("""
                INSERT INTO consentimientos (
                    id, cliente_id, alcance, fuente, estado, fecha_otorgamiento, fecha_revocacion, ramo,
                    canal, contacto, contacto_mask, open_finance, open_data, codigo_hash, codigo_demo,
                    asesor, solicitado_en, validado_en, expira_en
                )
                VALUES (
                    :id, :cid, :alc, :fuente, :est, :fo, :fr, :ramo, :canal, :cont, :cmask, :of, :od,
                    :ch, :cd, :asesor, :se, :ve, :ee
                )
                ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, validado_en = EXCLUDED.validado_en;
                """),
                {
                    "id": cs[0],
                    "cid": cs[1],
                    "alc": cs[2],
                    "fuente": cs[3],
                    "est": cs[4],
                    "fo": cs[5],
                    "fr": cs[6],
                    "ramo": cs[7],
                    "canal": cs[8],
                    "cont": cs[9],
                    "cmask": cs[10],
                    "of": cs[11],
                    "od": cs[12],
                    "ch": cs[13],
                    "cd": cs[14],
                    "asesor": cs[15],
                    "se": cs[16],
                    "ve": cs[17],
                    "ee": cs[18],
                },
            )
    print("  ✓ Clientes y Consentimientos insertados.")


def seed_polizas():
    print("-> Poblando base de datos 'polizas' (Póliza, Beneficiario, Endoso)...")
    engine = get_engine("polizas")
    with engine.begin() as conn:
        conn.execute(
            text("""
        CREATE TABLE IF NOT EXISTS polizas (
            id VARCHAR(36) PRIMARY KEY,
            numero VARCHAR(20) NOT NULL UNIQUE,
            estado VARCHAR(16) NOT NULL,
            cotizacion_id VARCHAR(64) NOT NULL UNIQUE,
            cobro_id VARCHAR(64) NOT NULL,
            producto_id VARCHAR(64) NOT NULL,
            prima NUMERIC(18, 2) NOT NULL,
            coberturas JSON NOT NULL,
            vigencia_desde DATE NOT NULL,
            vigencia_hasta DATE NOT NULL,
            canal VARCHAR(16) NOT NULL,
            socio_id VARCHAR(36),
            cliente_id VARCHAR(64),
            idempotency_key VARCHAR(255) NOT NULL UNIQUE,
            emitida_en TIMESTAMP WITH TIME ZONE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS beneficiarios (
            id VARCHAR(36) PRIMARY KEY,
            poliza_id VARCHAR(36) NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
            nombre VARCHAR(120) NOT NULL,
            parentesco VARCHAR(60) NOT NULL,
            porcentaje NUMERIC(5, 2) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS endosos (
            id VARCHAR(36) PRIMARY KEY,
            poliza_id VARCHAR(36) NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
            tipo VARCHAR(60) NOT NULL,
            fecha_efectiva DATE NOT NULL,
            prima_ajustada NUMERIC(18, 2),
            motivo VARCHAR(255) NOT NULL,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """)
        )

        # Pólizas oficiales con productos del catálogo
        polizas_data = [
            (
                "POL-00391",
                "SLV-2024-00391",
                "Activa",
                "COT-2025-00391",
                "PAY-10231",
                "vida-hipotecario",
                1280000.00,
                json.dumps(
                    [
                        {
                            "id": "hipotecario-fallecimiento",
                            "nombre": COB_FALLECIMIENTO_CREDITO,
                            "included": True,
                        }
                    ]
                ),
                date(2025, 12, 1),
                date(2026, 11, 30),
                "web",
                "socio-banco-aurora",
                "CLI-CC-1020304050",
                "idem-pol-00391",
                datetime(2025, 12, 1, 14, 0, tzinfo=UTC),
            ),
            (
                "POL-01820",
                "SLV-2025-01820",
                "Activa",
                "COT-2025-01820",
                "PAY-09877",
                "proteccion-celular",
                420000.00,
                json.dumps([{"id": "celular-dano-accidental", "nombre": COB_DANO_ACCIDENTAL, "included": True}]),
                date(2025, 10, 6),
                date(2026, 10, 5),
                "web",
                "socio-retail-pay",
                "CLI-CC-1020304050",
                "idem-pol-01820",
                datetime(2025, 10, 6, 11, 30, tzinfo=UTC),
            ),
            (
                "POL-00901",
                "SLV-2026-00901",
                "Vencida",
                "COT-2026-00901",
                "PAY-08711",
                "viaje-internacional",
                270000.00,
                json.dumps([{"id": "viaje-asistencia", "nombre": COB_ASISTENCIA_VIAJE, "included": True}]),
                date(2026, 4, 10),
                date(2026, 4, 24),
                "web",
                "socio-aerolinea-andina",
                "CLI-CC-79800123",
                "idem-pol-00901",
                datetime(2026, 4, 10, 8, 0, tzinfo=UTC),
            ),
            (
                "POL-00412",
                "SLV-2025-00412",
                "Cancelada",
                "COT-2025-00412",
                "PAY-07621",
                "vida-esencial",
                90000.00,
                json.dumps([{"id": "vida-esencial-fallecimiento", "nombre": "Fallecimiento", "included": True}]),
                date(2025, 2, 1),
                date(2026, 1, 31),
                "mobile",
                None,
                "CLI-CC-52100300",
                "idem-pol-00412",
                datetime(2025, 2, 1, 9, 0, tzinfo=UTC),
            ),
            (
                "POL-02210",
                "SLV-2026-02210",
                "Activa",
                "COT-2026-02210",
                "PAY-05510",
                "parametrico-clima-vuelo",
                60000.00,
                json.dumps([{"id": "parametrico-retraso-vuelo", "nombre": COB_RETRASO_VUELO, "included": True}]),
                date(2026, 8, 1),
                date(2026, 12, 31),
                "web",
                "socio-aerolinea-andina",
                "CLI-CC-80456789",
                "idem-pol-02210",
                datetime(2026, 8, 1, 10, 0, tzinfo=UTC),
            ),
            (
                "POL-03377",
                "SLV-2025-03377",
                "Activa",
                "COT-2025-03377",
                "PAY-04422",
                "proteccion-pagos",
                540000.00,
                json.dumps([{"id": "pagos-desempleo", "nombre": COB_DESEMPLEO_INVOLUNTARIO, "included": True}]),
                date(2025, 11, 15),
                date(2026, 11, 14),
                "web",
                "socio-banco-aurora",
                "CLI-CC-1098765432",
                "idem-pol-03377",
                datetime(2025, 11, 15, 15, 0, tzinfo=UTC),
            ),
        ]
        for pol in polizas_data:
            conn.execute(
                text("""
                INSERT INTO polizas (
                    id, numero, estado, cotizacion_id, cobro_id, producto_id, prima, coberturas,
                    vigencia_desde, vigencia_hasta, canal, socio_id, cliente_id, idempotency_key, emitida_en
                )
                VALUES (
                    :id, :num, :est, :cot_id, :cob_id, :prod_id, :prima, :cob,
                    :vd, :vh, :canal, :sid, :cid, :idem, :em
                )
                ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, producto_id = EXCLUDED.producto_id;
                """),
                {
                    "id": pol[0],
                    "num": pol[1],
                    "est": pol[2],
                    "cot_id": pol[3],
                    "cob_id": pol[4],
                    "prod_id": pol[5],
                    "prima": pol[6],
                    "cob": pol[7],
                    "vd": pol[8],
                    "vh": pol[9],
                    "canal": pol[10],
                    "sid": pol[11],
                    "cid": pol[12],
                    "idem": pol[13],
                    "em": pol[14],
                },
            )

        # Beneficiarios
        beneficiarios_data = [
            ("BEN-001", "POL-00391", "Banco Aurora (acreedor)", "Beneficiario oneroso", 80.0),
            ("BEN-002", "POL-00391", "Andrés Rodríguez", "Cónyuge", 20.0),
        ]
        for b in beneficiarios_data:
            conn.execute(
                text("""
                INSERT INTO beneficiarios (id, poliza_id, nombre, parentesco, porcentaje)
                VALUES (:id, :pid, :nom, :par, :porc)
                ON CONFLICT (id) DO UPDATE SET porcentaje = EXCLUDED.porcentaje;
                """),
                {"id": b[0], "pid": b[1], "nom": b[2], "par": b[3], "porc": b[4]},
            )

        # Endosos
        endosos_data = [
            (
                "END-2025-00412",
                "POL-00412",
                "Cancelación por retracto",
                date(2025, 2, 10),
                0.00,
                "Retracto dentro del término legal de 10 días",
            ),
            (
                "END-2026-03377",
                "POL-03377",
                "Modificación de datos de contacto",
                date(2026, 1, 15),
                540000.00,
                "Actualización de teléfono a solicitud del asegurado (+57 311 000 1122)",
            ),
        ]
        for ed in endosos_data:
            conn.execute(
                text("""
                INSERT INTO endosos (id, poliza_id, tipo, fecha_efectiva, prima_ajustada, motivo)
                VALUES (:id, :pid, :tipo, :fe, :pa, :motivo)
                ON CONFLICT (id) DO UPDATE SET motivo = EXCLUDED.motivo;
                """),
                {"id": ed[0], "pid": ed[1], "tipo": ed[2], "fe": ed[3], "pa": ed[4], "motivo": ed[5]},
            )
    print("  ✓ Pólizas, Beneficiarios y Endosos insertados.")


def seed_pagos():
    print("-> Poblando base de datos 'pagos' (Cobro / Pago)...")
    engine = get_engine("pagos")
    with engine.begin() as conn:
        conn.execute(
            text("""
        CREATE TABLE IF NOT EXISTS cobros (
            id VARCHAR(36) PRIMARY KEY,
            cotizacion_id VARCHAR(64) NOT NULL,
            cliente_id VARCHAR(64) NOT NULL,
            monto NUMERIC(18, 2) NOT NULL,
            moneda VARCHAR(3) NOT NULL,
            estado VARCHAR(16) NOT NULL,
            idempotency_key VARCHAR(255) NOT NULL UNIQUE,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS pagos (
            id VARCHAR(36) PRIMARY KEY,
            poliza_id VARCHAR(36),
            siniestro_id VARCHAR(36),
            tipo VARCHAR(32) NOT NULL,
            monto NUMERIC(18, 2) NOT NULL,
            medio VARCHAR(64) NOT NULL,
            estado VARCHAR(32) NOT NULL,
            clave_idempotencia VARCHAR(255) UNIQUE NOT NULL,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """)
        )

        cobros_data = [
            ("PAY-10231", "COT-2025-00391", "CLI-CC-1020304050", 1280000.00, "COP", "aprobado", "idem-cobro-10231"),
            ("PAY-09877", "COT-2025-01820", "CLI-CC-1020304050", 420000.00, "COP", "aprobado", "idem-cobro-09877"),
            ("PAY-08711", "COT-2026-00901", "CLI-CC-79800123", 270000.00, "COP", "aprobado", "idem-cobro-08711"),
            ("PAY-07621", "COT-2025-00412", "CLI-CC-52100300", 90000.00, "COP", "aprobado", "idem-cobro-07621"),
            ("PAY-05510", "COT-2026-02210", "CLI-CC-80456789", 60000.00, "COP", "aprobado", "idem-cobro-05510"),
            ("PAY-04422", "COT-2025-03377", "CLI-CC-1098765432", 540000.00, "COP", "aprobado", "idem-cobro-04422"),
        ]
        for cb in cobros_data:
            conn.execute(
                text("""
                INSERT INTO cobros (id, cotizacion_id, cliente_id, monto, moneda, estado, idempotency_key)
                VALUES (:id, :cot_id, :cid, :monto, :mon, :est, :idem)
                ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado;
                """),
                {"id": cb[0], "cot_id": cb[1], "cid": cb[2], "monto": cb[3], "mon": cb[4], "est": cb[5], "idem": cb[6]},
            )

        pagos_vc002 = [
            ("PAY-10231", "POL-00391", None, "Prima", 1280000.00, "Débito automático", "Aprobado", "idem-pay-10231"),
            ("PAY-09877", "POL-01820", None, "Prima", 420000.00, "Tarjeta de crédito", "Aprobado", "idem-pay-09877"),
            ("PAY-08711", "POL-00901", None, "Prima", 270000.00, "PSE", "Aprobado", "idem-pay-08711"),
            ("PAY-07621", "POL-00412", None, "Prima", 90000.00, "Nequi", "Aprobado", "idem-pay-07621"),
            (
                "DEV-00412",
                "POL-00412",
                None,
                "Devolución",
                90000.00,
                "Transferencia bancaria",
                "Aprobado",
                "idem-dev-00412",
            ),
            ("PAY-05510", "POL-02210", None, "Prima", 60000.00, "Millas / Tarjeta", "Aprobado", "idem-pay-05510"),
            (
                "IND-02210",
                "POL-02210",
                "SIN-PARAM-01",
                "Indemnización",
                600000.00,
                "Abono a cuenta bancaria",
                "Aprobado",
                "idem-ind-02210",
            ),
            ("PAY-04422", "POL-03377", None, "Prima", 540000.00, "Débito automático", "Aprobado", "idem-pay-04422"),
        ]
        for pg in pagos_vc002:
            conn.execute(
                text("""
                INSERT INTO pagos (id, poliza_id, siniestro_id, tipo, monto, medio, estado, clave_idempotencia)
                VALUES (:id, :pid, :sid, :tipo, :monto, :medio, :est, :idem)
                ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado;
                """),
                {
                    "id": pg[0],
                    "pid": pg[1],
                    "sid": pg[2],
                    "tipo": pg[3],
                    "monto": pg[4],
                    "medio": pg[5],
                    "est": pg[6],
                    "idem": pg[7],
                },
            )
    print("  ✓ Cobros y Pagos insertados.")


def seed_siniestros():
    print("-> Poblando base de datos 'siniestros' (Siniestro / Aviso)...")
    engine = get_engine("siniestros")
    with engine.begin() as conn:
        conn.execute(
            text("""
        CREATE TABLE IF NOT EXISTS avisos (
            id VARCHAR(64) PRIMARY KEY,
            cliente_id VARCHAR(64) NOT NULL,
            poliza_id VARCHAR(64) NOT NULL,
            tipo VARCHAR(64) NOT NULL,
            ocurrido_en TIMESTAMP WITH TIME ZONE NOT NULL,
            descripcion TEXT NOT NULL,
            ubicacion VARCHAR(255),
            estado VARCHAR(32) NOT NULL,
            radicado VARCHAR(16) UNIQUE,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS evidencias (
            id VARCHAR(64) PRIMARY KEY,
            aviso_id VARCHAR(64) NOT NULL,
            object_key VARCHAR(512) NOT NULL,
            url VARCHAR(1024) NOT NULL,
            content_type VARCHAR(64) NOT NULL,
            bytes INTEGER NOT NULL,
            estado VARCHAR(32) NOT NULL,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """)
        )

        avisos_data = [
            (
                "SIN-4412",
                "CLI-CC-1020304050",
                "POL-01820",
                COB_DANO_ACCIDENTAL,
                datetime(2026, 3, 2, 8, 30, tzinfo=UTC),
                "Caída accidental del celular con fractura de pantalla",
                "Bogotá, Colombia",
                "radicado",
                "RAD-2026-004412",
            ),
            (
                "SIN-PARAM-01",
                "CLI-CC-80456789",
                "POL-02210",
                COB_RETRASO_VUELO,
                datetime(2026, 9, 15, 17, 0, tzinfo=UTC),
                "Disparador paramétrico automático: Retraso de vuelo AV-9345 mayor a 2 horas reportado por FlightAware",
                "Aeropuerto El Dorado, Bogotá",
                "radicado",
                "RAD-2026-009345",
            ),
        ]
        for av in avisos_data:
            conn.execute(
                text("""
                INSERT INTO avisos (id, cliente_id, poliza_id, tipo, ocurrido_en, descripcion, ubicacion, estado, radicado)
                VALUES (:id, :cid, :pid, :tipo, :oe, :desc, :ub, :est, :rad)
                ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado;
                """),
                {
                    "id": av[0],
                    "cid": av[1],
                    "pid": av[2],
                    "tipo": av[3],
                    "oe": av[4],
                    "desc": av[5],
                    "ub": av[6],
                    "est": av[7],
                    "rad": av[8],
                },
            )

        # Sincronización vía HTTP si el servicio siniestros corre en modo in-memory
        try:
            import urllib.request

            for av in avisos_data:
                payload = json.dumps(
                    {
                        "cliente_id": av[1],
                        "poliza_id": av[2],
                        "tipo": av[3],
                        "ocurrido_en": av[4].isoformat(),
                        "descripcion": av[5],
                        "ubicacion": av[6],
                    }
                ).encode("utf-8")
                req = urllib.request.Request(
                    "http://localhost:8001/siniestros/avisos",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                )
                urllib.request.urlopen(req, timeout=1.0)
        except Exception:
            pass
    print("  ✓ Siniestros (Avisos) insertados.")


def main():
    print(BANNER_SEPARATOR)
    print("Iniciando carga de datos congruentes en bases de datos PostgreSQL")
    print(BANNER_SEPARATOR)
    seed_identidad()
    seed_catalogo_y_cotizacion()
    seed_polizas()
    seed_pagos()
    seed_siniestros()
    print(BANNER_SEPARATOR)
    print("¡Base de datos poblada exitosamente y 100% congruente!")
    print(BANNER_SEPARATOR)


if __name__ == "__main__":
    main()
