#!/usr/bin/env bash
# Réplica local del módulo Terraform event_bus: tópico SNS, una cola por suscriptor y DLQ tras 3 intentos.
set -euo pipefail

topic_arn=$(awslocal sns create-topic --name solventa-eventos --query TopicArn --output text)

queue_arn() {
  awslocal sqs get-queue-attributes --queue-url "$1" --attribute-names QueueArn \
    --query Attributes.QueueArn --output text
}

for consumer in siniestros-parametrico auditoria; do
  dlq_url=$(awslocal sqs create-queue --queue-name "solventa-${consumer}-dlq" --query QueueUrl --output text)
  queue_url=$(awslocal sqs create-queue --queue-name "solventa-${consumer}" --query QueueUrl --output text)
  attrs=$(printf '{"RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"%s\\",\\"maxReceiveCount\\":\\"3\\"}"}' \
    "$(queue_arn "$dlq_url")")
  awslocal sqs set-queue-attributes --queue-url "$queue_url" --attributes "$attrs"
  awslocal sns subscribe --topic-arn "$topic_arn" --protocol sqs \
    --notification-endpoint "$(queue_arn "$queue_url")" --attributes RawMessageDelivery=true >/dev/null
done

awslocal s3 mb s3://solventa-evidencias >/dev/null
