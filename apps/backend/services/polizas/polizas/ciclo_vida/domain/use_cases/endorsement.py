"""Endoso de datos del asegurado."""

from collections.abc import Callable
from datetime import date

from solventa_common.events import Event, EventPublisher

from polizas.ciclo_vida.domain.models import (
    Endorsement,
    EndorsementRequest,
    InsuredData,
    PolicyStatus,
)
from polizas.ciclo_vida.domain.ports import (
    InvalidEndorsement,
    PolicyNotEndorsable,
    PolicyNotFound,
    PolicyRepository,
)
from polizas.ciclo_vida.domain.use_cases.common import (
    POLIZA_ENDOSADA,
    SOURCE,
    _today,
    publish_pending,
)


class RegisterEndorsementUseCase:
    """Endoso de datos del asegurado: guarda versión anterior y nueva en Pólizas y publica el evento de auditoría."""

    def __init__(
        self, policies: PolicyRepository, publisher: EventPublisher, today: Callable[[], date] | None = None
    ) -> None:
        self.policies = policies
        self.publisher = publisher
        self.today = today or _today

    def execute(self, poliza_id: str, request: EndorsementRequest) -> Endorsement:
        self.policies.expire_ended(self.today())
        policy = self.policies.get(poliza_id)
        if policy is None:
            raise PolicyNotFound(poliza_id)
        if policy.estado is not PolicyStatus.ACTIVE:
            raise PolicyNotEndorsable(poliza_id)
        if not policy.vigencia.desde <= request.fecha_efectiva <= policy.vigencia.hasta:
            raise InvalidEndorsement(
                "fecha_efectiva_fuera_de_vigencia", "La fecha efectiva debe estar dentro de la vigencia de la póliza."
            )
        previous = self.current_insured(policy.id) or request.datos_identidad
        if request.version_nueva == previous:
            raise InvalidEndorsement("endoso_sin_cambios", "El endoso debe cambiar al menos un dato del asegurado.")
        endorsement = Endorsement(
            poliza_id=policy.id,
            fecha_efectiva=request.fecha_efectiva,
            motivo=request.motivo,
            usuario_id=request.usuario_id,
            version_anterior=previous.model_dump(),
            version_nueva=request.version_nueva.model_dump(),
        )
        self.policies.save_endorsement(endorsement, _endorsement_event(endorsement))
        publish_pending(self.policies, self.publisher)
        return endorsement

    def list(self, poliza_id: str) -> list[Endorsement]:
        if self.policies.get(poliza_id) is None:
            raise PolicyNotFound(poliza_id)
        return self.policies.list_endorsements(poliza_id)

    def current_insured(self, poliza_id: str) -> InsuredData | None:
        """El último endoso gana sobre Identidad, que un endoso nunca modifica."""
        endorsements = sorted(self.policies.list_endorsements(poliza_id), key=lambda item: item.creado_en)
        latest = next((item.version_nueva for item in reversed(endorsements) if item.version_nueva), None)
        return InsuredData(**latest) if latest else None


def _endorsement_event(endorsement: Endorsement) -> Event:
    return Event(
        event_type=POLIZA_ENDOSADA,
        source=SOURCE,
        idempotency_key=f"{POLIZA_ENDOSADA}:{endorsement.id}",
        occurred_at=endorsement.creado_en,
        payload={
            "poliza_id": endorsement.poliza_id,
            "endoso_id": endorsement.id,
            "tipo": endorsement.tipo,
            "usuario_id": endorsement.usuario_id,
            "fecha_efectiva": endorsement.fecha_efectiva.isoformat(),
            "motivo": endorsement.motivo,
            "version_anterior": endorsement.version_anterior,
            "version_nueva": endorsement.version_nueva,
        },
    )
