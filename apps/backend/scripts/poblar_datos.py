"""Puebla un ambiente de Solventa con datos de prueba coherentes a través de la API pública de Canales.

    python scripts/poblar_datos.py                                  # modo local (http://localhost:8000)
    python scripts/poblar_datos.py https://dzwq94g5om86y.cloudfront.net

Crea socios con sus ramos habilitados, clientes con sesión, cotizaciones por los tres canales y avisos
de siniestro con evidencia. Es idempotente: las credenciales que solo se entregan una vez (secreto de
cada socio y contraseña de cada cliente) se guardan en scripts/.poblar/<host>.json, fuera de git, y se
reutilizan en las siguientes corridas.
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from secrets import token_urlsafe
from urllib.parse import urlparse

URL_LOCAL = "http://localhost:8000"
EVIDENCIA = Path(__file__).resolve().parents[1] / "load-tests" / "fixtures" / "evidencia.png"
CREDENCIALES = Path(__file__).resolve().parent / ".poblar"
OPERADOR = "Ana Gómez"

SOCIOS = [
    {
        "nombre": "Banco Aurora",
        "identificador": "BANCO-AURORA",
        "tipo": "Banco",
        "correo_contacto": "alianzas@bancoaurora.test",
        "alcances": ["cotizacion", "emision", "consulta"],
        "ramos": ["ramo-vida-hipotecario", "ramo-microseguro-vida", "ramo-proteccion-pagos"],
    },
    {
        "nombre": "AeroAndes",
        "identificador": "AEROANDES",
        "tipo": "Aerolínea",
        "correo_contacto": "seguros@aeroandes.test",
        "alcances": ["cotizacion", "emision"],
        "ramos": ["ramo-viaje", "ramo-parametrico"],
    },
    {
        "nombre": "MercaYa",
        "identificador": "MERCAYA",
        "tipo": "E-commerce",
        "correo_contacto": "partners@mercaya.test",
        "alcances": ["cotizacion"],
        "ramos": ["ramo-dispositivos", "ramo-proteccion-pagos"],
    },
    {
        "nombre": "PagoFácil",
        "identificador": "PAGOFACIL",
        "tipo": "Fintech",
        "correo_contacto": "producto@pagofacil.test",
        "alcances": ["cotizacion", "consulta"],
        "ramos": ["ramo-microseguro-vida", "ramo-proteccion-pagos"],
    },
    {
        "nombre": "Almacenes Éxodo",
        "identificador": "ALMACENES-EXODO",
        "tipo": "Retailer",
        "correo_contacto": "seguros@exodo.test",
        "alcances": ["cotizacion", "emision"],
        "ramos": ["ramo-dispositivos", "ramo-viaje"],
    },
]

CLIENTES = [
    ("Laura", "Martínez", "Estados Unidos"),
    ("Andrés", "Rodríguez", "España"),
    ("Camila", "Gómez", "México"),
    ("Santiago", "López", "Otro país"),
    ("Valentina", "Hernández", "España"),
    ("Mateo", "Díaz", "Estados Unidos"),
    ("Isabella", "Torres", "México"),
    ("Sebastián", "Ramírez", "España"),
    ("Mariana", "Castro", "Otro país"),
    ("Daniel", "Moreno", "Estados Unidos"),
    ("Sofía", "Vargas", "México"),
    ("Nicolás", "Rojas", "España"),
]

SINIESTROS = [
    ("Accidente con vehículo de alquiler", "Golpe en la puerta trasera al parquear", "Calle 85 #12-34, Bogotá"),
    ("Pérdida de equipaje", "La maleta no llegó en la conexión", "Aeropuerto El Dorado, Bogotá"),
    ("Gastos médicos en el exterior", "Atención de urgencias por intoxicación", "Hospital del Mar, Barcelona"),
    ("Daño accidental del celular", "Pantalla rota por caída", "Carrera 7 #45-10, Bogotá"),
]

PRODUCTO_POR_RAMO = {
    "ramo-viaje": "viaje-internacional",
    "ramo-microseguro-vida": "vida-esencial",
    "ramo-vida-hipotecario": "vida-hipotecario",
    "ramo-parametrico": "parametrico-clima-vuelo",
    "ramo-dispositivos": "proteccion-celular",
    "ramo-proteccion-pagos": "proteccion-pagos",
}

CON_TARIFA = {"viaje-internacional", "vida-esencial", "vida-hipotecario", "parametrico-clima-vuelo"}


class ErrorApi(Exception):
    def __init__(self, estado: int, cuerpo: str) -> None:
        super().__init__(f"{estado}: {cuerpo[:300]}")
        self.estado = estado
        self.cuerpo = cuerpo


class Api:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")

    def pedir(self, metodo: str, ruta: str, cuerpo=None, token: str | None = None, cabeceras=None):
        datos = None if cuerpo is None else json.dumps(cuerpo).encode()
        solicitud = urllib.request.Request(self.base + ruta, data=datos, method=metodo)
        solicitud.add_header("Content-Type", "application/json")
        if token:
            solicitud.add_header("Authorization", f"Bearer {token}")
        for clave, valor in (cabeceras or {}).items():
            solicitud.add_header(clave, valor)
        try:
            with urllib.request.urlopen(solicitud, timeout=30) as respuesta:
                contenido = respuesta.read()
        except urllib.error.HTTPError as error:
            raise ErrorApi(error.code, error.read().decode(errors="replace")) from error
        return json.loads(contenido) if contenido else None


def dia(desplazamiento: int) -> str:
    return (date.today() + timedelta(days=desplazamiento)).isoformat()


def solicitud_por_producto(producto_id: str, indice: int) -> dict:
    if producto_id == "viaje-internacional":
        destino = ["Estados Unidos", "España", "México", "Otro país"][indice % 4]
        return {
            "producto_id": producto_id,
            "destino": destino,
            "fecha_salida": dia(20 + indice * 3),
            "fecha_regreso": dia(30 + indice * 3),
            "viajeros": 1 + indice % 3,
        }
    if producto_id == "vida-esencial":
        return {
            "producto_id": producto_id,
            "fecha_nacimiento": f"{1975 + indice * 3}-0{1 + indice % 9}-15",
            "suma_asegurada": str(20_000_000 + indice * 5_000_000),
            "beneficiario": ["María Pérez", "Juan Pérez", "Rosa Pérez", "Luis Pérez"][indice % 4],
            "parentesco": ["Cónyuge", "Hijo(a)", "Padre / Madre", "Otro"][indice % 4],
        }
    if producto_id == "vida-hipotecario":
        return {
            "producto_id": producto_id,
            "fecha_nacimiento": f"{1980 + indice * 2}-0{1 + indice % 9}-10",
            "entidad": "Banco Aurora",
            "valor_credito": str(150_000_000 + indice * 25_000_000),
            "plazo_anios": [10, 15, 20, 30][indice % 4],
        }
    if producto_id == "parametrico-clima-vuelo":
        return {
            "producto_id": producto_id,
            "evento": ["Retraso de vuelo", "Lluvia excesiva"][indice % 2],
            "referencia": [f"AV9{indice:03d}", f"BOG-ZONA-{indice}"][indice % 2],
            "fecha_evento": dia(10 + indice),
            "valor_indemnizar": str(300_000 + indice * 100_000),
        }
    return {
        "producto_id": producto_id,
        "suma_asegurada": str(2_000_000 + indice * 500_000),
        "edad": 25 + indice * 4,
    }


def cargar_credenciales(archivo: Path) -> dict:
    if archivo.exists():
        return json.loads(archivo.read_text())
    return {"socios": {}, "clientes": {}}


def guardar_credenciales(archivo: Path, credenciales: dict) -> None:
    archivo.parent.mkdir(exist_ok=True)
    archivo.write_text(json.dumps(credenciales, indent=2, ensure_ascii=False))
    archivo.chmod(0o600)


def poblar_socios(api: Api, credenciales: dict, conteo: dict) -> None:
    for socio in SOCIOS:
        alta = {k: v for k, v in socio.items() if k != "ramos"} | {"pais": "Colombia", "autorizado_por": OPERADOR}
        guardado = credenciales["socios"].get(socio["identificador"])
        try:
            creado = api.pedir("POST", "/web/socios", alta)
            guardado = {"id": creado["id"], "client_id": creado["client_id"], "secreto": creado["secreto"]}
            credenciales["socios"][socio["identificador"]] = guardado
            conteo["socios creados"] += 1
        except ErrorApi as error:
            if error.estado != 409:
                raise
            if guardado is None:
                socios = api.pedir("GET", "/web/socios")
                existente = next(s for s in socios if s["identificador"] == socio["identificador"])
                guardado = {"id": existente["id"], "client_id": existente["client_id"], "secreto": None}
                credenciales["socios"][socio["identificador"]] = guardado
            conteo["socios existentes"] += 1

        configuracion = api.pedir("GET", f"/web/socios/{guardado['id']}/configuracion")
        ramos = [
            {"ramo_id": ramo["id"], "coberturas": [c["id"] for c in ramo["coberturas"]]}
            for ramo in configuracion["ramos"]
            if ramo["id"] in socio["ramos"]
        ]
        api.pedir(
            "PUT",
            f"/web/socios/{guardado['id']}/configuracion",
            {"ramos": ramos, "actualizado_por": OPERADOR},
        )

        if not guardado.get("secreto"):
            print(f"  {socio['nombre']}: sin secreto guardado, no cotiza por la API de socios")
            continue
        cotizables = [PRODUCTO_POR_RAMO[ramo] for ramo in socio["ramos"] if PRODUCTO_POR_RAMO[ramo] in CON_TARIFA]
        for indice, producto_id in enumerate(cotizables):
            api.pedir(
                "POST",
                "/socios/v1/cotizaciones",
                solicitud_por_producto(producto_id, indice),
                cabeceras={"X-Client-Id": guardado["client_id"], "X-Api-Key": guardado["secreto"]},
            )
            conteo["cotizaciones de socios"] += 1


def sesion_de_cliente(api: Api, credenciales: dict, nombre: str, apellido: str, conteo: dict) -> str:
    correo = f"{nombre.lower()}.{apellido.lower()}@solventa.test".translate(str.maketrans("áéíóú", "aeiou"))
    contrasena = credenciales["clientes"].get(correo)
    if contrasena is None:
        contrasena = token_urlsafe(12)
        try:
            cuenta = api.pedir(
                "POST",
                "/movil/registros",
                {"correo": correo, "contrasena": contrasena, "nombre": nombre, "apellido": apellido},
            )
            credenciales["clientes"][correo] = contrasena
            conteo["clientes creados"] += 1
            return cuenta["token"]
        except ErrorApi as error:
            if error.estado != 409:
                raise
            print(f"  {correo}: ya existía sin contraseña guardada, se omite")
            return ""
    conteo["clientes existentes"] += 1
    return api.pedir("POST", "/movil/sesiones", {"correo": correo, "contrasena": contrasena})["token"]


def subir_evidencia(api: Api, token: str, aviso_id: str) -> bool:
    contenido = EVIDENCIA.read_bytes()
    carga = api.pedir(
        "POST",
        f"/movil/siniestros/{aviso_id}/evidencias/cargas",
        {"content_type": "image/png", "bytes": len(contenido)},
        token=token,
    )
    subida = urllib.request.Request(carga["upload_url"], data=contenido, method="PUT")
    for clave, valor in carga["headers"].items():
        subida.add_header(clave, valor)
    try:
        with urllib.request.urlopen(subida, timeout=30):
            pass
    except (urllib.error.URLError, OSError):
        return False
    api.pedir("POST", f"/movil/siniestros/{aviso_id}/evidencias/{carga['evidencia_id']}/confirmar", token=token)
    return True


def poblar_clientes(api: Api, credenciales: dict, conteo: dict) -> None:
    for indice, (nombre, apellido, destino) in enumerate(CLIENTES):
        token = sesion_de_cliente(api, credenciales, nombre, apellido, conteo)
        if not token:
            continue
        for viaje in range(1 + indice % 2):
            solicitud = solicitud_por_producto("viaje-internacional", indice + viaje)
            solicitud |= {"destino": destino, "nombre": f"{nombre} {apellido}", "cedula": str(1_010_000_000 + indice)}
            api.pedir("POST", "/movil/cotizaciones", solicitud, token=token)
            conteo["cotizaciones móviles"] += 1

        if indice % 3 == 2:
            continue
        tipo, descripcion, ubicacion = SINIESTROS[indice % len(SINIESTROS)]
        ocurrido = (datetime.now() - timedelta(days=2 + indice)).replace(microsecond=0)
        aviso = api.pedir(
            "POST",
            "/movil/siniestros",
            {
                "poliza_id": f"SLV-2026-{3100 + indice:05d}",
                "tipo": tipo,
                "ocurrido_en": ocurrido.isoformat(),
                "descripcion": descripcion,
                "ubicacion": ubicacion,
            },
            token=token,
        )
        conteo["avisos de siniestro"] += 1
        if indice % 2 == 1:
            continue
        if not subir_evidencia(api, token, aviso["id"]):
            conteo["evidencias sin almacén alcanzable"] += 1
            continue
        conteo["evidencias"] += 1
        api.pedir("POST", f"/movil/siniestros/{aviso['id']}/radicar", token=token)
        conteo["avisos radicados"] += 1


def poblar_portal(api: Api, conteo: dict) -> None:
    for indice, producto_id in enumerate(sorted(CON_TARIFA) * 2):
        api.pedir("POST", "/web/cotizaciones", solicitud_por_producto(producto_id, indice))
        conteo["cotizaciones del portal"] += 1


def main(argumentos: list[str]) -> int:
    base = argumentos[0] if argumentos else URL_LOCAL
    api = Api(base)
    archivo = CREDENCIALES / f"{urlparse(base).netloc.replace(':', '_')}.json"
    credenciales = cargar_credenciales(archivo)
    conteo = {
        clave: 0
        for clave in [
            "socios creados",
            "socios existentes",
            "cotizaciones de socios",
            "clientes creados",
            "clientes existentes",
            "cotizaciones móviles",
            "cotizaciones del portal",
            "avisos de siniestro",
            "evidencias",
            "evidencias sin almacén alcanzable",
            "avisos radicados",
        ]
    }
    print(f"==> Poblando {api.base}")
    try:
        poblar_socios(api, credenciales, conteo)
        poblar_clientes(api, credenciales, conteo)
        poblar_portal(api, conteo)
    except ErrorApi as error:
        print(f"La API respondió {error}", file=sys.stderr)
        return 1
    finally:
        guardar_credenciales(archivo, credenciales)

    for clave, valor in conteo.items():
        print(f"  {clave}: {valor}")
    print(f"Credenciales de socios y clientes en {archivo}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
