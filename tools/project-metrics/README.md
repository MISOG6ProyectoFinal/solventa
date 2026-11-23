# Métricas del proyecto

Genera las gráficas de seguimiento del proyecto como archivos SVG en `output/`: burndown del sprint, velocidad, business value, burndown del release y cobertura de código.

Las cuatro primeras salen de `data/sprint.json`, que se edita a mano. La de cobertura sale de los artefactos de GitHub Actions de la rama `main`.

## Cómo funciona

`src/generate.mjs` arma una especificación de [Vega-Lite](https://vega.github.io/vega-lite/) por gráfica, la compila con Vega y escribe el SVG. No abre un navegador ni publica las imágenes.

1. Lee `data/sprint.json`. El script no modifica este archivo.
2. Crea `output/` si no existe.
3. Escribe `burndown.svg`, `velocity.svg`, `business-value.svg` y `release-burndown.svg`.
4. Llama a `src/fetch-coverage.mjs`, que con `gh` lista los artefactos del repositorio `MISOG6ProyectoFinal/solventa`.
5. Toma los de la rama `main` que no han expirado y cuyo nombre es uno de estos:
   - `backend-test-reports`
   - `mobile-test-reports`
   - `web-test-reports`
6. Descarga solo los que no están en `.cache/coverage-artifacts.json`, de a cuatro a la vez, en un directorio temporal que borra al terminar.
7. Calcula el porcentaje de líneas cubiertas y guarda cada artefacto en la caché.
8. Escribe `data/coverage.json` con todos los puntos vigentes y genera `coverage.svg`.

La cobertura es de líneas, con un decimal:

- Backend: atributo `line-rate` del elemento `coverage` en `coverage.xml` (Cobertura).
- Mobile y Web: suma de `LH` dividida por la suma de `LF` en `lcov.info`.

El workflow `.github/workflows/ci.yml` sube esos archivos solo cuando el proyecto correspondiente está afectado. Un push que no toca Mobile no deja un punto de Mobile, y por eso las tres series tienen distinta cantidad de mediciones.

Si un reporte no se puede leer, el script imprime el error, omite ese punto y sigue. Si `gh` falla, o si no queda ningún punto de cobertura, el proceso termina con código 1; para entonces las otras cuatro gráficas ya están escritas.

## Archivos

```text
tools/project-metrics/
├── project.json                      # Target de Nx
├── data/
│   ├── sprint.json                   # Entrada manual de las gráficas de sprint
│   └── coverage.json                 # Serie descargada. El script la reescribe
├── src/
│   ├── generate.mjs                  # Arma las especificaciones y escribe los SVG
│   └── fetch-coverage.mjs            # Baja y lee los reportes de GitHub Actions
├── output/                           # SVG generados
└── .cache/
    └── coverage-artifacts.json       # Mediciones ya descargadas, por id de artefacto
```

`.cache/` está en `.gitignore`: solo evita descargar otra vez el mismo zip. `data/coverage.json` sí se puede versionar; es el resultado de la última ejecución, no un archivo que se edite a mano.

## Gráficas

Todas miden 900 por 450 píxeles dentro del SVG.

| Archivo | Título | Qué muestra |
| --- | --- | --- |
| `output/burndown.svg` | Sprint Burndown Chart | Puntos de historia pendientes, día a día. La línea ideal baja de forma uniforme de `totalStoryPoints` a cero en `totalDays`. La línea real resta `completedStoryPoints` de cada día. |
| `output/velocity.svg` | Velocidad del equipo | Barras de puntos planeados y reales por semana. |
| `output/business-value.svg` | Business Value entregado | Business value acumulado, como porcentaje del total de `valueDelivered`. El eje horizontal es el día dividido por `daysPerWeek`, con marcas en cada semana. El eje vertical va de 0 a 100. |
| `output/release-burndown.svg` | Release Burndown Chart | Puntos pendientes al cierre de cada sprint. Lo planeado resta `plannedStoryPoints` de todos los sprints. Lo real resta `completedStoryPoints` solo de los sprints con `closed: true` y se detiene en el primero que sigue abierto. |
| `output/coverage.svg` | Cobertura de código | Cobertura de líneas de Backend, Mobile y Web. El eje va de Semana 1 a Semana 8. |

Colores: azul `#2563EB`, morado `#7C3AED`, verde `#166534`, gris `#94A3B8`.

### Semanas de la cobertura

La Semana 1 empieza el 5 de octubre de 2026 a las 00:00, hora de Colombia (UTC-5), y cada semana dura siete días. El eje muestra ocho semanas, el mismo horizonte de `velocity` y `businessValue` en `sprint.json`. Si una medición cae después de la Semana 8, el eje se extiende para incluirla.

Si en una semana hay varias corridas de CI, la gráfica usa la última de cada aplicación. El tooltip muestra la fecha de esa medición.

## Formato de `data/sprint.json`

Tiene cuatro objetos, con los nombres de campo en inglés.

`sprint` alimenta el burndown del sprint:

- `totalStoryPoints`: puntos comprometidos.
- `totalDays`: duración del sprint en días.
- `days`: un objeto por día, con `day` y `completedStoryPoints` (lo terminado ese día, no el acumulado).

`velocity` es una lista. Cada elemento tiene `week`, `planned` y `actual`.

`businessValue` alimenta la curva acumulada:

- `totalDays` y `daysPerWeek` definen el eje de semanas.
- `dailyValues`: un objeto por día, con `day` y `valueDelivered` (lo entregado ese día).

`releaseBurndown.sprints` es una lista. Cada sprint tiene `sprint`, `plannedStoryPoints`, `completedStoryPoints` y `closed`.

## Requisitos

- Node.js `^22.22.3`, `^24.15.0` o `^26.0.0`, las versiones del campo `engines` del `package.json` raíz.
- Dependencias de la raíz instaladas (`npm ci`). Vega y Vega-Lite están en `devDependencies` del `package.json` raíz; este directorio no tiene `package.json` propio.
- [GitHub CLI](https://cli.github.com/) (`gh`) instalado y autenticado, con permiso de lectura sobre `MISOG6ProyectoFinal/solventa`. La gráfica de cobertura lo necesita para listar y descargar artefactos de Actions.

```bash
gh auth login
gh auth status
```

La primera ejecución, y cualquiera que encuentre artefactos nuevos, necesita red. Las siguientes reutilizan `.cache/coverage-artifacts.json` y solo consultan la API para saber si hay reportes nuevos.

GitHub conserva los artefactos unos 90 días. Cuando uno expira, sale de la lista y desaparece de `data/coverage.json`; la caché local no lo recupera. Para conservar la serie en git, genera la gráfica mientras los reportes sigan disponibles.

## Ejecución

Desde la raíz del repositorio:

```bash
npx nx generate-charts project-metrics
```

El target corre `node src/generate.mjs` con `tools/project-metrics` como directorio de trabajo. Los SVG quedan en `tools/project-metrics/output/`.

También se puede correr el script directamente:

```bash
node tools/project-metrics/src/generate.mjs
```

Se invoca así desde la raíz, o desde `tools/project-metrics`. El script resuelve `data/` y `output/` respecto a su propia carpeta, y Node encuentra `vega` subiendo hasta el `node_modules/` de la raíz.

Al terminar, la consola lista cada SVG y el número de puntos de cobertura en `main`.

## Actualizar los datos

Para las gráficas de sprint, edita `data/sprint.json` y vuelve a ejecutar el comando.

La cobertura no requiere editar JSON: cada ejecución revisa los artefactos actuales de `main` y no vuelve a descargar los ids que ya están en `.cache/coverage-artifacts.json`.

Si un reporte quedó mal leído en la caché, borra `.cache/coverage-artifacts.json` y ejecuta de nuevo. El script descargará otra vez los artefactos que GitHub aún conserve.
