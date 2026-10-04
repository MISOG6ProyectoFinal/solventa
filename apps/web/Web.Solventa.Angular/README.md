# Web.Solventa.Angular (Shell Host)

Este proyecto es el cascarón base (Host / Shell) para la arquitectura de Micro Frontends de Solventa.

## Arquitectura y Tecnologías
- **Framework:** Angular 22 (Standalone, Zoneless Change Detection).
- **Reactividad:** Basado en **Signals**.
- **Estilos:** Tailwind CSS v4, configurado con los Design Tokens de Solventa extraídos de los mockups (Fuentes: Outfit, Fraunces).
- **Micro Frontends:** `@angular-architects/native-federation` configurado como host.

## Requisitos Previos
Ver el archivo `requirements.txt` para consultar las versiones mínimas necesarias:
- Node.js >= 26.7.0
- npm >= 11.19.0
- Angular CLI == 22.2.1

## Instalación

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```

## Ejecución del Servidor de Desarrollo

Para iniciar el entorno de desarrollo (levantará el servidor de desarrollo adaptado para Native Federation):

```bash
ng serve
# o alternativamente:
npm start
```

La aplicación estará disponible en `http://localhost:4200/`.

## Compilación para Producción o Entornos

Para compilar la aplicación para el entorno de producción:

```bash
ng build
```

Para compilar hacia el entorno de Staging (`stg`) u otros configurados:

```bash
ng build --configuration=stg
```

Los artefactos de compilación se guardarán en el directorio `dist/Web.Solventa.Angular/`.

## Añadir Micro Frontends (Remotos)

1. Desarrolla y despliega tu aplicación remota (por ejemplo, `ops-polizas`).
2. Actualiza el archivo `public/federation.manifest.json` en este proyecto con la URL donde está alojado el `remoteEntry.json` de tu remoto.
3. Asegúrate de mapear adecuadamente la ruta dentro de `src/app/app.routes.ts` usando la función `loadRemoteModule`.

## Estructura de Carpetas

```
src/
├── app/
│   ├── core/                    # Código central del proyecto (servicios, modelos, etc.)
│   ├── shared/                  # Elementos reutilizables (pipes, utilidades sin estado)
│   ├── ui/                      # Elementos visuales reutilizables (componentes puros de UI)
│   ├── layout/                  # Shell layout principal (Header, Sidebar)
│   ├── app.ts                   # Componente raíz
│   ├── app.config.ts            # Configuración de proveedores (zoneless, http)
│   └── app.routes.ts            # Enrutamiento de MFE
├── environments/                # Variables de entorno por ambiente
└── styles.css                   # Tailwind v4 import + Design Tokens
```
