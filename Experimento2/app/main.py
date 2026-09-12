import uuid
import logging
from fastapi import FastAPI, status, HTTPException
from pydantic import BaseModel, Field
import boto3
from config import AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SQS_QUEUE_URL, ENDPOINT_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_productor")

app = FastAPI(title="Productor Solventa - Siniestros Paramétricos")

sqs = boto3.client(
    'sqs',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    endpoint_url=ENDPOINT_URL
)

class SiniestroParametrico(BaseModel):
    poliza_id: str = Field(..., description="ID de la póliza afectada")
    evento_tipo: str = Field(..., description="Tipo de evento (ej. VUELO_RETRASADO, TERREMOTO)")
    datos_evento: dict = Field(..., description="Detalles técnicos del evento (magnitud, horas retraso, etc)")
    idempotency_key: str = Field(None, description="Llave para evitar pagos duplicados")

@app.post("/eventos-parametricos", status_code=status.HTTP_202_ACCEPTED)
async def ingerir_evento(evento: SiniestroParametrico):
    if not evento.idempotency_key:
        evento.idempotency_key = f"IDEMP-{evento.poliza_id}-{evento.evento_tipo}-{uuid.uuid4().hex[:8]}"

    try:
        # Encolamos inmediatamente (Cumplimiento de Latencia ASR-01)
        response = sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=evento.model_dump_json(),
            MessageAttributes={
                'IdempotencyKey': {
                    'StringValue': evento.idempotency_key,
                    'DataType': 'String'
                }
            }
        )
        
        logger.info(f"Evento encolado exitosamente: {evento.idempotency_key}")
        
        return {
            "status": "Accepted", 
            "message": "Evento paramétrico recibido y enrutado al bus", 
            "idempotency_key": evento.idempotency_key,
            "message_id": response.get('MessageId')
        }
    except Exception as e:
        logger.error(f"Falla crítica al encolar: {str(e)}")
        # Degradación : retornar 503 si el Bus de Eventos está caído
        raise HTTPException(status_code=503, detail="Bus de eventos temporalmente inactivo")
