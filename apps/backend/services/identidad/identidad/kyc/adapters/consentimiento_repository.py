from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    MetaData,
    String,
    Table,
    insert,
    select,
    text,
    update,
)
from sqlalchemy.engine import Engine

from identidad.kyc.domain.models import Consentimiento

metadata = MetaData()

consentimientos_table = Table(
    "consentimientos",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("cliente_id", String(50), nullable=False),
    Column("alcance", String(254), nullable=True),
    Column("fuente", String(120), nullable=True),
    Column("estado", String(20), nullable=False, default="PENDIENTE"),
    Column("fecha_otorgamiento", DateTime(timezone=True), nullable=True),
    Column("fecha_revocacion", DateTime(timezone=True), nullable=True),
    Column("ramo", String(50), nullable=True, default="VIDA_HIPOTECARIO"),
    Column("canal", String(20), nullable=True, default="sms"),
    Column("contacto", String(120), nullable=True),
    Column("contacto_mask", String(50), nullable=True),
    Column("open_finance", Boolean, nullable=False, default=True),
    Column("open_data", Boolean, nullable=False, default=True),
    Column("codigo_hash", String(64), nullable=False),
    Column("codigo_demo", String(10), nullable=False),
    Column("asesor", String(120), nullable=True),
    Column("solicitado_en", DateTime(timezone=True), nullable=False),
    Column("validado_en", DateTime(timezone=True), nullable=True),
    Column("expira_en", DateTime(timezone=True), nullable=False),
)


def _parse_alcance(row) -> list[str]:
    alcance_val = row.get("alcance")
    if alcance_val:
        return [a.strip() for a in alcance_val.split(",") if a.strip()]
    alcance_list = []
    if row.get("open_finance"):
        alcance_list.append("Open Finance")
    if row.get("open_data"):
        alcance_list.append("Open Data")
    return alcance_list or ["Open Finance", "Open Data"]


def _resolve_fuente_from_row(row) -> str:
    if row.get("fuente"):
        return str(row["fuente"])
    canal_label = "SMS" if row.get("canal") == "sms" else "Correo"
    dest = row.get("contacto") or row.get("contacto_mask") or ""
    return f"{canal_label}: {dest}"


def _to_model(row) -> Consentimiento:
    alcance_list = _parse_alcance(row)
    fuente_val = _resolve_fuente_from_row(row)
    fecha_otorgamiento = row.get("fecha_otorgamiento") or row.get("validado_en")

    return Consentimiento(
        id=row["id"],
        cliente_id=row["cliente_id"],
        alcance=alcance_list,
        fuente=fuente_val,
        estado=row["estado"],
        fecha_otorgamiento=fecha_otorgamiento,
        fecha_revocacion=row.get("fecha_revocacion"),
        ramo=row.get("ramo") or "VIDA_HIPOTECARIO",
        canal=row.get("canal") or "sms",
        contacto=row.get("contacto") or "",
        contacto_mask=row.get("contacto_mask") or "",
        open_finance=row.get("open_finance", True),
        open_data=row.get("open_data", True),
        codigo_hash=row["codigo_hash"],
        codigo_demo=row["codigo_demo"],
        asesor=row.get("asesor") or "",
        solicitado_en=row["solicitado_en"],
        validado_en=fecha_otorgamiento,
        expira_en=row["expira_en"],
    )


class PostgresConsentimientoRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)
        try:
            with self.engine.begin() as conn:
                conn.execute(text("ALTER TABLE consentimientos ADD COLUMN IF NOT EXISTS contacto VARCHAR(120);"))
                conn.execute(text("ALTER TABLE consentimientos ADD COLUMN IF NOT EXISTS fuente VARCHAR(120);"))
                conn.execute(text("ALTER TABLE consentimientos ADD COLUMN IF NOT EXISTS alcance VARCHAR(254);"))
                conn.execute(
                    text("ALTER TABLE consentimientos ADD COLUMN IF NOT EXISTS fecha_otorgamiento TIMESTAMPTZ;")
                )
                conn.execute(text("ALTER TABLE consentimientos ADD COLUMN IF NOT EXISTS fecha_revocacion TIMESTAMPTZ;"))
        except Exception:
            pass

    def add(self, consentimiento: Consentimiento) -> None:
        with self.engine.begin() as conn:
            alcance_str = ", ".join(consentimiento.alcance) if consentimiento.alcance else "Open Finance, Open Data"
            canal_tipo = "SMS" if consentimiento.canal == "sms" else "Correo"
            contacto_destino = consentimiento.contacto or consentimiento.contacto_mask
            fuente_val = consentimiento.fuente or f"{canal_tipo}: {contacto_destino}"

            conn.execute(
                insert(consentimientos_table).values(
                    id=consentimiento.id,
                    cliente_id=consentimiento.cliente_id,
                    alcance=alcance_str,
                    fuente=fuente_val,
                    estado=consentimiento.estado,
                    fecha_otorgamiento=consentimiento.fecha_otorgamiento,
                    fecha_revocacion=consentimiento.fecha_revocacion,
                    ramo=consentimiento.ramo,
                    canal=consentimiento.canal,
                    contacto=consentimiento.contacto,
                    contacto_mask=consentimiento.contacto_mask,
                    open_finance=consentimiento.open_finance,
                    open_data=consentimiento.open_data,
                    codigo_hash=consentimiento.codigo_hash,
                    codigo_demo=consentimiento.codigo_demo,
                    asesor=consentimiento.asesor,
                    solicitado_en=consentimiento.solicitado_en,
                    validado_en=consentimiento.validado_en or consentimiento.fecha_otorgamiento,
                    expira_en=consentimiento.expira_en,
                )
            )

    def get(self, consentimiento_id: str) -> Consentimiento | None:
        with self.engine.connect() as conn:
            row = (
                conn.execute(select(consentimientos_table).where(consentimientos_table.c.id == consentimiento_id))
                .mappings()
                .first()
            )
        return _to_model(row) if row else None

    def update(self, consentimiento: Consentimiento) -> None:
        alcance_str = ", ".join(consentimiento.alcance) if consentimiento.alcance else "Open Finance, Open Data"
        canal_tipo = "SMS" if consentimiento.canal == "sms" else "Correo"
        contacto_destino = consentimiento.contacto or consentimiento.contacto_mask
        fuente_val = consentimiento.fuente or f"{canal_tipo}: {contacto_destino}"
        with self.engine.begin() as conn:
            conn.execute(
                update(consentimientos_table)
                .where(consentimientos_table.c.id == consentimiento.id)
                .values(
                    estado=consentimiento.estado,
                    contacto=consentimiento.contacto,
                    contacto_mask=consentimiento.contacto_mask,
                    fuente=fuente_val,
                    alcance=alcance_str,
                    fecha_otorgamiento=consentimiento.fecha_otorgamiento,
                    fecha_revocacion=consentimiento.fecha_revocacion,
                    validado_en=consentimiento.validado_en or consentimiento.fecha_otorgamiento,
                    open_finance=consentimiento.open_finance,
                    open_data=consentimiento.open_data,
                )
            )


class InMemoryConsentimientoRepository:
    def __init__(self) -> None:
        self._items: dict[str, Consentimiento] = {}

    def create_schema(self) -> None:
        # Repositorio en memoria no requiere crear esquemas relacionales DDL
        pass

    def add(self, consentimiento: Consentimiento) -> None:
        self._items[consentimiento.id] = consentimiento

    def get(self, consentimiento_id: str) -> Consentimiento | None:
        return self._items.get(consentimiento_id)

    def update(self, consentimiento: Consentimiento) -> None:
        if consentimiento.id in self._items:
            self._items[consentimiento.id] = consentimiento
