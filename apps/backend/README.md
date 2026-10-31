# Backend de Solventa

Microservicios en Python (FastAPI) que implementan el modelo de componentes VC-003 v2.0. Se despliegan en AWS sobre EKS con Kubernetes (kustomize) y la infraestructura se crea con Terraform, siguiendo el modelo de despliegue VC-004 v2.0.

## Estructura

```
apps/backend/
├── libs/solventa_common/     # Librería compartida
├── services/<servicio>/      # Un servicio por almacén (8), un módulo por componente
├── Dockerfile                # Imagen única: --build-arg SERVICE=<servicio>
├── docker-compose.yml        # PostgreSQL, Redis, LocalStack, Canales y Siniestros
├── scripts/                  # test-all.sh, build-images.sh
└── deploy/
    ├── k8s/base              # Deployments, Services, HPA, PDB, Ingress, NetworkPolicy
    ├── k8s/overlays/aws      # EKS + KEDA para los workers
    ├── k8s/overlays/local    # minikube/kind con dependencias en el clúster
    ├── terraform/modules     # network, ecr, eks, postgres, redis, event_bus, object_storage
    ├── terraform/stacks      # Un estado por stack, en orden de despliegue
    ├── terraform/environments/<env>/<stack>/  # backend.tfvars y terraform.tfvars
    └── scripts/deploy-aws.sh
```

Cada servicio agrupa los componentes del VC-003 que comparten almacén. Cada componente es un módulo con su propio dominio, y separarlo en otro servicio es mover su carpeta:

```
services/<servicio>/<servicio>/
├── config.py          # Settings leídos de variables de entorno
├── main.py            # App FastAPI: monta el router de cada módulo
└── <modulo>/          # Un componente del VC-003
    ├── domain/        # Modelos, puertos y casos de uso, sin FastAPI ni boto3
    ├── adapters/      # Repositorios, clientes y bus
    └── api.py         # Router del componente
```

## Del modelo de componentes al código

La regla es un servicio por almacén de la Tabla 2, que ya asigna cada base a varios componentes. Database-per-Service se mantiene: ningún servicio lee la base de otro. Quedan como despliegue propio los que tienen una razón en los ASR: Pagos por el perímetro PCI, el worker paramétrico porque escala por profundidad de cola (ASR-06) y el Monitor de Salud porque vigila a los demás.

| Servicio | Módulo | Componente VC-003 | Almacén |
|---|---|---|---|
| `canales` | `web`, `movil`, `socios` | BFF Web, BFF Móvil, API Pública de Socios (`/web`, `/movil`, `/socios`) | |
| `cotizacion` (x3) | `rating` | Cotización y Rating | cotizacion |
| | `consenso` | Validador de Consenso | |
| | `catalogo` | Catálogo de Productos | cotizacion |
| | `gobierno_socios` | Socios y Gobierno de API | cotizacion |
| `polizas` | `suscripcion`, `ciclo_vida`, `reaseguro` | Suscripción, Pólizas y Ciclo de Vida, Reaseguro y Cesión | polizas |
| `identidad` | `kyc`, `perfilamiento` | Identidad, Consentimiento y KYC; Perfilamiento y Personalización | identidad |
| `siniestros` | `avisos` | Siniestros | siniestros |
| | `prestadores` | Catálogo de prestadores y consulta geoespacial (PostGIS) | siniestros |
| | `parametrico` | Siniestro Paramétrico + Idempotency Key Validator | siniestros |
| `siniestros-worker` | `parametrico.worker` | Workers de Absorción (Picos), misma imagen que `siniestros` | siniestros |
| `pagos` | `cobros` | Cobros y Pagos | pagos |
| `auditoria` | `linaje`, `analitica`, `notificaciones` | Auditoría y Linaje, Analítica y Fraude, Notificaciones (consumidores del bus) | auditoria |
| `health-monitor` | | Monitor de Salud y Retiro | |
| `solventa_common` | `integration` | Adaptadores por tercero + Circuit Breaker Global | |
| SNS + SQS | | Bus de Eventos + Dead Letter Queue | |

La lógica completa está en los módulos que los experimentos validaron:

- **Cotización y Rating**: reglas de rating como configuración versionada. El servicio corre con 3 réplicas detrás de un Service headless.
- **Operación degradada (HU018)**: Open Finance tiene timeout de 300 ms (`OPEN_FINANCE_TIMEOUT_S`) y un circuit breaker que abre tras `OPEN_FINANCE_BREAKER_FAILURES` fallas (5) y vuelve a probar a los `OPEN_FINANCE_BREAKER_RESET_S` segundos (30). Si el proveedor falla, la cotización usa el último valor bueno de Redis o el valor neutral y queda `degradada`. Cada señal guarda `origen`, `motivo` (`timeout`, `circuito_abierto`, `error_proveedor`, `respuesta_invalida`) y `obtenido_en`, para que actuaría reconstruya la decisión con `GET /consenso/cotizaciones/{id}`.
- **Validador de Consenso**: la réplica que recibe la solicitud llama a las 3 réplicas (incluida ella misma) con timeout de 300 ms y responde con la prima que tiene 2 de 3 votos.
- **Siniestro Paramétrico**: la API recibe el evento externo y lo publica en el bus (202). El worker lo consume, reclama la clave de idempotencia en PostgreSQL y liquida una sola vez aunque el bus reentregue o varias réplicas compitan.
- **Canales**: llaman a los servicios internos con timeout de 1 s y un circuit breaker por servicio destino; un circuito abierto responde 503. Cada llamada abre su propia conexión, sin keep-alive, para que `kube-proxy` la reparta entre todas las réplicas del destino.
- **Monitor de Salud**: latido cada 500 ms a `/health/ready` de cada servicio y retiro tras 2 fallas consecutivas.

Los demás módulos arrancan con su router y el dominio documentado en su `__init__.py`. El siguiente paso es implementar sus casos de uso sobre esa base.

### Librería común

| Módulo | Táctica |
|---|---|
| `health` | `/health/live` y `/health/ready`, consumidos por las probes y el monitor |
| `events` | Publicación en SNS, consumo en SQS (Competing Consumers) |
| `idempotency` | Idempotency Key Validator sobre restricción de unicidad en PostgreSQL |
| `resilience` | Circuit Breaker y Cache-Aside last-known-good sobre Redis |
| `integration` | Adaptadores Open Finance (700 ms), Open Data, KYC/AML, Pasarela de Pagos, ACORD, Firma y Notificación |

## Del modelo de despliegue a AWS

| Nodo VC-004 | AWS | Dónde |
|---|---|---|
| CDN y WAF | CloudFront + WAFv2 | `stacks/edge` |
| Balanceador global + API Gateway | NLB + NGINX Ingress | `stacks/cluster_addons`, `k8s/base/ingress.yaml` |
| Zonas de disponibilidad A y B | VPC con subredes por zona | `stacks/network` |
| Clúster de contenedores por zona | EKS, un node group por zona, pods repartidos por `topologySpreadConstraints` | `stacks/eks` |
| BD relacional primaria + réplica síncrona | RDS PostgreSQL Multi-AZ, una instancia por almacén | `stacks/data` |
| Connection Proxy | RDS Proxy | `modules/postgres` |
| Caché en memoria | ElastiCache Redis con failover entre zonas | `modules/redis` |
| Nodo de mensajería | SNS + SQS con DLQ tras 3 intentos y alarma | `stacks/messaging` |
| Auto-Scaling Group de workers | KEDA sobre `ApproximateNumberOfMessagesVisible` | `k8s/overlays/aws/keda-workers.yaml` |
| Health Monitor | `health_monitor` + readinessProbe de 1 s | `k8s/base` |
| Almacén de objetos (evidencia) | S3 versionado y cifrado | `modules/object_storage` |
| Réplica de lectura (analítica) | Read replica de `auditoria` | `environments/dev/data` |

## Desarrollo local

Requisitos: Python 3.11+, Poetry, Docker.

```bash
cd apps/backend
poetry install
poetry run ./scripts/test-all.sh
```

Para correr un servicio contra PostgreSQL, Redis y LocalStack:

```bash
docker compose up -d postgres redis localstack
cd services/cotizacion
DB_HOST=localhost DB_PORT=5433 DB_NAME=cotizacion DB_USER=solventa DB_PASSWORD=solventa \
  poetry run python -m cotizacion.bootstrap
DB_HOST=localhost DB_PORT=5433 DB_NAME=cotizacion DB_USER=solventa DB_PASSWORD=solventa \
  poetry run uvicorn cotizacion.main:app --reload
```

Los prestadores cercanos (`/movil/prestadores/cercanos`) se consultan en PostGIS, por eso Compose y k3s usan imágenes `postgis/postgis`. El catálogo se carga aparte, con el seed de aliados y los talleres y estaciones de ambulancia de OpenStreetMap. Si OpenStreetMap no responde, queda el seed:

```bash
docker compose run --rm siniestros-prestadores-sync
```

Para el reporte desde el teléfono, el mismo Compose levanta Canales, Siniestros y sus dependencias. Canales queda en el puerto 8000 del equipo. Copie `.env.example` a `.env` y defina `SESION_SECRETO`: identidad firma la sesión y canales la verifica con esa clave.

```bash
docker compose up -d canales
```

Todo el backend en un clúster local, sin cambios en el código, con el modo `local`:

```bash
./deploy/scripts/local.sh up
```

Levanta k3s dentro de Docker, el mismo Kubernetes del modo `ahorro`, y aplica `deploy/k8s/overlays/local`: los mismos manifiestos de AWS, con Postgres en el clúster, Redis y LocalStack en lugar de SNS, SQS y S3. Construye las imágenes de los servicios en la máquina y genera `SESION_SECRETO` dentro del clúster. Solo necesita Docker.

| Dirección | Qué es |
|---|---|
| `http://localhost:8000` | API (`/web`, `/movil`, `/socios`), la misma URL que usa el portal con `npm run start:local` |
| `http://localhost:4566` | LocalStack |

`local.sh status` muestra los pods, `local.sh logs <servicio>` sus logs y `local.sh down` borra el clúster con sus datos. Siniestros corre con `PERSISTENT_STORES=false`, como en `.env.example`, porque con almacenes persistentes el servicio usa siempre el S3 real.

Para tener datos de prueba en cualquier ambiente, `scripts/poblar_datos.py` llama a la API pública de Canales:

```bash
python scripts/poblar_datos.py                                     # modo local
python scripts/poblar_datos.py https://dzwq94g5om86y.cloudfront.net  # dev en AWS
```

Crea 5 socios con sus ramos habilitados, 12 clientes, cotizaciones por los canales móvil, web y de socios, y avisos de siniestro con evidencia. Al pasar por la API, los datos cumplen las mismas reglas del negocio. Se puede correr varias veces: el secreto de cada socio y la contraseña de cada cliente quedan en `scripts/.poblar/<host>.json`, fuera de git, y se reutilizan.

Desde la raíz del monorepo también funcionan `nx test backend`, `nx lint backend`, `nx tf-validate backend` y `nx k8s-render backend --overlay=local`.

## Despliegue en AWS

El despliegue corre en GitHub Actions. El pipeline asume un rol de AWS con OIDC, sin claves de acceso guardadas en el repositorio.

| Workflow | Cuándo corre | Qué hace |
|---|---|---|
| `CI` | Pull request y `main` | Lint y pruebas |
| `Backend Deploy Checks` | Pull request que toca `deploy/` | `terraform fmt` y `validate`, render de manifiestos, build de la imagen |
| `Backend Infra` | Manual, desde `main` | `plan`, `apply` o `destroy` de Terraform, por stack o todos |
| `CD` | Al publicar un release (`v1.2.0`) | Construye las imágenes desde ese tag, las publica en ECR, actualiza los pods y publica el portal web |

Preparación, una sola vez, con un usuario que administre IAM y el repositorio:

```bash
cd apps/backend
ENV=dev ./deploy/scripts/bootstrap-ci.sh
```

Crea el bucket de estados, el rol `solventa-github-deploy-dev` y el Environment `dev` de GitHub con sus variables. Después, en GitHub: **Actions**, **Backend Infra**, **Run workflow** con `plan` y luego con `apply`.

El backend se despliega al publicar un release en GitHub. Para crearlo desde `main`, corra `npm run release` (siguiente parche; `-- minor`, `-- major` o `-- v1.2.0` para otra versión, `-- --draft` para no desplegar todavía, `-- --dry-run` para simular). El tag del release (`v1.2.0`) es la versión de las imágenes en ECR y el registro de lo que corre en el clúster. Volver a una versión anterior es lanzar `CD` a mano con ese tag: las imágenes ya están en ECR y se reutilizan.

`CD` actualiza los pods con rolling update: cada pod nuevo recibe tráfico cuando pasa su readinessProbe y el anterior sale después. Si el rollout no queda sano en 10 minutos, el pipeline vuelve a la revisión anterior y el job falla.

### Modos de despliegue

La variable del repositorio `MODO_DESPLIEGUE` (**Settings, Secrets and variables, Actions, Variables**) elige dónde despliegan `Backend Infra` y `CD`. Si no existe, se usa `ahorro`.

| Modo | Qué crea | Costo estimado encendido | En pausa (`stop`) |
|---|---|---|---|
| `ahorro` | k3s en una EC2 `t3.medium` spot, Postgres dentro del clúster, CloudFront directo a la instancia | ≈ 17 USD al mes | ≈ 7 USD al mes (disco e IP elástica) |
| `eks-costoso` | El modelo VC-004: EKS, RDS, NLB, WAF y KEDA | ≈ 150 USD al mes | ≈ 110 USD al mes |
| `local` | k3s en Docker en la máquina de cada desarrollador (`deploy/scripts/local.sh`) | 0 | |

Los tres usan `deploy/k8s/base`. `ahorro` y `local` comparten además `deploy/k8s/components/k3s`: Postgres en el clúster, ingress de Traefik y una réplica por servicio, con `cotizacion` en 3 por el consenso.

En `ahorro`:

- **Kubernetes:** la instancia instala k3s al arrancar y crea el ConfigMap `solventa-platform`, los Secret `db-*`, `postgres` y `sesion`, y la credencial de ECR, que renueva cada 6 horas.
- **Acceso al clúster:** la API de Kubernetes no se expone. El pipeline entra por un túnel de Session Manager con el kubeconfig que la instancia publica en SSM.
- **Red:** el puerto 80 solo acepta tráfico de CloudFront y no hay WAF ni balanceador.
- **Interrupciones spot:** la instancia se detiene y conserva el disco con los datos de Postgres.
- **Permisos de AWS:** los pods usan el rol de la instancia.

Pasar de `eks-costoso` a `ahorro`:

1. Crear la variable `MODO_DESPLIEGUE` con `ahorro`.
2. Volver a correr `bootstrap-ci.sh`: la política del pipeline suma permisos de EC2, SSM y perfiles de instancia.
3. **Backend Infra**, `apply` con stack `ahorro` y luego con stack `edge`: CloudFront cambia de origen y conserva su dirección.
4. **CD** con la versión vigente.
5. **Backend Infra**, `destroy` con stack `eks-costoso`: borra `platform`, `cluster_addons`, `data` y `eks`, en ese orden.

Las bases del modo anterior no se migran.

`deploy-aws.sh` es el mismo script que usan los workflows y también corre a mano (`plan`, `infra`, `destroy`, `stop`, `start`, `images`, `k8s`, `web`) con `MODO=ahorro` o `MODO=eks-costoso`. En `ahorro`, `infra` aplica `network`, `container_registry`, `messaging`, `ahorro` y `edge`. En `eks-costoso` aplica los stacks en este orden:

| # | Stack | Crea | Depende de |
|---|---|---|---|
| 1 | `network` | VPC, subredes por zona, NAT | |
| 2 | `container_registry` | Un repositorio ECR por servicio | |
| 3 | `eks` | Clúster y node groups por zona | 1 |
| 4 | `data` | RDS por almacén, RDS Proxy, Redis, S3 | 1, 3 |
| 5 | `messaging` | Tópico SNS, colas SQS, DLQ, alarmas | |
| 6 | `cluster_addons` | NGINX Ingress (NLB), KEDA, metrics-server | 3 |
| 7 | `platform` | Namespace, ConfigMap `solventa-platform`, Secret `db-*`, roles de Pod Identity | 3, 4, 5 |
| 8 | `edge` | CloudFront, WAF (solo en `eks-costoso`), bucket del portal web | 3, 6 o `ahorro` |

CloudFront sirve el portal y la API bajo una misma dirección: el portal sale del bucket S3 y las rutas `/web`, `/movil` y `/socios` van al API Gateway. El paso `web` del `CD` compila el portal con esa dirección como URL del backend (`API_BASE_URL`), lo sube al bucket e invalida la caché.

Para una cuenta de AWS Academy, `eks/terraform.tfvars` y `data/terraform.tfvars` reciben el ARN de `LabRole` en `cluster_iam_role_arn`, `node_iam_role_arn` y `proxy_role_arn`, y `platform/terraform.tfvars` usa `create_iam = false`.

### Costos del modo `eks-costoso`

Los tfvars de `dev` usan el perfil más económico de EKS. Cada ahorro es un interruptor:

| Ajuste | Archivo | Valor en `dev` | Para volver al modelo VC-004 |
|---|---|---|---|
| Zonas con nodos | `eks/terraform.tfvars` | `node_zones = 1` | Quitar la línea (usa las dos zonas) |
| Tipo de capacidad | `eks/terraform.tfvars` | `node_capacity_type = "SPOT"` | `"ON_DEMAND"` |
| NAT Gateway | `network/terraform.tfvars` | `nat_gateway = false` (nodos en subred pública) | `true` |
| Instancias de RDS | `data/terraform.tfvars` | `shared_instance`: una instancia con una base por almacén | Quitar el bloque (una instancia por almacén) |
| Redis | `data/terraform.tfvars` | `redis_enabled = false` | `true` |
| Réplicas | `k8s/overlays/aws` | 1 por servicio; `cotizacion` conserva 3 por el consenso | Quitar los parches de réplicas |

La VPC conserva subredes en dos zonas porque EKS y RDS las exigen; las subredes no tienen costo.

`Backend Infra` ofrece dos formas de apagar:

- `stop` y `start`: pausan y reanudan en minutos. En `ahorro` detienen la instancia. En `eks-costoso`, `stop` deja los nodos en 0 y detiene RDS; se siguen pagando el plano de control de EKS, el balanceador y el almacenamiento, y RDS enciende sola una instancia detenida a los 7 días.
- `destroy`: elimina todo y lleva el costo a cero. Volver a crear el ambiente toma cerca de una hora y las bases quedan vacías.

Después de un `apply` que cambie las bases, se lanza `CD` con la versión vigente para que el Job de bootstrap cree las tablas.

`destroy` recorre los stacks en orden inverso (edge, platform, cluster_addons, messaging, data, eks, container_registry, network).

## Prueba de carga

`load-tests/canales.js` es la prueba de carga con [k6](https://grafana.com/docs/k6/) sobre los endpoints que hoy ofrece Canales:

- **Móvil:** registro e inicio de sesión del cliente y, con su token (`Authorization: Bearer`), consulta de sesión, catálogo, cotización y reporte de siniestro con carga, confirmación y listado de evidencia, radicación del aviso y listado de avisos del cliente.
- **Portal web:** cotización asistida, listado, detalle y configuración de socios.
- **API de socios:** cotización embebida con las credenciales de un socio, y la venta completa: cotizar, pagar, emitir la póliza y reintentar la emisión con la misma `Idempotency-Key` (HU015).
- **Open Finance degradado (HU018):** cotizaciones de vida hipotecario con consentimiento mientras un simulador de Open Finance pasa por las fases normal, caído y recuperado.

Antes de empezar, k6 crea un socio de prueba con los ramos de viaje y vida hipotecario habilitados y los alcances de cotización y emisión. `load-tests/run.sh` usa `k6` si está instalado y, si no, la imagen `grafana/k6:2.3.0` con Docker.

```bash
PERFIL=humo ./load-tests/run.sh
PERFIL=carga DURACION=5m ./load-tests/run.sh
PERFIL=asr04 TASA_OBJETIVO=50000 ./load-tests/run.sh
PERFIL=emision TASA_VENTAS=600 DURACION=2m ./load-tests/run.sh
PERFIL=degradacion TASA_SOCIOS=1200 SEGUNDOS_POR_FASE=90 ./load-tests/run.sh
```

El perfil `degradacion` necesita `load-tests/open_finance_simulado.py` corriendo en el equipo (`poetry run python load-tests/open_finance_simulado.py --puerto 9090`) y Cotización apuntando a él con `OPEN_FINANCE_URL`. En el modo `local`, los pods llegan al equipo por `192.168.65.254`:

```bash
docker exec solventa-k3s kubectl -n solventa set env deployment/cotizacion OPEN_FINANCE_URL=http://192.168.65.254:9090
```

| Perfil | Qué ejecuta |
|---|---|
| `humo` | Una iteración por canal, para validar el ambiente |
| `carga` | Usuarios constantes en móvil y portal web, más cotizaciones y ventas de socios a tasa fija |
| `asr04` | Rampa de cotizaciones de socios de `TASA_INICIAL` a `TASA_OBJETIVO` por minuto en `RAMPA` y luego sostenida (ASR-04 y ASR-05) |
| `emision` | Ventas completas de socios a `TASA_VENTAS` por minuto: cotizar, pagar, emitir y reintentar la emisión |
| `degradacion` | Cotizaciones con Open Finance a `TASA_SOCIOS` por minuto. k6 pone el simulador en normal, `MODO_CAIDA` y normal, `SEGUNDOS_POR_FASE` cada uno, y reporta disponibilidad y cotizaciones degradadas por fase |

| Variable | Por defecto | Uso |
|---|---|---|
| `BASE_URL` | URL de CloudFront en `dev` | Ambiente a probar |
| `DURACION` | `2m` | Duración del perfil `carga` |
| `USUARIOS_MOVIL`, `USUARIOS_WEB` | 5 y 2 | Usuarios virtuales por recorrido en `carga` |
| `TASA_SOCIOS` | 600 | Cotizaciones de socios por minuto en `carga` |
| `TASA_VENTAS`, `VUS_VENTAS` | 120 y 20 | Ventas de socios por minuto y usuarios virtuales reservados en `carga` y `emision` |
| `TASA_INICIAL`, `TASA_OBJETIVO` | 500 y 50.000 | Cotizaciones por minuto al inicio y al final de la rampa en `asr04` |
| `RAMPA`, `SOSTENIDO` | `60s` y `5m` | Duración de la subida y del tramo sostenido en `asr04` |
| `VUS_INICIALES`, `VUS_MAXIMOS` | 50 y 1000 | Usuarios virtuales que k6 reserva para sostener la tasa |
| `UMBRAL_COTIZACION_MS` | 400 | p95 máximo de cada cotización (ASR-01) |
| `UMBRAL_P95_MS` | 1000 | p95 máximo del resto de peticiones |
| `UMBRAL_ERRORES` | 1 | Porcentaje máximo de errores por petición |
| `SOCIO_ID`, `SOCIO_CLIENT_ID`, `SOCIO_SECRETO` | Se crea un socio | Reutilizar un socio existente |
| `OPEN_FINANCE_SIMULADO_URL` | `http://host.docker.internal:9090` | Simulador que controla k6 en `degradacion` |
| `SEGUNDOS_POR_FASE`, `MODO_CAIDA` | 60 y `lento` | Duración de cada fase y cómo falla el proveedor (`lento` supera el timeout, `caido` responde 503) |
| `CLIENTES_OPEN_FINANCE` | 200 | Clientes distintos en las cotizaciones de `degradacion`; los repetidos usan el último valor bueno |
| `UMBRAL_DISPONIBILIDAD` | 99.9 | Disponibilidad mínima de cada fase en `degradacion` |

Los resultados quedan en `load-tests/resultados/<fecha>-<perfil>/`:

- `reporte.html`: veredicto, p95 de cotizaciones, cotizaciones por minuto y latencia de cada petición frente a su objetivo.
- `dashboard.html`: el reporte de k6 con las gráficas en el tiempo (peticiones por segundo, latencia, errores y usuarios virtuales).
- `resumen.md`, `resumen.csv` y `resumen.json`: la misma tabla para documentos, hojas de cálculo o comparar corridas.

k6 termina con error si alguna petición supera su p95 o su porcentaje de errores, o si no alcanzó a lanzar todas las iteraciones de la tasa pedida. Las pruebas del reporte corren con `node --test load-tests/`.

Cada corrida crea un socio, cada recorrido móvil un cliente, un aviso de siniestro radicado y una evidencia, y cada venta de socio un cobro aprobado y una póliza en el ambiente.

`postman/recorrido-canales.postman_collection.json` tiene el mismo recorrido para revisarlo a mano en Postman o con Newman. Las peticiones móviles usan el token que guarda **Iniciar sesión** en la variable `token`.

## Siguientes pasos

- Región secundaria del VC-004: réplica asíncrona de RDS en otra región, clúster pasivo y replicación del bus y de S3.
- Perímetro PCI de `pagos`: red y accesos separados con Security Groups for Pods o una cuenta dedicada.
- Certificado ACM en el NLB para cifrar el tramo CloudFront → API Gateway.
- Casos de uso de los módulos que hoy exponen su base.
