"""Identidad técnica del ciclo de renovación. No es un dato visible ni lo envía el teléfono."""


def referencia_ciclo_renovacion(poliza_id: str, vigencia_propuesta: dict) -> str:
    desde = str(vigencia_propuesta["desde"])
    hasta = str(vigencia_propuesta["hasta"])
    return f"{poliza_id}:{desde}:{hasta}"
