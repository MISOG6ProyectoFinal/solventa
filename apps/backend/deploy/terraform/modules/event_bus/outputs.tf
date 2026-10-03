output "topic_arn" {
  value = aws_sns_topic.events.arn
}

output "queue_urls" {
  value = { for k, q in aws_sqs_queue.queue : k => q.url }
}

output "queue_arns" {
  value = { for k, q in aws_sqs_queue.queue : k => q.arn }
}

output "dlq_arns" {
  value = { for k, q in aws_sqs_queue.dlq : k => q.arn }
}
