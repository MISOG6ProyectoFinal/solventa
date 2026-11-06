from sqlalchemy import Boolean, Column, DateTime, Index, String, Table, insert, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from identidad.kyc.adapters.repository import metadata
from identidad.operadores.domain.models import EmailTaken, Operator

operators = Table(
    "operadores",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("correo", String(254), nullable=False),
    Column("nombre", String(120), nullable=False),
    Column("roles", String(120), nullable=False),
    Column("password_hash", String(64), nullable=False),
    Column("salt", String(32), nullable=False),
    Column("activo", Boolean, nullable=False, default=True),
    Column("creado_en", DateTime(timezone=True), nullable=False),
    Index("uq_operadores_correo", "correo", unique=True),
)


def _operator(row) -> Operator:
    return Operator(
        id=row["id"],
        correo=row["correo"],
        nombre=row["nombre"],
        roles=[role for role in row["roles"].split(",") if role],
        password_hash=row["password_hash"],
        salt=row["salt"],
        activo=row["activo"],
        creado_en=row["creado_en"],
    )


def _values(operator: Operator) -> dict:
    return {
        "correo": operator.correo,
        "nombre": operator.nombre,
        "roles": ",".join(operator.roles),
        "password_hash": operator.password_hash,
        "salt": operator.salt,
        "activo": operator.activo,
        "creado_en": operator.creado_en,
    }


class PostgresOperatorRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine, tables=[operators])

    def add(self, operator: Operator) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(operators).values(id=operator.id, **_values(operator)))
        except IntegrityError as exc:
            raise EmailTaken(operator.correo) from exc

    def get(self, operator_id: str) -> Operator | None:
        return self._first(operators.c.id == operator_id)

    def get_by_email(self, email: str) -> Operator | None:
        return self._first(operators.c.correo == email.lower())

    def list(self) -> list[Operator]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(operators).order_by(operators.c.creado_en, operators.c.id)).mappings().all()
        return [_operator(row) for row in rows]

    def update(self, operator: Operator) -> None:
        with self.engine.begin() as conn:
            conn.execute(update(operators).where(operators.c.id == operator.id).values(**_values(operator)))

    def _first(self, condition) -> Operator | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(operators).where(condition)).mappings().first()
        return _operator(row) if row else None


class InMemoryOperatorRepository:
    def __init__(self) -> None:
        self.operators_by_id: dict[str, Operator] = {}

    def create_schema(self) -> None:
        pass

    def add(self, operator: Operator) -> None:
        if self.get_by_email(operator.correo) is not None:
            raise EmailTaken(operator.correo)
        self.operators_by_id[operator.id] = operator.model_copy()

    def get(self, operator_id: str) -> Operator | None:
        operator = self.operators_by_id.get(operator_id)
        return operator.model_copy() if operator else None

    def get_by_email(self, email: str) -> Operator | None:
        for operator in self.operators_by_id.values():
            if operator.correo == email.lower():
                return operator.model_copy()
        return None

    def list(self) -> list[Operator]:
        ordered = sorted(self.operators_by_id.values(), key=lambda operator: operator.creado_en)
        return [operator.model_copy() for operator in ordered]

    def update(self, operator: Operator) -> None:
        self.operators_by_id[operator.id] = operator.model_copy()
