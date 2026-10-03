# Solventa

## App móvil

Desde la raíz del repositorio. iOS requiere un Mac.

El proyecto usa Node.js 26. Comprueba con `node -v` que la versión empieza por 26.

### Android

Para Android, sigue la guía de React Native en Windows o macOS: [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment). Elige tu sistema y el destino Android.

Instala las dependencias una vez:

```bash
npm install
```

La compilación de Android pide el NDK 27.1.12297006 y CMake 3.31.6. La guía de React Native no instala el NDK. Android Studio suele instalar CMake 3.22.1, y esa versión no sirve aquí.

En Android Studio abre **SDK Manager**, pestaña **SDK Tools**. Marca **Show Package Details**. Despliega **NDK (Side by side)** y marca **27.1.12297006**. Despliega **CMake** y marca **3.31.6**. Pulsa **Apply**.

El emulador es opcional: vale cualquiera que ya tengas abierto, o un dispositivo.
El script a continuación abre un emulador, si no se pasa el nombre del dispositivo se usa por defecto Pixel_8.

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

Si bash niega el permiso, ejecuta `chmod +x scripts/startemu.sh` una vez. `emulator` debe estar en el `PATH`.

En terminales distintas, con el emulador o el dispositivo ya conectado:

```bash
npm run metro
npm run android
```

`metro` levanta el bundler. Déjalo corriendo. `android` compila la app, la instala en el emulador o el dispositivo y usa ese Metro. No abre otro.

### APK

Estos scripts generan un APK de release. No abren el emulador y no necesitan Metro: el JavaScript va dentro del APK. Hace falta Node 26, Java y el Android SDK en `ANDROID_HOME`, con el NDK y CMake de arriba. En Windows, si `ANDROID_HOME` no está definido, el script usa `%LOCALAPPDATA%\Android\Sdk`.

El APK se firma con la clave de depuración que ya trae el proyecto. Sirve para instalarlo. No es la firma de Play Store.

- Windows:

```powershell
.\scripts\build-apk.ps1
```

- Mac / Linux, y el job de GitHub Actions:

```bash
./scripts/build-apk.sh
```

Si bash niega el permiso, ejecuta `chmod +x scripts/build-apk.sh` una vez. El job de GitHub instala Node, Java y el SDK antes de llamar al script. El APK queda en `dist/mobile-release.apk`.

Para instalar ese APK, conecta un dispositivo con depuración USB o deja un emulador abierto. `adb` tiene que estar en el `PATH`, o dentro de `platform-tools` del SDK. Si hay más de un dispositivo, pasa el serial que muestra `adb devices`.

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
