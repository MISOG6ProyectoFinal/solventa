# Bus de eventos: un tópico SNS (publish) y una cola SQS por suscriptor (subscribe).
# Cada cola tiene su Dead Letter Queue: un mensaje que falla max_receive_count veces
# sale del flujo y el drenado del pico sigue su curso (Experimento 2).
resource "aws_sns_topic" "events" {
  name              = "${var.prefix}-eventos"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sqs_queue" "dlq" {
  for_each = var.consumers

  name                      = "${var.prefix}-${each.key}-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "queue" {
  for_each = var.consumers

  name                       = "${var.prefix}-${each.key}"
  visibility_timeout_seconds = each.value.visibility_timeout_s
  receive_wait_time_seconds  = 20
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn
    maxReceiveCount     = var.max_receive_count
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "dlq" {
  for_each  = var.consumers
  queue_url = aws_sqs_queue.dlq[each.key].id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.queue[each.key].arn]
  })
}

data "aws_iam_policy_document" "sns_to_sqs" {
  for_each = var.consumers

  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.queue[each.key].arn]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.events.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "queue" {
  for_each  = var.consumers
  queue_url = aws_sqs_queue.queue[each.key].id
  policy    = data.aws_iam_policy_document.sns_to_sqs[each.key].json
}

resource "aws_sns_topic_subscription" "queue" {
  for_each = var.consumers

  topic_arn            = aws_sns_topic.events.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.queue[each.key].arn
  raw_message_delivery = true
  filter_policy        = each.value.event_types == null ? null : jsonencode({ event_type = each.value.event_types })
}

resource "aws_cloudwatch_metric_alarm" "dlq_not_empty" {
  for_each = var.consumers

  alarm_name          = "${var.prefix}-${each.key}-dlq-con-mensajes"
  alarm_description   = "Eventos irrecuperables tras ${var.max_receive_count} intentos en ${each.key}"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.dlq[each.key].name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = var.alarm_actions
}
