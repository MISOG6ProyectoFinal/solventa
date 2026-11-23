# App móvil

Todos los comandos se ejecutan desde la raíz del repositorio. iOS requiere un Mac.

El repositorio fija Node.js 26 en `.nvmrc` (comprueba con `node -v`). El campo `engines` de `package.json` también acepta Node 22.22.3+ y 24.15+, pero los scripts que generan el APK exigen Node 26.

## Android

Prepara el entorno con la guía de React Native para Windows o macOS: [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment). Elige tu sistema operativo y Android como destino.

Instala las dependencias una vez:

```bash
npm install
```

La compilación de Android necesita el NDK 27.1.12297006 y CMake 3.31.6. La guía de React Native no instala el NDK, y Android Studio suele instalar CMake 3.22.1, que no sirve para este proyecto.

En Android Studio abre **SDK Manager**, pestaña **SDK Tools**, y marca **Show Package Details**. En **NDK (Side by side)** marca **27.1.12297006**, en **CMake** marca **3.31.6** y pulsa **Apply**.

Puedes usar un emulador que ya tengas abierto o un dispositivo conectado. Este script abre un emulador; si no recibe el nombre del dispositivo virtual, usa Pixel_8:

- Windows:

```powershell
.\scripts\startemu.ps1
.\scripts\startemu.ps1 Pixel_7
```

- Mac / Linux:

```bash
./scripts/startemu.sh
./scripts/startemu.sh Pixel_7
```

`emulator` debe estar en el `PATH`. Si bash niega el permiso, ejecuta `chmod +x scripts/startemu.sh` una vez.

Con el emulador o el dispositivo conectado, ejecuta cada comando en una terminal distinta:

```bash
npm run metro
npm run android
```

`metro` levanta el bundler y debe quedar corriendo. `android` compila la app, la instala en el emulador o el dispositivo y se conecta a ese Metro, sin abrir otro.

## Mapa de prestadores

El mapa de asistencia cercana usa Google Maps y necesita una clave de la API Maps SDK for Android. La clave no se guarda en el repositorio: se lee de la variable de entorno o de la propiedad de Gradle `GOOGLE_MAPS_API_KEY`.

```bash
export GOOGLE_MAPS_API_KEY=<clave>          # Mac / Linux
$env:GOOGLE_MAPS_API_KEY = "<clave>"        # Windows (PowerShell)
```

También puede ir en `~/.gradle/gradle.properties` como `GOOGLE_MAPS_API_KEY=<clave>`. Sin clave, la app compila y el mapa se ve vacío.

En Google Cloud, restringe la clave al paquete `com.solventa` y al SHA-1 del keystore que firma el APK. El workflow `mobile-apk.yml` toma la clave del secreto `GOOGLE_MAPS_API_KEY` del repositorio.

## Idiomas

La app está en español e inglés. Los textos de cada feature están en `texts/es.ts` y `texts/en.ts`, y cada clave nueva va en los dos archivos: `en.ts` está tipado con `es.ts`, así que `npm run typecheck-mobile` falla si falta alguna.

Los componentes leen los textos con `useTexts()`, y el código que corre fuera del render usa `getTexts()`. El usuario cambia el idioma en Ajustes, desde el menú de Inicio, y la elección se guarda en el dispositivo.

## APK

Estos scripts generan un APK de release. No abren el emulador ni necesitan Metro, porque el JavaScript va dentro del APK. Requieren Node.js 26, Java y el Android SDK en `ANDROID_HOME`, con el NDK y CMake indicados arriba. En Windows, si `ANDROID_HOME` no está definido, el script usa `%LOCALAPPDATA%\Android\Sdk`.

El APK se firma con la clave de depuración que trae el proyecto. Sirve para instalarlo en un dispositivo, pero no es la firma de Play Store.

- Windows:

```powershell
.\scripts\build-apk.ps1
```

- Mac / Linux, y el job de GitHub Actions:

```bash
./scripts/build-apk.sh
```

Si bash niega el permiso, ejecuta `chmod +x scripts/build-apk.sh` una vez.

El job de GitHub instala Node, Java y el SDK antes de llamar al script. Corre al publicar un release, deja el archivo en `dist/mobile-release.apk` y lo adjunta a ese release como `mobile-release.apk`.

Para instalar el APK, conecta un dispositivo con depuración USB o deja un emulador abierto. `adb` debe estar en el `PATH` o en la carpeta `platform-tools` del SDK. Si hay más de un dispositivo, pasa el serial que muestra `adb devices`.

- Windows:

```powershell
.\scripts\install-apk.ps1
.\scripts\install-apk.ps1 emulator-5554
```

- Mac / Linux:

```bash
./scripts/install-apk.sh
./scripts/install-apk.sh emulator-5554
```

Si bash niega el permiso, ejecuta `chmod +x scripts/install-apk.sh` una vez. La instalación reemplaza la app que ya esté en el dispositivo.
