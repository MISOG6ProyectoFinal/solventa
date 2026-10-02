# Backend de Solventa

Microservicios en Python (FastAPI) que implementan el modelo de componentes VC-003 v2.0. Se despliegan en AWS sobre EKS con Kubernetes (kustomize) y la infraestructura se crea con Terraform, siguiendo el modelo de despliegue VC-004 v2.0.

## Estructura

```
apps/backend/
├── libs/solventa_common/     # Librería compartida
├── services/<servicio>/      # Un microservicio por capacidad (19)
├── Dockerfile                # Imagen única: --build-arg SERVICE=<servicio>
├── docker-compose.yml        # PostgreSQL, Redis y LocalStack para desarrollo
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

Cada servicio sigue la misma organización hexagonal:

```
services/<servicio>/<servicio>/
├── config.py          # Settings leídos de variables de entorno
├── domain/            # Modelos, puertos y casos de uso, sin FastAPI ni boto3
├── adapters/          # Repositorios, clientes y bus
└── entrypoints/       # api.py (FastAPI) y, si aplica, worker.py
```

## Del modelo de componentes al código

| Capa | Componente | Servicio | Almacén |
|---|---|---|---|
| Exposición | BFF Web | `bff_web` (`/web`) | |
| Exposición | BFF Móvil | `bff_movil` (`/movil`) | |
| Exposición | API Pública de Socios | `api_socios` (`/socios`) | |
| Exposición | Monitor de Salud y Retiro | `health_monitor` | |
| Negocio | Cotización y Rating (x3) | `cotizacion_rating` | cotizacion |
| Negocio | Validador de Consenso | `validador_consenso` | |
| Negocio | Suscripción | `suscripcion` | polizas |
| Negocio | Pólizas y Ciclo de Vida | `polizas` | polizas |
| Negocio | Catálogo de Productos | `catalogo_productos` | cotizacion |
| Negocio | Perfilamiento y Personalización | `perfilamiento` | identidad |
| Negocio | Identidad, Consentimiento y KYC | `identidad_kyc` | identidad |
| Negocio | Siniestros | `siniestros` | siniestros |
| Negocio | Siniestro Paramétrico + Idempotency Key Validator | `siniestro_parametrico` | siniestros |
| Negocio | Workers de Absorción (Picos) | `siniestro_parametrico` (worker) | siniestros |
| Negocio | Cobros y Pagos | `cobros_pagos` | pagos |
| Negocio | Socios y Gobierno de API | `socios_gobierno_api` | cotizacion |
| Negocio | Analítica, Fraude y Cumplimiento | `analitica_fraude` | auditoria |
| Negocio | Notificaciones | `notificaciones` | |
| Negocio | Reaseguro y Cesión | `reaseguro` | polizas |
| Negocio | Auditoría y Linaje del Dato | `auditoria_linaje` | auditoria |
| Integración | Adaptadores por tercero + Circuit Breaker Global | `solventa_common.integration` | |
| Integración | Bus de Eventos + Dead Letter Queue | SNS + SQS (`event_bus`) | |

La lógica completa está en los servicios que los experimentos validaron:

- **Cotización y Rating**: reglas de rating como configuración versionada. Corre con 3 réplicas detrás de un Service headless.
- **Validador de Consenso**: llama a las 3 réplicas en paralelo con timeout de 300 ms y responde con la prima que tiene 2 de 3 votos.
- **Siniestro Paramétrico**: la API recibe el evento externo y lo publica en el bus (202). El worker lo consume, reclama la clave de idempotencia en PostgreSQL y liquida una sola vez aunque el bus reentregue o varias réplicas compitan.
- **BFF y API de socios**: llaman a los servicios internos con timeout de 1 s y circuit breaker; un circuito abierto responde 503.
- **Monitor de Salud**: latido cada 500 ms a `/health/ready` de cada servicio y retiro tras 2 fallas consecutivas.

Los demás servicios arrancan con su endpoint de salud, su almacén asignado y el dominio documentado en `domain/__init__.py`. El siguiente paso es implementar sus casos de uso sobre esa base.

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
docker compose up -d
cd services/cotizacion_rating
DB_HOST=localhost DB_NAME=cotizacion DB_USER=solventa DB_PASSWORD=solventa \
  poetry run uvicorn cotizacion_rating.entrypoints.api:app --reload
```

Todo el backend en minikube:

```bash
eval $(minikube docker-env)
TAG=latest ./scripts/build-images.sh
kubectl apply -k deploy/k8s/overlays/local
```

Desde la raíz del monorepo también funcionan `nx test backend`, `nx lint backend`, `nx tf-validate backend` y `nx k8s-render backend --overlay=local`.

## Despliegue en AWS

Requisitos: AWS CLI con credenciales, Terraform 1.10+, kubectl, Docker y un bucket S3 para los estados (`solventa-terraform-state-dev` en `environments/dev`).

```bash
cd apps/backend
ENV=dev ./deploy/scripts/deploy-aws.sh all
```

`all` ejecuta tres pasos que también corren por separado:

1. `infra`: aplica los stacks en orden.

   | # | Stack | Crea | Depende de |
   |---|---|---|---|
   | 1 | `network` | VPC, subredes por zona, NAT | |
   | 2 | `container_registry` | Un repositorio ECR por servicio | |
   | 3 | `eks` | Clúster y node groups por zona | 1 |
   | 4 | `data` | RDS por almacén, RDS Proxy, Redis, S3 | 1, 3 |
   | 5 | `messaging` | Tópico SNS, colas SQS, DLQ, alarmas | |
   | 6 | `cluster_addons` | NGINX Ingress (NLB), KEDA, metrics-server | 3 |
   | 7 | `platform` | Namespace, ConfigMap `solventa-platform`, Secret `db-*`, roles de Pod Identity | 3, 4, 5 |

2. `images`: construye las 19 imágenes y las publica en ECR con el tag del commit.
3. `k8s`: renderiza `deploy/k8s/overlays/aws` con las imágenes de ECR y lo aplica.

El borde (CloudFront + WAF) se aplica aparte con `deploy-aws.sh edge`, cuando el NLB del ingress ya existe.

Para una cuenta de AWS Academy, `eks/terraform.tfvars` y `data/terraform.tfvars` reciben el ARN de `LabRole` en `cluster_iam_role_arn`, `node_iam_role_arn` y `proxy_role_arn`, y `platform/terraform.tfvars` usa `create_iam = false`.

Para destruir, se aplica `terraform destroy` en orden inverso (edge, platform, cluster_addons, messaging, data, eks, container_registry, network).

## Siguientes pasos

- Región secundaria del VC-004: réplica asíncrona de RDS en otra región, clúster pasivo y replicación del bus y de S3.
- Perímetro PCI de `pagos`: red y accesos separados con Security Groups for Pods o una cuenta dedicada.
- Certificado ACM en el NLB para cifrar el tramo CloudFront → API Gateway.
- Casos de uso de los servicios que hoy exponen su base.
