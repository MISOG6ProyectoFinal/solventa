output "topic_arn" {
  value = module.event_bus.topic_arn
}

output "queue_urls" {
  value = module.event_bus.queue_urls
}

output "queue_arns" {
  value = module.event_bus.queue_arns
}
