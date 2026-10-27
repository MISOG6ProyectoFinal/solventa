# mobile-e2e

Pruebas E2E funcionales de la aplicación React Native de Solventa en Android. Las ejecuta [Kraken](https://github.com/TheSoftwareDesignLab/Kraken) (`kraken-node` 1.0.24) con Gherkin, contra un dispositivo o emulador ya conectado por ADB.

La suite no levanta Docker, el backend ni ningún otro servicio. Tampoco corre en CI. Antes de lanzarla, el ambiente local tiene que estar listo.

El flujo del escenario queda separado así:

`Feature` → `Step Definitions` → `Page Objects` → aplicación.

## Prerrequisitos

- Node `^22.22.3 || ^24.15.0 || ^26.0.0`, el rango de `package.json`.
- Android SDK con `adb` en `PATH` o `ANDROID_HOME` apuntando al SDK (`platform-tools`).
- Java, requerido por Appium y por el build Android.
- Un backend local ya levantado en el puerto **8000**. Kraken busca un puerto libre para Appium desde el 8000; si el backend todavía no escucha ahí, Appium puede ocuparlo y la app deja de llegar a la API.
- Datos de catálogo y un usuario que pueda iniciar sesión en ese backend. El producto que hoy abre la cotización es `viaje-internacional`.
- Un dispositivo físico o un emulador visible en `adb devices`.
- Metro en marcha. El APK debug no embebe el bundle de JavaScript.
- `apps/mobile/.env`, copiado desde `apps/mobile/.env.example`. Babel inlinea `API_BASE_URL` al compilar. El ejemplo del repo es `http://localhost:8000`.

En un dispositivo físico, `localhost` del teléfono no es el PC. Con esa URL hace falta:

```text
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
```

El primer reverse es la API. El segundo es Metro. En un emulador, `adb reverse` también vale. La otra opción del emulador es `API_BASE_URL=http://10.0.2.2:8000` en `apps/mobile/.env` y volver a compilar: sin reverse, `localhost` dentro del emulador no es el PC.

Appium 3 y el driver `uiautomator2` 8.7.2 los instala el target `e2e` la primera vez, en `apps/mobile-e2e/.appium`. Kraken 1.0.24 sigue invocando `appium -p` y el prefijo `/wd/hub` de Appium 1. `bin/appium-compat.js` arranca Appium 3 con esa ruta y agrega el prefijo `appium:` que Appium 3 exige en las capabilities. Al cerrar, Kraken lee la orientación con `grep` y `awk`. Durante `e2e`, `bin/grep` y `bin/awk` cubren solo ese comando para que el reporte se genere en Windows.

## Preparación

Comprobar el dispositivo:

```text
adb devices
```

Tiene que aparecer como `device`, no como `unauthorized` ni `offline`.

Reverse para dispositivo físico, o para emulador si `API_BASE_URL` es `http://localhost:8000`:

```text
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
```

Variables de la app, si todavía no existe `apps/mobile/.env`:

```text
copy apps\mobile\.env.example apps\mobile\.env
```

Metro, en otra terminal, desde la raíz del repo:

```text
npm run metro
```

APK debug. El módulo Android no define flavors; Gradle lo deja en `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Desde la raíz:

```text
npx nx build-android mobile
```

`npm run android` instala y abre la app, pero no sustituye a Metro (`--no-packager`). Kraken vuelve a instalar el APK indicado en `mobile.json`.

Configuración local de la suite, desde la raíz:

```text
copy apps\mobile-e2e\properties.example.json apps\mobile-e2e\properties.json
```

Completa `E2E_EMAIL` y `E2E_PASSWORD` con el usuario local. No dejes esas claves vacías. El ejemplo no trae credenciales válidas. `properties.json` está en `.gitignore`.

`QUOTE_DESTINO` solo puede ser un destino del formulario: `Estados Unidos`, `España`, `México` u `Otro país`. `QUOTE_SALIDA_OFFSET_DAYS` es un entero mayor o igual a 0, contado desde hoy. `QUOTE_REGRESO_OFFSET_DAYS` tiene que ser posterior. `0` y `14` coinciden con los valores iniciales de la pantalla, así que el calendario solo se usa si cambias esos números. `PRODUCT_ID` del flujo actual es `viaje-internacional`.

Si hay más de un dispositivo, escribe el serial en `KRAKEN_UDID` dentro de `properties.json`, o expórtalo en el entorno. Vacío significa el primero que devuelva `adb devices -l`. Kraken no elige serial por su cuenta: el script `bin/adb-select.js` filtra esa lista.

El equipo que corre la suite y el dispositivo deben coincidir en la fecha local. Los offsets se calculan en el equipo.

## Ejecución

Desde la raíz del repo:

```text
npx nx e2e mobile-e2e
```

Kraken 1.0.24 ejecuta todos los `.feature` que están directamente en `apps/mobile-e2e/features/`. No lee subcarpetas y no ofrece un filtro por escenario. Hoy ese directorio solo tiene `compra-poliza.feature`, así que el comando corre E001.

Cada archivo nuevo debe llevar un único escenario `@user1 @mobile`. Kraken rechaza dos `@user1` en el mismo archivo y asignaría un dispositivo distinto a `@user2`. Archivos separados reutilizan el único dispositivo, uno después de otro.

## Qué hace E001

1. Kraken instala el APK debug y abre `com.solventa.MainActivity`. `noReset` está en falso, así que borra los datos locales de la app, incluido el token. No toca la base del backend.
2. Inicia sesión con `E2E_EMAIL` y `E2E_PASSWORD`.
3. Abre la pestaña Comprar y elige `PRODUCT_ID`.
4. Completa la cotización de viaje y pulsa Calcular cotización.
5. En pago deja sin marcar "Simular pago rechazado" y "Simular cotización vencida", y pulsa pagar. Sin simulación, el canal pide un pago aprobado.
6. Espera el aviso de póliza emitida y lee el número `POL-` de esa ejecución.
7. Pulsa "Ver mi póliza" y comprueba ese número en el listado.

Cada corrida puede crear otra póliza. La comprobación usa el número recién emitido, así que no hace falta vaciar la base. El usuario E2E tiene que existir de antemano y el catálogo móvil tiene que estar sembrado. Esta suite no crea ese usuario ni reinicia datos del backend.

## Solución de problemas

**Dispositivo no encontrado.** `adb devices` vacío, `unauthorized` u `offline`. Acepta la depuración USB o arranca el emulador. Si definiste `KRAKEN_UDID`, tiene que ser el serial exacto. Sin dispositivos, Kraken no asigna `@user1` y puede cortar el reporte con un error al crear `reports/.../assets/js/data.json`. Conecta el dispositivo y vuelve a lanzar el comando.

**Backend no accesible.** El backend debe estar escuchando en el puerto 8000 antes de `npx nx e2e mobile-e2e`. Revisa `adb reverse tcp:8000 tcp:8000` en físico, o `10.0.2.2` en el emulador si cambiaste `.env`. La pantalla de login muestra el error en `login-error` cuando la API rechaza la sesión.

**APK no encontrado.** `mobile.json` apunta a `../mobile/android/app/build/outputs/apk/debug/app-debug.apk`, relativo a `apps/mobile-e2e`. Genera ese archivo con `npx nx build-android mobile`. Kraken no arranca los escenarios si el archivo no existe.

**Elemento no encontrado.** El mensaje incluye el `testID`. Confirma que Metro está sirviendo el bundle de esta rama (`npm run metro` y `adb reverse tcp:8081 tcp:8081`). Un APK viejo no tiene los `testID` nuevos del login ni de las pestañas. La app en inglés también es válida: los pasos usan `testID` y, en el calendario, las etiquetas en español y en inglés.

**Configuración local ausente.** Falta `apps/mobile-e2e/properties.json` o alguna clave obligatoria está vacía. Copia `properties.example.json` y completa el usuario. No versiones ese archivo.

**Appium no llega a abrir la sesión.** La primera instalación de UiAutomator2 en el dispositivo puede tardar. El hook espera hasta 180 segundos. Si el dispositivo pide autorización o está bloqueado, desbloquéalo y vuelve a lanzar el comando.
