import time
import json
import boto3
import logging
import signal
import sys
from sqlalchemy.exc import IntegrityError
from config import AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SQS_QUEUE_URL, ENDPOINT_URL
from database import SessionLocal, init_db
from models import RegistroIdempotencia, SiniestroLiquidado

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(processName)s - %(levelname)s - %(message)s')
logger = logging.getLogger("worker_siniestros")

sqs = boto3.client(
    'sqs',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    endpoint_url=ENDPOINT_URL
)

shutdown_flag = False

def signal_handler(signum, frame):
    global shutdown_flag
    logger.info("Señal de apagado recibida. Deteniendo el worker de forma segura (Graceful Shutdown)...")
    shutdown_flag = True

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def procesar_evento_con_transaccion(db, body: dict, idempotency_key: str):
    poliza_id = body.get('poliza_id')
    evento_tipo = body.get('evento_tipo')
    
    # 1. Validación Distribuida de Idempotencia en BD real
    registro_previo = db.query(RegistroIdempotencia).filter(RegistroIdempotencia.idempotency_key == idempotency_key).first()
    if registro_previo:
        logger.warning(f"[IDEMPOTENCIA] Pago doble evitado para la llave: {idempotency_key}")
        return True # Se procesó antes, pedimos borrarlo de la cola
        
    # 2. Prueba de DLQ (Dead Letter Queue): Mensajes Envenenados
    if "ERROR_FORZADO" in body.get("datos_evento", {}):
        logger.error(f"Mensaje envenenado detectado para póliza {poliza_id}. Fallando intencionalmente para forzar envío a DLQ.")
        raise ValueError("Error de negocio: Datos del siniestro corruptos o no cumplen regla.")

    try:
        # 3. Inmutabilidad y Transaccionalidad
        logger.info(f"Evaluando condiciones del siniestro {evento_tipo} para póliza {poliza_id}...")
        time.sleep(0.5) # Simula cálculo 
        
        nuevo_siniestro = SiniestroLiquidado(
            id=f"{poliza_id}-{evento_tipo}-{int(time.time())}",
            poliza_id=poliza_id,
            evento_tipo=evento_tipo,
            datos_evento=body.get('datos_evento', {})
        )
        db.add(nuevo_siniestro)
        
        nuevo_registro = RegistroIdempotencia(idempotency_key=idempotency_key, exitoso=True)
        db.add(nuevo_registro)
        
        # Commit atómico (Reemplazo Atómico e Inmutabilidad)
        db.commit()
        logger.info(f"Siniestro liquidado en BD exitosamente. Llave={idempotency_key}")
        return True
        
    except Exception as e:
        db.rollback() # Si algo falla, revertimos para no dejar datos a medias
        logger.error(f"Rollback ejecutado por falla en BD: {str(e)}")
        raise # Propagamos para que SQS lo intente de nuevo

def poll_messages():
    init_db()
    logger.info(f"Worker iniciado. BD Conectada. SQS: {SQS_QUEUE_URL}")
    
    while not shutdown_flag:
        try:
            response = sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=10,
                WaitTimeSeconds=10, 
                MessageAttributeNames=['All']
            )

            messages = response.get('Messages', [])
            if not messages:
                continue
            
            for msg in messages:
                receipt_handle = msg['ReceiptHandle']
                body = json.loads(msg['Body'])
                idempotency_key = msg.get('MessageAttributes', {}).get('IdempotencyKey', {}).get('StringValue')
                
                db = SessionLocal()
                try:
                    exito = procesar_evento_con_transaccion(db, body, idempotency_key)
                    if exito:
                        sqs.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
                        logger.debug(f"Mensaje {idempotency_key} borrado de SQS.")
                except Exception as e:
                    logger.error(f"Falla en el procesamiento. SQS lo reintentará. Motivo: {e}")
                    # NO borramos el mensaje, SQS lo re-entregará por el Visibility Timeout
                finally:
                    db.close()

        except Exception as e:
            logger.error(f"Error SQS: {str(e)}")
            time.sleep(5)
            
    logger.info("Worker apagado correctamente.")

if __name__ == "__main__":
    poll_messages()
