module "event_bus" {
  source = "../../modules/event_bus"

  prefix            = var.prefix
  consumers         = var.consumers
  max_receive_count = var.max_receive_count
  alarm_actions     = var.alarm_actions
}
