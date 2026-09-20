#!/bin/bash
echo "Esperando a que ElasticMQ inicie..."
sleep 2

export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_DEFAULT_REGION="us-east-1"
export ENDPOINT_URL="http://localhost:4566"

echo "1. Creando Dead Letter Queue (DLQ)..."
aws --endpoint-url=$ENDPOINT_URL sqs create-queue --queue-name eventos-parametricos-dlq

# Extraer el ARN de la DLQ
DLQ_ARN=$(aws --endpoint-url=$ENDPOINT_URL sqs get-queue-attributes --queue-url http://localhost:4566/000000000000/eventos-parametricos-dlq --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

echo "2. Creando Cola Principal con política de reintento (MaxReceiveCount=3)..."
aws --endpoint-url=$ENDPOINT_URL sqs create-queue \
    --queue-name eventos-parametricos-queue \
    --attributes '{
        "VisibilityTimeout": "10",
        "RedrivePolicy": "{\"deadLetterTargetArn\":\"'"$DLQ_ARN"'\",\"maxReceiveCount\":\"3\"}"
    }'

echo "Colas activas en ElasticMQ:"
aws --endpoint-url=$ENDPOINT_URL sqs list-queues
