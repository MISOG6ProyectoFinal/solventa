# Experimento 2: guía de ejecución

**Título:** Absorción de una avalancha de eventos paramétricos con cola de eventos y workers (Competing Consumers).

**Objetivo:** Validar que la arquitectura orientada a eventos absorba un pico de tráfico extremo (siniestros paramétricos automáticos) sin afectar la latencia de la API de cotizaciones, con inmutabilidad y sin pérdida de datos.

## Requisitos

- **Docker y Docker Compose**, para levantar la base de datos, ElasticMQ (compatible con SQS), la API y los workers.
- **AWS CLI**, para crear las colas con el script de configuración. No se necesita una cuenta de AWS: la CLI se conecta al simulador local.
- **Apache JMeter**, para generar la avalancha de eventos.

## 1. Levantar los contenedores

Desde esta carpeta (`experimentation/Experiment2`):

```bash
# Levanta la base de datos (PostgreSQL), el clon de SQS (ElasticMQ), la API y 2 Workers
docker-compose up -d --scale worker=2
```

Comprueba que todos los contenedores estén en estado `Up`:

```bash
docker ps
```

## 2. Crear las colas (Amazon SQS)

ElasticMQ arranca sin colas. El script crea la Dead Letter Queue (DLQ) y la cola principal:

```bash
# Dale permisos de ejecución si aún no los tiene (solo la primera vez)
chmod +x setup_sqs.sh

# Ejecuta el script
./setup_sqs.sh
```

La consola muestra las URLs de las colas creadas.

## 3. Prueba funcional manual (opcional)

Antes de la avalancha, puedes validar el flujo completo con un solo siniestro:

```bash
curl -X POST http://localhost:8000/eventos-parametricos \
-H "Content-Type: application/json" \
-d '{
  "poliza_id": "POL-11111",
  "evento_tipo": "VUELO_RETRASADO",
  "datos_evento": {"vuelo": "AV999", "horas_retraso": 5}
}'
```

La API responde de inmediato `HTTP 202 Accepted` con una llave de idempotencia.

## 4. Prueba de carga (JMeter)

1. Abre Apache JMeter.
2. En `File > Open`, selecciona `avalancha_solventa.jmx`, que está en esta carpeta.
3. Pulsa **Start** (botón verde) en la barra superior.
4. En el panel izquierdo, abre **Summary Report** o **View Results Tree** para ver cómo la API responde las 1.000 solicitudes.

## 5. Monitorear el procesamiento

La API encola los eventos y los workers los procesan de forma asíncrona. Para ver cómo los dos workers se reparten la cola (Competing Consumers) y registran las transacciones en la base de datos, sigue sus logs en dos terminales:

**Terminal 1 (Worker 1):**

```bash
docker logs -f experiment2-worker-1
```

**Terminal 2 (Worker 2):**

```bash
docker logs -f experiment2-worker-2
```

### Mensajes envenenados (DLQ)

Envía un evento con `"ERROR_FORZADO"`. El worker falla a propósito antes de escribir en la base de datos y no borra el mensaje, así que SQS lo vuelve a entregar. Después de 3 intentos, SQS mueve el mensaje a la DLQ.

```bash
curl -X POST http://localhost:8000/eventos-parametricos \
-H "Content-Type: application/json" \
-d '{
  "poliza_id": "POL-POISON",
  "evento_tipo": "VUELO_RETRASADO",
  "datos_evento": {"ERROR_FORZADO": true}
}'
```

## 6. Limpieza

Para apagar los contenedores y borrar los volúmenes:

```bash
docker-compose down -v --remove-orphans
```
