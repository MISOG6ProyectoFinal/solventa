# Manual de Ejecución: Experimento 2 - Solventa

**Título del Experimento:** Absorción de una avalancha de eventos paramétricos con cola de eventos y workers (Competing Consumers).
**Objetivo:** Validar que la arquitectura Orientada a Eventos pueda absorber un pico de tráfico extremo (siniestros paramétricos automáticos) sin afectar la latencia de la API de cotizaciones, garantizando inmutabilidad y cero pérdida de datos.

---

## Prerrequisitos
Para ejecutar este experimento en cualquier máquina, necesitas tener instalado:
1. **Docker y Docker Compose:** Para orquestar la BD, ElasticMQ (SQS), la API y los Workers.
2. **AWS CLI:** Para ejecutar el script de creación de las colas. (No necesitas una cuenta real de AWS, se conecta al simulador local).
3. **Apache JMeter:** Para simular la avalancha de eventos.

---

## 1. Levantar la Infraestructura y los Contenedores

Abre una terminal en esta misma carpeta (`Experimento2`) y ejecuta:

```bash
# Levanta la base de datos (PostgreSQL), el clon de SQS (ElasticMQ), la API y 2 Workers
docker-compose up -d --scale worker=2
```

Puedes verificar que todos los contenedores estén corriendo (`Up`) con:
```bash
docker ps
```

---

## 2. Crear las Colas de Mensajería (Amazon SQS)

La infraestructura local inicia vacía. Debemos crear la **Dead Letter Queue (DLQ)** y la **Cola Principal**. Para ello, ejecuta el script de configuración provisto:

```bash
# Dale permisos de ejecución si aún no los tiene (solo la primera vez)
chmod +x setup_sqs.sh

# Ejecuta el script
./setup_sqs.sh
```

Deberás ver en consola las URLs de confirmación de las colas creadas.

---

## 🧪 3. Prueba Funcional Manual (Opcional)

Antes de disparar la avalancha, puedes validar que el flujo completo funciona enviando un solo siniestro mediante `cURL`:

```bash
curl -X POST http://localhost:8000/eventos-parametricos \
-H "Content-Type: application/json" \
-d '{
  "poliza_id": "POL-11111",
  "evento_tipo": "VUELO_RETRASADO",
  "datos_evento": {"vuelo": "AV999", "horas_retraso": 5}
}'
```
**Respuesta esperada:** Deberías recibir de inmediato un `HTTP 202 Accepted` con una llave de idempotencia.

---

## 4. Ejecutar la Prueba de Carga (JMeter)

Aquí simulamos el pico masivo de siniestros paramétricos.

1. Abre **Apache JMeter**.
2. Ve a `File > Open` y selecciona el archivo **`avalancha_solventa.jmx`** que se encuentra en esta carpeta.
3. Haz clic en el botón verde de **Start (Play)** en la barra superior.
4. En el panel lateral izquierdo, selecciona **"Summary Report"** o **"View Results Tree"** para ver cómo la API procesa 1.000 solicitudes en milisegundos y sin caídas.

---

## 5. Consultar y Monitorear Resultados

Mientras JMeter dispara los eventos, la API los encola muy rápido. La verdadera magia ocurre asíncronamente en los *Workers*. 

Para ver cómo los dos *workers* se reparten la cola equitativamente (*Competing Consumers*) y procesan las transacciones en la Base de Datos, abre dos terminales separadas y revisa sus logs en vivo:

**Terminal 1 (Worker 1):**
```bash
docker logs -f experimento2-worker-1
```

**Terminal 2 (Worker 2):**
```bash
docker logs -f experimento2-worker-2
```

### Probar Mensajes Envenenados (DLQ)
Para comprobar que la arquitectura es resiliente, envía este JSON con `"ERROR_FORZADO"`. El worker fallará internamente a propósito, hará *rollback* en la base de datos para garantizar inmutabilidad, y tras 3 intentos, SQS moverá el mensaje a la DLQ.

```bash
curl -X POST http://localhost:8000/eventos-parametricos \
-H "Content-Type: application/json" \
-d '{
  "poliza_id": "POL-POISON",
  "evento_tipo": "VUELO_RETRASADO",
  "datos_evento": {"ERROR_FORZADO": true}
}'
```

---

## 🧹 6. Limpieza del Entorno

Una vez finalizadas las métricas y pruebas, puedes apagar todo y limpiar los volúmenes con:

```bash
docker-compose down -v --remove-orphans
```
