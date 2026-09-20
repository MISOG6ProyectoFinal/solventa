import os

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
# Credenciales dummy para LocalStack por defecto
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "test")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "test")

# URL de la cola SQS
# Por defecto apuntamos a un entorno local usando LocalStack que correrá en el puerto 4566
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL", "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/eventos-parametricos-queue")
ENDPOINT_URL = os.getenv("ENDPOINT_URL", "http://localhost:4566")
