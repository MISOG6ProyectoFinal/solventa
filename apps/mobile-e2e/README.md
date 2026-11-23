# mobile-e2e

Prueba E2E E001: compra de una póliza desde la app Android de Solventa, ejecutada con Maestro.

```text
Nx
 ↓
node apps/mobile-e2e/run.js
 ↓
Maestro CLI
 ↓
Android físico o Android Emulator
 ↓
Solventa
```

Desde la raíz del repositorio:

```powershell
npx nx e2e mobile-e2e
```

`run.js` no arranca el backend, Metro, el emulador ni `adb reverse`: son precondiciones que se preparan en local. La suite no corre en CI.

## Estructura

```text
apps/mobile-e2e/
├── project.json
├── run.js
├── properties.example.json
├── properties.json       # local, gitignored
├── README.md
└── flows/
    └── e001-compra-poliza.yaml
```

## Requisitos

- Node y npm.
- Java 17 o superior.
- Android SDK, con `adb` en `PATH`.
- Maestro CLI en `PATH`.
- Backend de Solventa en el puerto 8000.
- Metro en el puerto 8081. La app debug no trae el bundle embebido.
- Un dispositivo Android físico o un Android Emulator encendido.
- La app debug de Solventa (`com.solventa`) instalada en ese dispositivo.

El usuario de `E2E_EMAIL` debe existir en ese backend. La suite no crea usuarios ni borra datos.

Para comprobar que Maestro CLI está instalada y en `PATH`:

```powershell
maestro --version
```

Opcionalmente:

```powershell
maestro --help
```

## Configuración

Desde la raíz del repositorio, copia el archivo de ejemplo:

```powershell
Copy-Item apps\mobile-e2e\properties.example.json apps\mobile-e2e\properties.json
```

`properties.json` es local y no se sube al repositorio. Completa al menos el correo y la contraseña, porque el ejemplo no trae credenciales.

| Variable | Uso |
| --- | --- |
| `MAESTRO_DEVICE_ID` | Serial o id del emulador. Vacío deja la elección a Maestro. |
| `E2E_EMAIL` | Usuario de login. Obligatorio. |
| `E2E_PASSWORD` | Contraseña de login. Obligatoria. |
| `PRODUCT_ID` | Producto del catálogo. Default `viaje-internacional`. |
| `QUOTE_NOMBRE` | Nombre de la cotización. |
| `QUOTE_CEDULA` | Documento, solo dígitos. |
| `QUOTE_DESTINO` | Uno de: `Estados Unidos`, `España`, `México`, `Otro país`. |
| `QUOTE_VIAJEROS` | Entero mayor o igual a 1. |
| `QUOTE_SALIDA_OFFSET_DAYS` | Días desde hoy para la salida. Entero mayor o igual a 0. |
| `QUOTE_REGRESO_OFFSET_DAYS` | Días desde hoy para el regreso. Debe ser posterior a la salida. |

Cada valor se toma en este orden de prioridad:

```text
process.env
>
properties.json
>
defaults no sensibles
```

El correo y la contraseña no tienen default. `APP_ID` vale `com.solventa` por defecto y se cambia con la variable de entorno o con la misma clave en `properties.json`.

Los offsets se calculan con la fecha local del equipo que lanza Maestro, así que el equipo y el dispositivo deben tener la misma fecha.

### Dispositivo

```powershell
adb devices
```

Un dispositivo físico aparece con su serial, y un emulador normalmente como `emulator-5554`. El dispositivo se elige en `apps/mobile-e2e/properties.json`:

```json
"MAESTRO_DEVICE_ID": "<device-id>"
```

Ejemplo con un dispositivo físico:

```json
"MAESTRO_DEVICE_ID": "ZY225B3WM2"
```

Ejemplo con un emulador:

```json
"MAESTRO_DEVICE_ID": "emulator-5554"
```

Usa el valor que muestra `adb devices` en tu equipo.

Si `MAESTRO_DEVICE_ID` está vacío, `run.js` no pasa `--device` y Maestro usa el dispositivo disponible. Si hay un teléfono y un emulador conectados a la vez, define el id.

## Preparar el entorno

### Backend

```powershell
cd apps\backend
docker compose up -d --build canales
docker compose ps
curl.exe http://localhost:8000/health/ready
```

### Metro

Desde la raíz del repositorio. Déjalo abierto durante la prueba:

```powershell
npm run metro
```

Comprueba que responde:

```powershell
curl.exe http://localhost:8081/status
```

La respuesta debe indicar que Metro está corriendo.

### ADB reverse

La app de desarrollo llama a `localhost`, y en el teléfono o el emulador `localhost` no es el PC. Antes de ejecutar, reenvía los dos puertos, reemplazando `<device-id>` por el serial o el id del emulador:

```powershell
adb -s <device-id> reverse tcp:8000 tcp:8000
adb -s <device-id> reverse tcp:8081 tcp:8081
```

Para verificarlo:

```powershell
adb -s <device-id> reverse --list
```

El resultado esperado es:

```text
tcp:8000 tcp:8000
tcp:8081 tcp:8081
```

### App instalada

```powershell
adb -s <device-id> shell pm path com.solventa
```

Si devuelve una ruta `package:...`, la app está instalada. Si no devuelve nada, instala el APK debug.

Los cambios solo de JavaScript, TypeScript o TSX se prueban con Metro, sin reconstruir el APK. Una dependencia nativa nueva o modificada no llega a un APK ya instalado: hay que reconstruirlo e instalarlo de nuevo. Es el caso de `react-native-get-random-values`, el polyfill de `crypto` que se carga desde `apps/mobile/src/main.tsx`.

Para generar el APK debug:

```powershell
npx nx build-android mobile --tasks=assembleDebug
```

Sin `--tasks=assembleDebug`, `npx nx build-android mobile` ejecuta `app:bundleDebug` y no genera el APK que se instala.

El APK queda en:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Para instalarlo:

```powershell
adb -s <device-id> install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Ejecución

Con el dispositivo visible, la app instalada, el reverse hecho y el backend y Metro en marcha:

```powershell
npx nx e2e mobile-e2e
```

`run.js`:

- carga la configuración;
- valida las variables;
- calcula las fechas de salida y regreso;
- selecciona el dispositivo si `MAESTRO_DEVICE_ID` tiene valor;
- ejecuta Maestro sobre `flows/e001-compra-poliza.yaml`;
- propaga el exit code.

## Flujo E001

```text
login
→ Comprar
→ producto Viaje Internacional
→ cotización
→ destino
→ fechas
→ viajeros
→ calcular
→ continuar al pago
→ pagar
→ emisión de póliza
→ Mis pólizas
```

E001 está validado de punta a punta con Maestro en un dispositivo Android físico: login, cotización, pago aprobado, emisión y Mis pólizas. El runner admite dispositivo físico y Android Emulator mediante `MAESTRO_DEVICE_ID`.

El pago no marca las simulaciones de rechazo ni de cotización vencida. La verificación usa el número `POL-` de esa corrida, y cada corrida puede emitir una póliza nueva.

## Decisiones de implementación

### Pressable de Gesture Handler

Los controles interactivos compartidos que usa E001 toman `Pressable` de `react-native-gesture-handler` en lugar del de React Native core. Aplica a `FieldFrame` y a `Button`.

En Android, Maestro ejecutaba el tap sobre los controles de React Native core, pero `onPress` no se disparaba de forma consistente. Con RNGH el tap funciona.

### Nombre

Para `quote-nombre`, el flow hace:

```text
tap
→ eraseText
→ pressKey: back
→ inputText
```

Cerrar el teclado antes de `inputText` evita que Gboard o la predicción alteren el nombre que escribe Maestro.

### Viajeros

Después de escribir Viajeros, el flow cierra el teclado numérico con:

```yaml
- pressKey: back
```

Así puede buscar `quote-calc`. En este paso no se usa `hideKeyboard`.

### LogBox

En desarrollo, la app desactiva las notificaciones visuales de LogBox para que los avisos de warnings no tapen controles durante la automatización. Los errores fatales siguen visibles. No hace falta abrir DevTools ni presionar `j` antes de la prueba.

## Solución de problemas

### Maestro no encuentra el dispositivo

```powershell
adb devices
```

Revisa `MAESTRO_DEVICE_ID`: debe coincidir con un id de esa lista, o quedar vacío si solo hay un dispositivo.

### Unable to load script

```powershell
curl.exe http://localhost:8081/status
adb -s <device-id> reverse --list
```

Metro debe estar corriendo y el reverse del puerto `8081` debe existir.

### Backend inaccesible

```powershell
curl.exe http://localhost:8000/health/ready
adb -s <device-id> reverse --list
```

El health check debe responder y el reverse del puerto `8000` debe existir.

### La app no tiene un módulo nativo nuevo

Reconstruye e instala el APK debug:

```powershell
npx nx build-android mobile --tasks=assembleDebug
adb -s <device-id> install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Metro no incorpora un módulo nativo a un APK ya instalado.

### Maestro CLI no encontrada

```powershell
maestro --version
```

El comando debe funcionar desde PowerShell. Si falla, la CLI no está en `PATH`.
