# Solventa

## App móvil

Desde la raíz del repositorio. iOS requiere un Mac.

Instala las dependencias una vez:

```bash
npm install
```

Arranca el emulador. Sin argumento usa `Pixel_8`.

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

En terminales distintas, con el emulador ya abierto:

```bash
npm run metro
npm run android
```

`metro` levanta el bundler. Déjalo corriendo. `android` compila la app, la instala en el emulador y usa ese Metro. No abre otro.
