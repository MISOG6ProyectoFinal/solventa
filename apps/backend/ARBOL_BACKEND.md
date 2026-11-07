# Estructura y Estado del Proyecto Backend de Solventa

Documento de mapeo integral del árbol de directorios, arquitectura, estado de implementación y despliegue del backend de Solventa, alineado con el modelo de componentes **VC-003 v2.0** y el modelo de despliegue **VC-004 v2.0**.

---

## 1. Resumen Ejecutivo de Arquitectura

El backend de Solventa es una arquitectura de microservicios implementada en **Python 3.11+ con FastAPI**, diseñada para alta resiliencia, escalabilidad elástica y tolerancia a fallos en **AWS (EKS, RDS Multi-AZ, S3, ElastiCache Redis, SNS/SQS)**.

### Principios Fundamentales Implementados
1. **Database-per-Service (Almacenes Aislados)**: Cada dominio de datos cuenta con su propio almacén relacional (`cotizacion`, `polizas`, `siniestros`, `identidad`, `pagos`, `auditoria`). Ningún microservicio accede a la base de datos de otro.
2. **Consenso Bizantino en Cotización**: Tres réplicas independientes de cotización corren detrás de un Kubernetes Headless Service. Al solicitar una cotización, la réplica receptora consulta en paralelo a las 3 réplicas (con timeout estricto de 300 ms) y resuelve la oferta solo si existe mayoría (2 de 3 votos idénticos), evitando discrepancias de tarificación.
3. **Absorción de Picos e Idempotencia en Siniestros**: La recepción de eventos paramétricos responde `202 Accepted` de inmediato y deposita el evento en un bus SNS/SQS. Workers dedicados escalados por **KEDA** consumen la cola, validan claves de idempotencia sobre restricciones de unicidad en PostgreSQL y liquidan una sola vez.
4. **Carga Segura de Evidencias a Almacén de Objetos**: Siniestros gestiona la radicación de avisos y subida de evidencias usando URLs prefirmadas de **AWS S3 / Object Store**, sin saturar el tráfico del backend con archivos binarios.
5. **BFF Especializados (Canales)**: Capa de entrada diferenciada para Móvil (`/movil`), Web (`/web`) y Socios externos (`/socios/v1`), con Circuit Breakers individuales por servicio destino para evitar fallas en cascada.
6. **Observabilidad y Health Checking Activo**: Monitor de salud (`health_monitor`) que ejecuta sondeos de latido cada 500 ms contra `/health/ready` de cada servicio, retirando lógicamente pods ante fallas repetidas.

---

## 2. Árbol de Directorios Completo (`apps/backend/`)

```text
apps/backend/
├── Dockerfile                      # Imagen Docker multi-stage unificada (--build-arg SERVICE=<servicio>)
├── README.md                       # Documentación operativa, local y despliegue
├── docker-compose.yml              # Orquestación local (PostgreSQL 17, Redis 7, LocalStack 3, microservicios)
├── poetry.lock                     # Lockfile de dependencias Poetry del backend
├── poetry.toml                     # Configuración de Poetry (virtualenvs en proyecto)
├── project.json                    # Configuración del proyecto en el monorepo Nx
├── pyproject.toml                  # Metadatos del paquete y configuración de Pytest/Coverage
│
├── deploy/                         # Infraestructura como Código (IaC) y Manifiestos K8s
│   ├── iam/                        # Políticas IAM para despliegues OIDC
│   │   └── solventa-deployer-policy.json
│   ├── k8s/                        # Manifiestos de Kubernetes (Kustomize)
│   │   ├── base/                   # Recursos base comunes a todos los entornos
│   │   │   ├── ingress.yaml        # NGINX Ingress Controller enrutando /web, /movil y /socios a canales
│   │   │   ├── kustomization.yaml  # Configuración base de Kustomize
│   │   │   ├── network-policy.yaml # Políticas de aislamiento de red entre pods
│   │   │   ├── serviceaccount.yaml # ServiceAccount con Pod Identity
│   │   │   ├── services-config.yaml# ConfigMap global de variables compartidas
│   │   │   └── services/           # Deployments, Services, HPAs y PDBs por microservicio
│   │   │       ├── auditoria.yaml
│   │   │       ├── canales.yaml
│   │   │       ├── cotizacion.yaml # Incluye headless Service (cotizacion-replicas) y Job de bootstrap
│   │   │       ├── health-monitor.yaml
│   │   │       ├── identidad.yaml
│   │   │       ├── pagos.yaml
│   │   │       ├── polizas.yaml
│   │   │       ├── siniestros-worker.yaml # Deployment del worker para consumo de colas
│   │   │       └── siniestros.yaml
│   │   └── overlays/               # Variaciones por ambiente
│   │       ├── aws/                # Despliegue sobre Amazon EKS
│   │       │   ├── keda-workers.yaml  # ScaledObject KEDA para siniestros-worker basado en SQS
│   │       │   └── kustomization.yaml # Parches de réplicas y recursos para AWS
│   │       └── local/              # Despliegue local (Minikube / Kind)
│   │           ├── dependencies.yaml  # PostgreSQL, Redis y LocalStack dentro del clúster
│   │           ├── init-aws.sh        # Creación de bucket S3 y colas SNS/SQS en LocalStack
│   │           ├── init-databases.sql # Creación de las 6 bases de datos en PostgreSQL
│   │           ├── kustomization.yaml
│   │           └── namespace.yaml
│   ├── scripts/                    # Scripts de automatización de despliegue
│   │   ├── bootstrap-ci.sh         # Creación de bucket S3 para Terraform state y rol OIDC
│   │   ├── deploy-aws.sh           # Automatización de stacks Terraform y despliegue K8s
│   │   ├── set-image-tag.sh        # Inyección de versión de imagen en kustomize
│   │   └── tf-validate.mjs         # Validador de Terraform para Nx
│   └── terraform/                  # Stacks modulares de infraestructura en AWS
│       ├── environments/
│       │   └── dev/                # Variables y perfiles económicos para desarrollo
│       ├── modules/                # Módulos reutilizables
│       │   ├── ecr/                # Repositorios ECR por servicio
│       │   ├── eks/                # Clúster EKS y node groups
│       │   ├── event_bus/          # Tópicos SNS y colas SQS
│       │   ├── network/            # VPC, subredes multi-AZ, tablas de ruteo, NAT
│       │   ├── object_storage/     # Buckets S3 cifrados y versionados
│       │   ├── postgres/           # Instancias RDS PostgreSQL y RDS Proxy
│       │   └── redis/              # Clúster ElastiCache Redis
│       └── stacks/                 # Stacks desplegables en orden de dependencia
│           ├── 1_network/          # Red VPC y subredes
│           ├── 2_container_registry/# Repositorios de imágenes Docker
│           ├── 3_eks/              # Cómputo Kubernetes
│           ├── 4_data/             # Bases de datos RDS, Redis y S3
│           ├── 5_messaging/        # Bus de eventos SNS + SQS + DLQ
│           ├── 6_cluster_addons/   # NGINX Ingress, KEDA y Metrics Server
│           ├── 7_platform/         # ConfigMaps, Secretos y Roles Pod Identity
│           ├── 8_edge/             # CloudFront, AWS WAFv2 y S3 del Portal Web
│           └── github_oidc/        # Integración de GitHub Actions sin llaves fijas
│
├── libs/                           # Librerías compartidas
│   └── solventa_common/            # Paquete común del ecosistema Solventa
│       ├── pyproject.toml
│       ├── solventa_common/
│       │   ├── __init__.py
│       │   ├── app.py              # Fábrica FastAPI común, middlewares, /health/live y /health/ready
│       │   ├── db.py               # Gestión de SQLAlchemy Engine, pooling y readiness checks
│       │   ├── events.py           # Abstracción SNS (publicador) y SQS (consumidor en hilo)
│       │   ├── health.py           # Probes estándar de Kubernetes
│       │   ├── idempotency.py      # Gestor de unicidad e idempotencia en PostgreSQL
│       │   ├── logging.py          # Formato de logs estructurados
│       │   ├── resilience.py       # Patrón Circuit Breaker y Cache-Aside last-known-good con Redis
│       │   ├── settings.py         # Configuración base vía pydantic-settings
│       │   └── integration/        # Adaptadores y clientes externos
│       │       ├── __init__.py
│       │       ├── base.py         # Clase base ExternalAdapter y ServiceClient con Circuit Breaker
│       │       └── adapters.py     # Adaptadores a Open Finance, Open Data, KYC, Pasarela, ACORD, Firmas
│       └── tests/                  # Pruebas unitarias de la librería común (100% cobertura)
│
├── postman/                        # Colecciones de pruebas de integración de API
│   └── reporte-movil.postman_collection.json
│
├── scripts/                        # Scripts utilitarios para desarrollo
│   ├── build-images.sh             # Compilación de imágenes Docker de todos los microservicios
│   ├── test-all.sh                 # Ejecución de pytest + cobertura consolidada (mínimo 85%)
│   ├── close-device-ports.ps1
│   └── open-device-ports.ps1
│
└── services/                       # Servicios de Negocio (Database-per-Service)
    │
    ├── cotizacion/                 # SERVICIO: COTIZACIÓN (Base: cotizacion) [COMPLETO]
    │   ├── pyproject.toml
    │   ├── cotizacion/
    │   │   ├── bootstrap.py        # Migraciones y seed de datos iniciales
    │   │   ├── config.py           # Ajustes del servicio (quórum, timeouts, DB)
    │   │   ├── container.py        # Inyector de dependencias (Postgres vs InMemory/Fanout)
    │   │   ├── main.py             # App FastAPI montando rating, consenso, catálogo y socios
    │   │   ├── rating/             # Módulo: Cálculo de prima individual
    │   │   │   ├── api.py          # POST /cotizaciones/calcular
    │   │   │   └── domain/         # Motor de tarificación y reglas de cálculo
    │   │   ├── consenso/           # Módulo: Validador de Quórum Bizantino
    │   │   │   ├── api.py          # POST /consenso/cotizaciones (con header X-Canal)
    │   │   │   ├── adapters/       # Repositorio PostgreSQL y cliente HTTP de réplicas
    │   │   │   └── domain/         # Algoritmo de consenso (2 de 3 votos en <300ms)
    │   │   ├── catalogo/           # Módulo: Catálogo Comercial de Productos
    │   │   │   ├── api.py          # GET /catalogo/productos
    │   │   │   ├── adapters/       # Repositorio PostgreSQL y semilla de datos (seed)
    │   │   │   └── domain/         # Modelos y filtros por canal (móvil vs web)
    │   │   └── gobierno_socios/    # Módulo: Onboarding y Gobierno de APIs de Socios
    │   │       ├── api.py          # Gestión de socios, credenciales y cotización B2B
    │   │       ├── adapters/       # Persistencia de socios y configuraciones
    │   │       └── domain/         # Reglas de alcance, ramos/coberturas habilitados
    │   └── tests/                  # Suite integral de pruebas (12 archivos de test)
    │
    ├── siniestros/                 # SERVICIO: SINIESTROS Y PARAMÉTRICOS (Base: siniestros) [COMPLETO]
    │   ├── pyproject.toml
    │   ├── siniestros/
    │   │   ├── config.py           # Ajustes de base de datos, S3 y bus de eventos
    │   │   ├── main.py             # App FastAPI montando avisos y siniestro paramétrico
    │   │   ├── avisos/             # Módulo: Radicación y Evidencias
    │   │   │   ├── api.py          # POST /avisos, cargas de evidencias prefirmadas y confirmación
    │   │   │   ├── adapters/       # S3ObjectStore, PostgresAvisoRepository, InMemory
    │   │   │   └── domain/         # Casos de uso de carga y consulta de evidencias
    │   │   └── parametrico/        # Módulo: Siniestro Paramétrico y Worker
    │   │       ├── api.py          # POST /parametricos/eventos (202 Accepted al bus)
    │   │       ├── worker.py       # Worker asíncrono con reclamo de clave de idempotencia
    │   │       ├── adapters/       # Publicador de bus y repositorio de idempotencia
    │   │       └── domain/         # Reglas de liquidación paramétrica determinística
    │   └── tests/                  # Suite integral de pruebas (8 archivos de test)
    │
    ├── canales/                    # SERVICIO: BFF CANALES (Sin base de datos propia) [COMPLETO]
    │   ├── pyproject.toml
    │   ├── canales/
    │   │   ├── clients.py          # Clientes HTTP internos con Circuit Breakers por servicio
    │   │   ├── config.py           # URLs de upstream y configuración CORS
    │   │   ├── main.py             # App FastAPI montando /movil, /web y /socios
    │   │   ├── movil/              # BFF Móvil: validación de formularios y cotizaciones
    │   │   ├── web/                # BFF Web: cotización, socios y consulta de pólizas
    │   │   └── socios/             # API Pública de Socios: autenticación por headers API Key
    │   └── tests/                  # Pruebas de API y flujo móvil
    │
    ├── health_monitor/             # SERVICIO: MONITOR DE SALUD Y RETIRO [COMPLETO]
    │   ├── pyproject.toml
    │   ├── health_monitor/
    │   │   ├── config.py           # Intervalo de latido (500ms), timeout y targets
    │   │   ├── main.py             # Bucle asyncio continuo de sondeo y reporte
    │   │   └── domain/             # Lógica de retiro tras 2 fallas consecutivas
    │   └── tests/                  # Pruebas de detección y retiro
    │
    ├── auditoria/                  # SERVICIO: AUDITORÍA Y LINAJE (Base: auditoria) [ESTRUCTURA + BUS]
    │   ├── pyproject.toml
    │   ├── auditoria/
    │   │   ├── config.py           # Conexión DB y cola de eventos SQS
    │   │   ├── main.py             # Lifespan con background consumer SQS
    │   │   ├── linaje/             # Router HTTP y handler de eventos de linaje del dato
    │   │   ├── analitica/          # Router HTTP y handler de eventos de analítica/fraude
    │   │   └── notificaciones/     # Router HTTP y handler de notificaciones
    │   └── tests/
    │
    ├── polizas/                    # SERVICIO: PÓLIZAS Y CICLO DE VIDA (Base: polizas) [ESQUELETO BASE]
    │   ├── pyproject.toml
    │   ├── polizas/
    │   │   ├── config.py
    │   │   ├── main.py             # Routers de suscripción, ciclo de vida y reaseguro
    │   │   ├── suscripcion/        # API inicial de suscripción
    │   │   ├── ciclo_vida/         # API inicial de ciclo de vida
    │   │   └── reaseguro/          # API inicial de reaseguro y cesión
    │   └── tests/
    │
    ├── identidad/                  # SERVICIO: IDENTIDAD Y KYC (Base: identidad) [ESQUELETO BASE]
    │   ├── pyproject.toml
    │   ├── identidad/
    │   │   ├── config.py
    │   │   ├── main.py             # Routers de KYC y perfilamiento
    │   │   ├── kyc/                # API inicial de KYC y consentimiento
    │   │   └── perfilamiento/      # API inicial de perfilamiento y personalización
    │   └── tests/
    │
    └── pagos/                      # SERVICIO: COBROS Y PAGOS [PCI-DSS] (Base: pagos) [ESQUELETO BASE]
        ├── pyproject.toml
        ├── pagos/
        │   ├── config.py
        │   ├── main.py             # Router de cobros
        │   └── cobros/             # API inicial de cobros y conciliación
        └── tests/
```

---

## 3. Estado de Avance por Componente

| Microservicio / Capa | Almacén / DB | Estado de Avance | Lo que está implementado | Lo que está pendiente |
|---|---|---|---|---|
| **`solventa_common`** | N/A | **100% Completado** | Circuit Breaker, Cache-Aside Redis, Idempotency, Bus SNS/SQS, Probes k8s, Adaptadores externos. | Integración con proveedores reales en producción. |
| **`cotizacion`** | `cotizacion` (PostgreSQL) | **100% Funcional** | Rating versionado, Consenso bizantino (3 réplicas, 2/3 quórum, <300ms), Catálogo y seeds, Gobierno de socios (KAN-40, KAN-42). | Conexión con motor de suscripción formal de pólizas. |
| **`siniestros`** | `siniestros` (PostgreSQL) + S3 | **100% Funcional** | Radicación de avisos, URLs prefirmadas S3 para evidencias, Siniestro paramétrico (202), Worker con clave de idempotencia. | Automatización de reglas complejas de ajuste de siniestro no paramétrico. |
| **`canales`** | Sin base propia | **100% Funcional** | BFF Móvil con validación, BFF Web para portal, API Pública de Socios con API Keys, Circuit Breakers independientes. | Autenticación OAuth2/JWT para usuarios finales de los canales. |
| **`health_monitor`** | Memoria | **100% Funcional** | Sondeo de latido cada 500 ms a `/health/ready`, umbral de 2 fallas consecutivas, endpoint `/monitor/estado`. | Envío de telemetría y métricas directas a CloudWatch/Prometheus. |
| **`auditoria`** | `auditoria` (PostgreSQL) | **Fase 1 (Esqueleto + Bus)** | Consumidor en segundo plano de SQS, despacho a handlers de linaje, analítica y notificaciones. | Modelos de persistencia de tablas y lógica de detección de fraude. |
| **`polizas`** | `polizas` (PostgreSQL) | **Fase 1 (Esqueleto Base)** | Estructura modular, routers FastAPI, configuración y base de datos asignada. | Casos de uso de emisión, anulación, endosos y cesión de reaseguro. |
| **`identidad`** | `identidad` (PostgreSQL) | **Fase 1 (Esqueleto Base)** | Routers FastAPI de KYC y perfilamiento, estructura modular y base asignada. | Conexión con adaptadores de listas restrictivas y scoring de perfil. |
| **`pagos`** | `pagos` (PostgreSQL) | **Fase 1 (Esqueleto Base)** | Router FastAPI de cobros, preparación para aislamiento PCI. | Integración con pasarela de pago y lógica de tokenización de tarjetas. |
| **Infraestructura (`deploy`)**| AWS / K8s / Local | **100% Funcional** | 8 stacks de Terraform, Kustomize base + local + aws, KEDA para workers, CI/CD en GitHub Actions con OIDC. | Réplica en región secundaria de AWS (DR multi-región). |

---

## 4. Guía Rápida para Levantar y Probar Localmente

1. **Requisitos**: Docker, Docker Compose, Python 3.11+.
2. **Levantar dependencias locales (Postgres, Redis, LocalStack)**:
   ```bash
   cd apps/backend
   docker compose up -d postgres redis localstack
   ```
3. **Levantar el flujo completo de Cotización y Siniestros vía Canales**:
   ```bash
   docker compose up -d canales
   # Canales queda disponible en http://localhost:8000
   ```
4. **Verificar estado de salud**:
   ```bash
   curl http://localhost:8000/health/ready
   ```
