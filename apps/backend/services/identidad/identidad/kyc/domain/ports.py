from typing import Protocol

from identidad.kyc.domain.models import Client


class ClientRepository(Protocol):
    def get_by_email(self, email: str) -> Client | None: ...

    def add(self, client: Client) -> None: ...
