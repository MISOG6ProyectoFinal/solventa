from solventa_common.settings import ServiceSettings


class SimuladoresSettings(ServiceSettings):
    service_name: str = "simuladores"
    demora_lento_s: float = 2.0


settings = SimuladoresSettings()
