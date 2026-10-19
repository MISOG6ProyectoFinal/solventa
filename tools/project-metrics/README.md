# Métricas del proyecto

Esta herramienta genera las gráficas de seguimiento del proyecto: burndown del sprint, velocidad, business value, burndown del release y cobertura de código. El resultado son archivos SVG en `output/`.

Las cuatro primeras salen de `data/sprint.json`, que se edita a mano. La de cobertura sale de los artefactos de GitHub Actions de la rama `main`.

## Qué hace el script

`src/generate.mjs` lee los datos, arma una especificación de [Vega-Lite](https://vega.github.io/vega-lite/) por gráfica, la compila con Vega y escribe el SVG. No abre un navegador y no publica las imágenes.

Al final llama a `src/fetch-coverage.mjs`, que consulta GitHub, descarga los reportes de cobertura que todavía no están en caché y deja la serie en `data/coverage.json`. Con esa serie se genera `output/coverage.svg`.

Si un reporte no se puede leer, ese punto se omite y el script sigue. Si `gh` falla, o si no queda ningún punto de cobertura, el proceso termina con código 1. En ese caso las otras cuatro gráficas ya quedaron escritas.

## Cómo funciona

1. Lee `data/sprint.json`.
2. Crea `output/` si no existe.
3. Escribe `burndown.svg`, `velocity.svg`, `business-value.svg` y `release-burndown.svg`.
4. Con `gh`, lista los artefactos del repositorio `MISOG6ProyectoFinal/solventa`.
5. Se queda con los de la rama `main` que todavía no expiraron y cuyo nombre es uno de estos:
   - `backend-test-reports`
   - `mobile-test-reports`
   - `web-test-reports`
6. Descarga solo los que no están en `.cache/coverage-artifacts.json`. Lo hace de a cuatro a la vez, en un directorio temporal, y borra ese directorio al terminar.
7. Calcula el porcentaje de líneas cubiertas y guarda cada artefacto en la caché.
8. Escribe `data/coverage.json` con todos los puntos vigentes y genera `coverage.svg`.

La cobertura es de líneas, con un decimal:

- Backend: atributo `line-rate` del elemento `coverage` en `coverage.xml` (Cobertura).
- Mobile y Web: suma de `LH` dividida por la suma de `LF` en `lcov.info`.

Esos archivos los sube el workflow `.github/workflows/ci.yml` cuando el proyecto correspondiente está afectado. Un push que no toca Mobile no deja un punto de Mobile. Por eso las tres series no tienen la misma cantidad de mediciones.

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

`.cache/` está en `.gitignore`. No hace falta versionarla: solo evita volver a bajar el mismo zip. `data/coverage.json` sí se puede versionar. Es el resultado de la última ejecución, no una fuente que se edite.

`data/sprint.json` es la fuente de las otras cuatro gráficas. El script no lo modifica.

## Gráficas

Todas miden 900 por 450 píxeles dentro del SVG.

| Archivo | Título | Qué muestra |
| --- | --- | --- |
| `output/burndown.svg` | Sprint Burndown Chart | Puntos de historia que faltan, día a día. La línea ideal baja parejo de `totalStoryPoints` a cero en `totalDays`. La línea real resta `completedStoryPoints` de cada día. |
| `output/velocity.svg` | Velocidad del equipo | Barras de puntos planeados y reales por semana. |
| `output/business-value.svg` | Business Value entregado | Business value acumulado. El eje horizontal es el día dividido por `daysPerWeek`, con marcas en cada semana. El eje vertical va de 0 a 100. |
| `output/release-burndown.svg` | Release Burndown Chart | Puntos que faltan al cierre de cada sprint. Lo planeado resta `plannedStoryPoints` de todos los sprints. Lo real resta `completedStoryPoints` solo de los sprints con `closed: true`, y se detiene en el primero que sigue abierto. |
| `output/coverage.svg` | Cobertura de código | Cobertura de líneas de Backend, Mobile y Web. El eje va de Semana 1 a Semana 8. |

Colores: azul `#2563EB`, morado `#7C3AED`, verde `#166534`, gris `#94A3B8`.

### Semanas de la cobertura

La Semana 1 empieza el 5 de octubre de 2026 a las 00:00, hora de Colombia (UTC-5). Cada semana dura siete días. El eje muestra ocho semanas, el mismo horizonte que `velocity` y `businessValue` en `sprint.json`. Si una medición cae después de la Semana 8, el eje crece para incluirla.

En una misma semana puede haber varias corridas de CI. La gráfica usa la última de cada aplicación en esa semana. El tooltip conserva la fecha de esa medición.

## Forma de `data/sprint.json`

Cuatro objetos. Los nombres de los campos están en inglés.

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

- Node.js `^22.22.3`, `^24.15.0` o `^26.0.0`, las versiones del campo `engines` de la raíz del repo.
- Dependencias de la raíz instaladas (`npm ci`). Vega y Vega-Lite están en `devDependencies` del `package.json` raíz. Este directorio no tiene su propio `package.json`.
- [GitHub CLI](https://cli.github.com/) (`gh`) instalado y autenticado, con permiso de lectura sobre `MISOG6ProyectoFinal/solventa`. Hace falta para la gráfica de cobertura, porque el script lista y descarga artefactos de Actions.

```bash
gh auth login
gh auth status
```

La primera ejecución, o cualquiera que encuentre artefactos nuevos, necesita red. Las siguientes reutilizan `.cache/coverage-artifacts.json` y solo vuelven a llamar a la API para saber si hay reportes nuevos.

GitHub conserva los artefactos unos 90 días. Cuando uno expira, deja de aparecer en la lista y desaparece de `data/coverage.json`. La caché local no lo recupera. Conviene generar la gráfica mientras los reportes siguen disponibles si se quiere conservar la serie en git.

## Cómo ejecutarlo

Desde la raíz del repositorio:

```bash
npx nx generate-charts project-metrics
```

Ese target corre `node src/generate.mjs` con el directorio de trabajo en `tools/project-metrics`. Los SVG quedan en `tools/project-metrics/output/`.

También se puede correr el script directo:

```bash
node tools/project-metrics/src/generate.mjs
```

Hay que invocarlo así, desde la raíz, o entrando antes a `tools/project-metrics`. El script resuelve `data/` y `output/` respecto a su propia carpeta, y Node encuentra `vega` subiendo hasta `node_modules/` de la raíz.

Al terminar, la consola lista cada SVG y el conteo de puntos de cobertura en `main`. Un error de un artefacto concreto se imprime y no detiene el resto. Un fallo de `gh`, o cero puntos de cobertura, sí detiene el proceso con código 1.

## Cómo actualizar los datos

Para las gráficas de sprint, edita `data/sprint.json` y vuelve a ejecutar el comando. No hay otro paso.

Para la cobertura no hay que editar JSON. Cada ejecución mira los artefactos actuales de `main`. Los ids que ya están en `.cache/coverage-artifacts.json` no se descargan otra vez.

Si un reporte quedó mal parseado en la caché, borra `.cache/coverage-artifacts.json` y ejecuta de nuevo. El script volverá a bajar los artefactos que GitHub todavía tenga.
