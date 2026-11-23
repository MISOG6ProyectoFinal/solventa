# Solventa

Solventa es una plataforma de seguros digitales. Los clientes cotizan y compran pólizas y reportan siniestros desde la app móvil; los operadores gestionan pólizas, socios y usuarios desde el portal web.

## Proyectos del monorepo

| Proyecto | Carpeta | Documentación |
| --- | --- | --- |
| Backend: microservicios en Python (FastAPI) desplegados en AWS | `apps/backend` | [README](apps/backend/README.md) |
| App móvil en React Native | `apps/mobile` | [README](apps/mobile/README.md) |
| Pruebas E2E de la app móvil con Maestro | `apps/mobile-e2e` | [README](apps/mobile-e2e/README.md) |
| Portal web: shell Angular con micro frontends | `apps/web/Web.Solventa.Angular` | [README](apps/web/Web.Solventa.Angular/README.md) |
| Gráficas de seguimiento del proyecto | `tools/project-metrics` | [README](tools/project-metrics/README.md) |

## Cómo empezar

Cada README explica los requisitos, la instalación y los comandos de su proyecto. La app móvil y el portal web consumen el backend, así que para trabajar en local conviene levantar primero el backend.

## Documentación

- Documentación técnica: [wiki del proyecto](https://github.com/MISOG6ProyectoFinal/solventa/wiki/Documentacion-Tecnica).
- Manuales de usuario, en [`docs/manuales/`](docs/manuales/):
  - [Guía de uso de Solventa móvil](docs/manuales/guia-de-uso-solventa-movil.pdf)
  - [Guía de uso del portal web de Solventa](docs/manuales/guia-de-uso-solventa-portal-web.pdf)
- [Accesibilidad de la app móvil](docs/accesibilidad-mobile.md).
- Experimentos de arquitectura: [Experimento 1](experimentation/Experiment1/README.md) y [Experimento 2](experimentation/Experiment2/README.md).
