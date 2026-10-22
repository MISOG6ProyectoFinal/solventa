import math

URBAN_SPEED_KMH = 25
DISPATCH_MIN = 5


def estimate_eta_min(distancia_km: float) -> int:
    """There is no routing or availability data, so this is travel at urban speed plus dispatch time."""
    return math.ceil(distancia_km / URBAN_SPEED_KMH * 60) + DISPATCH_MIN
