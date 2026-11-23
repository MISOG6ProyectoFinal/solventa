# Web.Solventa.Angular (shell host)

Shell (host) de la arquitectura de micro frontends del portal web de Solventa.

## Tecnologías

- Angular 22 con componentes standalone y detección de cambios zoneless.
- Reactividad con Signals.
- Tailwind CSS v4, configurado con los design tokens de Solventa tomados de los mockups (fuentes Outfit y Fraunces).
- `@angular-architects/native-federation`, configurado como host.

## Requisitos

Las versiones mínimas están en `requirements.txt`:

- Node.js >= 26.7.0
- npm >= 11.19.0
- Angular CLI >= 22.2.1

## Instalación

El proyecto tiene su propio `package.json`. Desde `apps/web/Web.Solventa.Angular`:

```bash
npm install
```

## Servidor de desarrollo

```bash
ng serve
```

Usa la configuración `development` (`src/environments/environment.dev.ts`). La aplicación queda en `http://localhost:4200/`.

Para trabajar contra el backend local (BFF `canales` en `http://localhost:8000`, ver `apps/backend/docker-compose.yml`):

```bash
npm run start:local
```

`npm start` ejecuta el mismo comando (`ng serve --configuration local`).

## Compilación

Producción (`src/environments/environment.prd.ts`):

```bash
ng build
```

Despliegue: `scripts/write-environment.mjs` genera `src/environments/environment.deploy.ts` con la URL del backend y luego compila con la configuración `deploy`. `API_BASE_URL` es obligatoria y `ENVIRONMENT_NAME` toma `dev` si no se define:

```bash
API_BASE_URL=<url-del-backend> ENVIRONMENT_NAME=<ambiente> npm run build:deploy
```

El script `apps/backend/deploy/scripts/deploy-aws.sh web` ejecuta este paso con la URL del stack `edge` y publica el resultado en S3 y CloudFront.

Los artefactos quedan en `dist/Web.Solventa.Angular/`.

## Pruebas

```bash
npm test
```

## Añadir un micro frontend remoto

1. Desarrolla y despliega la aplicación remota (por ejemplo, `ops-polizas`).
2. Agrega en `public/federation.manifest.json` la URL del `remoteEntry.json` del remoto.
3. Registra el remoto en `REMOTES`, en `src/app/core/constants/remotes.constants.ts`: nombre del manifiesto, módulo expuesto, ruta, etiqueta, ícono y roles. `src/app/app.routes.ts` crea una ruta por cada remoto, y `RemoteLoaderService` lo carga con `loadRemoteModule`; si el remoto no responde, el shell muestra un componente de respaldo.

## Estructura de carpetas

```
src/
├── app/
│   ├── core/                    # Código central del proyecto (servicios, modelos, etc.)
│   ├── shared/                  # Elementos reutilizables (pipes, utilidades sin estado)
│   ├── ui/                      # Elementos visuales reutilizables (componentes puros de UI)
│   ├── layout/                  # Shell layout principal (Header, Sidebar)
│   ├── pages/                   # Páginas del shell (login, ops, partners, users)
│   ├── app.ts                   # Componente raíz
│   ├── app.config.ts            # Configuración de proveedores (zoneless, http)
│   └── app.routes.ts            # Enrutamiento de MFE
├── environments/                # Variables de entorno por ambiente
└── styles.css                   # Tailwind v4 import + Design Tokens
```
