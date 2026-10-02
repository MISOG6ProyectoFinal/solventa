# Solventa

## App móvil

Desde la raíz del repositorio. iOS requiere un Mac.

El proyecto usa Node.js 26. Comprueba con `node -v` que la versión empieza por 26.

Para Android, sigue la guía de React Native en Windows o macOS: [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment). Elige tu sistema y el destino Android.

Instala las dependencias una vez:

```bash
npm install
```

La compilación de Android pide el NDK 27.1.12297006 y CMake 3.31.6. La guía de React Native no instala el NDK. Android Studio suele instalar CMake 3.22.1, y esa versión no sirve aquí.

En Android Studio abre **SDK Manager**, pestaña **SDK Tools**. Marca **Show Package Details**. Despliega **NDK (Side by side)** y marca **27.1.12297006**. Despliega **CMake** y marca **3.31.6**. Pulsa **Apply**.

El emulador es opcional: vale cualquiera que ya tengas abierto, o un dispositivo. Si usas el script y no pasas un nombre, busca uno llamado `Pixel_8`.

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
