# mobile-e2e

E001 compra una póliza desde la app Android de Solventa. Lo ejecuta Maestro.

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

El comando principal, desde la raíz del repositorio:

```powershell
npx nx e2e mobile-e2e
```

`run.js` no arranca el backend, Metro, el emulador ni `adb reverse`. Esas son precondiciones locales. La suite no corre en CI.

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

`properties.json` es local y no debe subirse al repositorio.

## Requisitos

- Node y npm.
- Java 17 o superior.
- Android SDK, con `adb` en `PATH`.
- Maestro CLI en `PATH`.
- Backend de Solventa en el puerto 8000.
- Metro en el puerto 8081. La app debug no trae el bundle embebido.
- Un dispositivo Android físico o un Android Emulator encendido.
- La app debug de Solventa (`com.solventa`) instalada en ese dispositivo.

El usuario de `E2E_EMAIL` tiene que existir en ese backend. Esta suite no crea el usuario ni borra datos del backend.

## Verificar Maestro

Maestro CLI tiene que estar instalada y disponible en `PATH`.

```powershell
maestro --version
```

Opcionalmente:

```powershell
maestro --help
```

## Dispositivo físico o emulador

```powershell
adb devices
```

Un dispositivo físico aparece con su serial. Un emulador aparece normalmente como `emulator-5554`.

El target se elige en `apps/mobile-e2e/properties.json`:

```json
"MAESTRO_DEVICE_ID": "<device-id>"
```

Ejemplo físico:

```json
"MAESTRO_DEVICE_ID": "ZY225B3WM2"
```

Ejemplo emulador:

```json
"MAESTRO_DEVICE_ID": "emulator-5554"
```

Esos identificadores son ejemplos. Usa el valor real que muestra `adb devices`.

Si `MAESTRO_DEVICE_ID` está vacío, `run.js` no pasa `--device` y Maestro usa el dispositivo disponible. Con un teléfono y un emulador a la vez, define el id.

## Properties

Desde la raíz del repositorio:

```powershell
Copy-Item apps\mobile-e2e\properties.example.json apps\mobile-e2e\properties.json
```

Completa al menos el correo y la contraseña. El ejemplo no trae credenciales.

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
| `QUOTE_REGRESO_OFFSET_DAYS` | Días desde hoy para el regreso. Tiene que ser posterior a la salida. |

La prioridad de cada valor es:

```text
process.env
>
properties.json
>
defaults no sensibles
```

El correo y la contraseña no tienen default. `APP_ID` default es `com.solventa` y solo se cambia por variable de entorno.

Los offsets se calculan con la fecha local del equipo que lanza Maestro. El equipo y el dispositivo deben coincidir en esa fecha.

## Backend

Desde `apps\backend`:

```powershell
cd apps\backend
docker compose up -d --build canales
docker compose ps
curl.exe http://localhost:8000/health/ready
```

## Metro

Desde la raíz del repositorio, y déjalo abierto durante el E2E:

```powershell
npm run metro
```

Comprueba que responde:

```powershell
curl.exe http://localhost:8081/status
```

La respuesta debe indicar que Metro está corriendo.

## ADB reverse

La app de desarrollo llama a `localhost`. En el teléfono o en el emulador eso no es el PC. Antes de ejecutar, reenvía los dos puertos. Sustituye `<device-id>` por el serial o por el id del emulador:

```powershell
adb -s <device-id> reverse tcp:8000 tcp:8000
adb -s <device-id> reverse tcp:8081 tcp:8081
```

Verificación:

```powershell
adb -s <device-id> reverse --list
```

El resultado esperado es:

```text
tcp:8000 tcp:8000
tcp:8081 tcp:8081
```

`run.js` no hace este reverse.

## App instalada

```powershell
adb -s <device-id> shell pm path com.solventa
```

Si devuelve una ruta `package:...`, la app está instalada. Si no devuelve nada, instala la APK debug.

Cambios solo de JavaScript, TypeScript o TSX se prueban con Metro, sin reconstruir la APK. Una dependencia nativa nueva o modificada no entra en una APK ya instalada: hay que reconstruirla e instalarla de nuevo.

El caso real es `react-native-get-random-values`. El polyfill de `crypto` se carga desde `apps/mobile/src/main.tsx`. Al ser un módulo nativo, si se instala o cambia hay que reconstruir e instalar la APK otra vez.

El comando que genera el APK debug de este proyecto es:

```powershell
npx nx build-android mobile --tasks=assembleDebug
```

`npx nx build-android mobile` sin `--tasks=assembleDebug` ejecuta `app:bundleDebug` y no genera el APK que se instala.

La APK queda en:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Instalación:

```powershell
adb -s <device-id> install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Ejecución

Con el dispositivo visible, la app instalada, el reverse hecho, el backend y Metro en marcha:

```powershell
npx nx e2e mobile-e2e
```

`run.js`:

- carga la configuración;
- valida las variables;
- calcula las fechas de salida y regreso;
- selecciona el dispositivo si `MAESTRO_DEVICE_ID` existe;
- ejecuta Maestro sobre `flows/e001-compra-poliza.yaml`;
- propaga el exit code.

No arranca el backend, Metro, el emulador ni `adb reverse`.

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

E001 está validado de punta a punta en un dispositivo físico Android con Maestro: login, cotización, pago aprobado, emisión y Mis pólizas.

El pago no marca las simulaciones de rechazo ni de cotización vencida. La comprobación usa el número `POL-` de esa corrida. Cada corrida puede emitir otra póliza.

## Decisiones de implementación

### Pressable de Gesture Handler

Los controles interactivos compartidos que usa E001 toman `Pressable` de `react-native-gesture-handler`, no el de React Native core. Hoy aplica al menos a `FieldFrame` y a `Button`.

En Android, Maestro ejecutaba el tap sobre los controles de React Native core, pero `onPress` no se disparaba de forma consistente. RNGH resolvió ese comportamiento.

### Nombre

Para `quote-nombre` el flow hace:

```text
tap
→ eraseText
→ pressKey: back
→ inputText
```

Cerrar el teclado antes de `inputText` evita que Gboard/predicción altere el nombre escrito por Maestro.

### Viajeros

Después de escribir Viajeros el flow cierra el teclado numérico con:

```yaml
- pressKey: back
```

Así puede buscar `quote-calc`. En ese caso no se usa `hideKeyboard`.

### LogBox

No hace falta abrir DevTools ni presionar `j` antes del E2E.

En desarrollo, la app desactiva las notificaciones visuales de LogBox para que los overlays de warnings no cubran controles durante la automatización. Los errores fatales siguen siendo visibles.

## Troubleshooting

### Maestro no encuentra dispositivo

```powershell
adb devices
```

Revisa `MAESTRO_DEVICE_ID`. Tiene que coincidir con un id de esa lista, o quedar vacío si solo hay un dispositivo.

### Unable to load script

```powershell
curl.exe http://localhost:8081/status
adb -s <device-id> reverse --list
```

Metro tiene que estar corriendo y el reverse de `8081` tiene que existir.

### Backend inaccesible

```powershell
curl.exe http://localhost:8000/health/ready
adb -s <device-id> reverse --list
```

El health check tiene que responder y el reverse de `8000` tiene que existir.

### La app no tiene un módulo nativo nuevo

Reconstruye e instala la APK debug:

```powershell
npx nx build-android mobile --tasks=assembleDebug
adb -s <device-id> install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Metro solo no incorpora un módulo nativo a una APK ya instalada.

### Maestro CLI no encontrada

```powershell
maestro --version
```

Tiene que funcionar desde PowerShell. Si no, la CLI no está en `PATH`.

## Estado actual

E001 está validado de punta a punta en un dispositivo físico Android con Maestro.

El runner soporta dispositivo físico y Android Emulator mediante `MAESTRO_DEVICE_ID`. E001 ha sido validado de punta a punta en un dispositivo físico Android.
