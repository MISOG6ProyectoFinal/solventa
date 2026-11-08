"""Doble de un cliente HTTP interno. Registra la llamada y devuelve la respuesta o el error inyectado."""


class Servicio:
    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[tuple] = []

    def _call(self, method: str, path: str, **kwargs):
        self.calls.append((method, path, kwargs))
        if self.error:
            raise self.error
        return self.response

    def get(self, path: str, **kwargs):
        return self._call("GET", path, **kwargs)

    def post(self, path: str, **kwargs):
        return self._call("POST", path, **kwargs)

    def put(self, path: str, **kwargs):
        return self._call("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs):
        return self._call("PATCH", path, **kwargs)
