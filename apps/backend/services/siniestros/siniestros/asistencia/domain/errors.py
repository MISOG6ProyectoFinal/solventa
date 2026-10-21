MSG_AVISO = "No se encontró el reporte."
MSG_BORRADOR = "Radica el siniestro antes de solicitar asistencia."
MSG_DUPLICADA = "Ya solicitaste asistencia para este siniestro."
MSG_NUMERO = "No se pudo asignar un número de solicitud."


class ReglaAsistencia(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
