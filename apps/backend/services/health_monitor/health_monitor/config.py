from solventa_common.settings import ServiceSettings


class HealthMonitorSettings(ServiceSettings):
    service_name: str = "health-monitor"
    # Lista separada por comas de servicios a sondear (nombre del Service de Kubernetes).
    health_targets: str = ""
    heartbeat_interval_s: float = 0.5
    heartbeat_timeout_s: float = 0.4
    fallas_para_retiro: int = 2

    @property
    def targets(self) -> list[str]:
        return [t.strip() for t in self.health_targets.split(",") if t.strip()]


settings = HealthMonitorSettings()
