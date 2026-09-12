# Experimento 1: Continuidad de la cotización ante la caída de una instancia

Solventa, Grupo 6

## 1. Título del experimento

Continuidad de la cotización ante la caída de una instancia.

## 2. Propósito del experimento

Validar que una instancia fallida de Cotización y Rating sea detectada y retirada del balanceo sin detener el flujo.

Al detener (en salud) una de las dos instancias, el tráfico debe continuar por la réplica sana. Se miden el tiempo de detección/retiro y las solicitudes fallidas durante la conmutación.

ASR asociado: **ASR-07: Disponibilidad de los flujos críticos** (≥ 99,97 % mensual en compra y siniestro).

## 3. Procedimiento del experimento

### 3.1 Código del servicio y cómo se introduce la falla

El servicio mínimo está en `app/main.py` (FastAPI). No llama a Catálogo, Perfilamiento ni Open Finance. Calcula una prima fija por ramo y devuelve `id`, `prima`, `impuestos`, `vigenciaOferta` e `instancia` (el `HOSTNAME` del Pod).

La salud de **esa réplica** vive en memoria, en un `MonitorSalud` con un booleano `listo`. No se comparte entre Pods.

| Ruta | Efecto |
|---|---|
| `GET /health` | 200 si `listo`; 503 si no. kubelet solo mira este endpoint. |
| `POST /cotizaciones` | Calcula la oferta. Sigue respondiendo aunque `/health` ya sea 503. |
| `POST /experimentos/falla-salud` | Pone `listo = False`. El proceso no se apaga. |
| `POST /experimentos/recupera-salud` | Vuelve `listo = True`. |

La falla no se inyecta por el gateway. Si JMeter o Postman pegaran a `/experimentos/falla-salud` en `127.0.0.1:8080`, nginx reenviaría al Service y el golpe caería en **cualquier** réplica sana. El script `scripts/inyectar_falla.py` evita eso:

1. Lista los Pods con etiqueta `app=cotizacion` en el namespace `solventa`.
2. Elige uno que esté `Ready` (o el que se pase con `--pod`).
3. Ejecuta `kubectl exec` **dentro de ese Pod** y hace `POST http://127.0.0.1:8000/experimentos/falla-salud`.
4. Anota el instante UTC.
5. Espera hasta que el Pod pase a `Ready=false` (como máximo 30 s) y muestra los endpoints del Service.

No se usa `kubectl delete pod`. Borrar el Pod haría que Kubernetes creara otro y se mediría el self-healing, no el probe.

Orden de una corrida: clúster arriba (`python scripts/levantar_k8s.py`), `port-forward` del gateway, JMeter en marcha, y **después** `python scripts/inyectar_falla.py`. Al terminar: `python scripts/inyectar_falla.py --recuperar` para dejar las dos réplicas `Ready` antes de la corrida B.

### 3.2 Arquitectura en Kubernetes

Todo corre en el namespace `solventa`, en minikube. Tres objetos de carga y dos Services:

```text
JMeter (máquina local)
  │  port-forward 8080 → 80
  ▼
Service gateway (ClusterIP, puerto 80)
  ▼
Pod nginx (1 réplica)              API Gateway: solo enruta
  │  proxy_pass http://cotizacion:8000
  ▼
Service cotizacion (ClusterIP, puerto 8000)
  │  endpoints = solo Pods Ready
  ├──────────────┬───────────────
  ▼              ▼
Pod Cotización   Pod Cotización    Deployment, replicas: 2
  ▲              ▲
  └── kubelet GET /health (readinessProbe)
```

El Deployment `cotizacion` no tiene `livenessProbe`. El readiness de la corrida A queda en el manifiesto (`periodSeconds: 2`, `failureThreshold: 2`). La corrida B se aplica con `kubectl patch` sobre el mismo Deployment (`periodSeconds: 5`, `failureThreshold: 3`). Al cambiar el probe, Kubernetes recrea los Pods; hay que esperar a que las dos réplicas estén `Ready` otra vez.

nginx (`Deployment gateway`, 1 réplica) apunta al **nombre DNS del Service**, no a cada Pod. No hace health check. `/gateway/health` solo dice si nginx está vivo. El `/health` de Cotización lo sondea kubelet, no el gateway.

El Service `cotizacion` es ClusterIP: no es alcanzable desde Postman ni JMeter. Por eso, en la máquina local:

```text
kubectl port-forward svc/gateway 8080:80 -n solventa
```

Manifiestos: `k8s/namespace.yaml`, `k8s/cotizacion-deployment.yaml`, `k8s/cotizacion-service.yaml`, `k8s/gateway-configmap.yaml`, `k8s/gateway-deployment.yaml`, `k8s/gateway-service.yaml`.

### 3.3 Plan de JMeter

El plan está en `jmeter/cotizaciones.jmx`. JMeter no abre la interfaz (`-n`). Pega siempre al gateway, nunca a un Pod.

| Parámetro | Valor usado en las corridas |
|---|---|
| Destino | `POST http://127.0.0.1:8080/cotizaciones` |
| Cuerpo | `{"cliente_id":"c-1","ramo":"viajes"}` |
| Hilos | 5 (rampa 5 s) |
| Vueltas por hilo | 360 |
| Pausa entre muestras | 400 ms (`ConstantTimer`) |
| Ritmo observado | ~12 solicitudes/s |
| Duración | ~2 min 33 s |
| Samples por corrida | 1800 |
| Extrae | `$.instancia` (nombre del Pod) |

A mitad de la carga se lanza `inyectar_falla.py`. JMeter no se detiene: sigue hasta terminar las 360 vueltas. Así hay tramo con dos réplicas, ventana de detección y tramo con una sola.

Desde `experimento_1/`:

```text
jmeter -n -t jmeter/cotizaciones.jmx -l resultados/corrida-a.jtl -Jsample_variables=instancia
```

La corrida B usa el mismo `.jmx` y escribe `resultados/corrida-b.jtl`. Lo único que cambia es el probe.

## 4. Resultados obtenidos

**La hipótesis se cumplió.**

En las dos corridas el canal de cotización no se detuvo. JMeter pegó al API Gateway (nginx) durante ~2 min 33 s. Una réplica dejó de responder `GET /health`. Kubernetes la marcó `Ready=false` y el Service dejó de enviarle tráfico. A partir de ese instante, todas las cotizaciones las atendió solo la réplica sana. Cero errores HTTP (5xx o timeouts) en 1800 solicitudes por corrida.

El punto sensible también se comportó como se esperaba: un probe más lento alarga el retiro y deja más tráfico en la réplica que ya falló el health check.

| | Corrida A | Corrida B |
|---|---|---|
| Intervalo (`periodSeconds`) | 2 | 5 |
| Umbral (`failureThreshold`) | 2 | 3 |
| Retiro esperado (orden de magnitud) | ~4 s | ~15 s |
| Tiempo hasta `Ready=false` | **2,3 s** | **13,5 s** |
| POST totales | 1800 | 1800 |
| Errores HTTP | **0** | **0** |
| Réplicas antes de la falla | 498 / 497 | 465 / 455 |
| POST a la réplica caída mientras kubelet detectaba | 13 | 77 |
| POST a la réplica sana después del retiro | 765 (100 %) | 717 (100 %) |

Esas 13 y 77 solicitudes a la réplica “caída” respondieron 200: el proceso seguía vivo. Solo `/health` devolvía 503. El experimento mide el retiro por salud, no un proceso muerto. En cuanto el Pod salió del Service, el campo `instancia` de las respuestas fue únicamente el de la réplica sana.

## 5. Esfuerzo total invertido

Según la hoja de trabajo del experimento: **48 horas-hombre**.

| Integrante | Trabajo | Horas |
|---|---|---|
| Nicolás | Servicio FastAPI, `/health`, cotización mínima, endpoints de falla/recuperación, Dockerfile | 12 |
| Daniel | nginx como API Gateway, Service, `readinessProbe` (intervalo y umbral) | 12 |
| Jerson | Manifiestos del clúster, script de despliegue, ambiente local (minikube) | 12 |
| Jonatan | Plan JMeter, inyección de la falla, consolidación de métricas | 12 |
| **Total** | | **48** |

Tiempo de calendario de las corridas medidas: 11 de septiembre de 2026 (corrida A ~22:03 a 22:06 COT; corrida B ~23:03 a 23:06 COT).

## 6. Hipótesis de diseño

Si kubelet consulta `GET /health` cada N segundos y, tras M fallos seguidos, marca el Pod como no listo (`Ready=false`), el Service deja de enviarle tráfico. Las solicitudes que entran por nginx siguen hacia la réplica que aún responde.

**Punto de sensibilidad:** el par intervalo + umbral del readiness probe (`periodSeconds` y `failureThreshold`).

**Historia de arquitectura asociada (ASR-07):** como cliente asegurado de Solventa, cuando compro un seguro o reporto un siniestro a cualquier hora, dado que la plataforma opera 24/7 y el siniestro no espera horario, quiero una disponibilidad mensual mayor o igual a 99,97 % en los flujos críticos, medida mes a mes, para que el canal esté en pie cuando lo necesite.

**Nivel de incertidumbre (antes de medir):** medio. El diseño ya definía redundancia y retiro automático. No se sabía cuántas solicitudes podían fallar mientras se detectaba la caída y se actualizaba el balanceo.

## 7. Análisis de los resultados

La hipótesis se **confirmó** en A y en B.

1. Antes de la falla, las dos réplicas aparecen en las respuestas (`instancia`).
2. Tras `POST /experimentos/falla-salud` en un solo Pod, ese Pod queda `Ready=false` y sigue existiendo (no se borra).
3. El Service deja de listarlo: un solo endpoint.
4. JMeter sigue recibiendo cotizaciones 200 por la réplica sana.
5. Quedó registrado el tiempo de retiro (2,3 s vs 13,5 s) y el costo de la ventana (0 errores HTTP; sí hay tráfico residual a la instancia no lista hasta que kubelet cumple el umbral).

La incertidumbre media se reduce así: con este diseño, el cliente no ve 5xx durante la conmutación si la réplica aún procesa `POST /cotizaciones`. El costo real de un probe lento no es el error, es **más tiempo enviando carga a un nodo que ya se declaró no saludable**.

### Decisiones de arquitectura que favorecieron el resultado

- **Redundancia N+1 activo-activo.** Dos réplicas de Cotización atienden en paralelo. Al retirar una, la otra sostiene el flujo sin intervención manual. Estilo: microservicios por capacidad de negocio; una instancia puede fallar sin tumbar el servicio.
- **Ping/Echo en el monitor de salud, no en nginx.** El readiness probe de Kubernetes sondea `/health`. El API Gateway solo enruta al Service. Así el punto sensible (intervalo y umbral) es un solo mecanismo, medible.
- **El Service solo ve Pods `Ready`.** Cuando kubelet marca `Ready=false`, Kubernetes saca el endpoint. nginx no necesita health check activo. El balanceo se actualiza solo.
- **Sin `livenessProbe`.** Un liveness habría matado y recreado el contenedor. Eso mezcla el retiro por salud con el self-healing. El experimento aísla ASR-07: continuidad ante instancia no lista, no recreación del Pod.
- **Falla inyectada en `/health`, no `kubectl delete pod`.** El Pod sigue vivo. Se mide el monitor, no el programador de Kubernetes.

La corrida A (probe 2 s × 2 fallos) conviene más al flujo de cotización: el retiro es del orden de 2 a 4 s y casi no hay tráfico residual a la réplica no lista. La B (5 s × 3 fallos) confirma el mismo diseño y muestra el precio de relajar el umbral (~14 s y 77 POST aún dirigidos al nodo enfermo).

## 8. Evidencias

### 8.1 Artefactos de medición

| Archivo | Contenido |
|---|---|
| `resultados/corrida-a.jtl` | Cada POST de la corrida A: timestamp, código HTTP, éxito, `instancia` (nombre del Pod). |
| `resultados/corrida-a.log` | Log de JMeter A. Resumen: 1800 samples, 0 % error, 11,7 req/s. |
| `resultados/corrida-b.jtl` | Igual para la corrida B. |
| `resultados/corrida-b.log` | Resumen B: 1800 samples, 0 % error, 11,8 req/s. |
| `resultados/corrida-a/index.html` | Dashboard HTML de JMeter, corrida A. |
| `resultados/corrida-b/index.html` | Dashboard HTML de JMeter, corrida B. |
| `scripts/inyectar_falla.py` | Inyecta `POST /experimentos/falla-salud` **dentro de un Pod**. Imprime instante UTC y espera `Ready=false`. |
| `k8s/cotizacion-deployment.yaml` | Probe A (`periodSeconds: 2`, `failureThreshold: 2`). |
| `k8s/cotizacion-probe-corrida-b.yaml` | Parche del probe B (`periodSeconds: 5`, `failureThreshold: 3`). |

### 8.2 Marcas de tiempo de la inyección

- **Corrida A:** `instante=2026-09-12T03:05:15.902121Z` en `cotizacion-ccbbc8466-854t5`. `Ready=false` en 2,3 s. El Service quedó en un endpoint (`10.244.0.3:8000`).
- **Corrida B:** `instante=2026-09-12T04:05:17.532236Z` en `cotizacion-9c8d7fd6d-b8znp`. `Ready=false` en 13,5 s. El Service quedó en un endpoint (`10.244.0.6:8000`).

### 8.3 Cómo se lee el `.jtl`

La columna `instancia` es el Pod que calculó la prima. Antes de la falla deben aparecer dos valores. Después del retiro, uno solo. `success=true` y `responseCode=200` en toda la serie respaldan que el flujo no se detuvo.

Plan JMeter: `jmeter/cotizaciones.jmx`. Carga constante contra `POST http://127.0.0.1:8080/cotizaciones` (gateway con `port-forward`).

### 8.4 Dashboard HTML de JMeter

JMeter agrupó las muestras por `instancia`. En A y en B el resumen es el mismo: 1800 solicitudes, **0 FAIL**, 100 % PASS. Esa tabla es la evidencia visual que sí respalda el experimento.

Los dashboards están en el repositorio [MISOG6ProyectoFinal/solventa](https://github.com/MISOG6ProyectoFinal/solventa), rama `main`:

- Corrida A: [index.html](https://github.com/MISOG6ProyectoFinal/solventa/blob/main/experimento_1/resultados/corrida-a/index.html) ([carpeta](https://github.com/MISOG6ProyectoFinal/solventa/tree/main/experimento_1/resultados/corrida-a))
- Corrida B: [index.html](https://github.com/MISOG6ProyectoFinal/solventa/blob/main/experimento_1/resultados/corrida-b/index.html) ([carpeta](https://github.com/MISOG6ProyectoFinal/solventa/tree/main/experimento_1/resultados/corrida-b))

GitHub muestra el archivo, no ejecuta las gráficas. Para ver el dashboard como lo genera JMeter: clonar el repo y abrir el `index.html` en el navegador. El HTML carga CSS y JS del mismo directorio.

**Corrida A** (tabla de estadísticas del dashboard)

| Etiqueta | Samples | FAIL | Error % | Promedio (ms) | Trans/s |
|---|---|---|---|---|---|
| Total | 1800 | 0 | 0 % | 4,56 | 11,78 |
| `cotizacion-ccbbc8466-mn9h8` (réplica sana) | 1289 | 0 | 0 % | 4,80 | 8,53 |
| `cotizacion-ccbbc8466-854t5` (réplica caída) | 511 | 0 | 0 % | 3,96 | 5,89 |

**Corrida B** (tabla de estadísticas del dashboard)

| Etiqueta | Samples | FAIL | Error % | Promedio (ms) | Trans/s |
|---|---|---|---|---|---|
| Total | 1800 | 0 | 0 % | 3,95 | 11,80 |
| `cotizacion-9c8d7fd6d-xhp87` (réplica sana) | 1258 | 0 | 0 % | 3,98 | 8,29 |
| `cotizacion-9c8d7fd6d-b8znp` (réplica caída) | 542 | 0 | 0 % | 3,88 | 5,93 |

Los gráficos Over Time, Hits per Second y Response Times del dashboard **no** se usan como evidencia del retiro. JMeter los agrega en ventanas de 60 s. En ~2 min 33 s apenas hay tres puntos: no se ve la ventana de 2,3 s ni la de 13,5 s. El corte (dos réplicas, luego una) está en la columna `instancia` del `.jtl`.
