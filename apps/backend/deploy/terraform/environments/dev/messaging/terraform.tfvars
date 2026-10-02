region            = "us-east-1"
environment       = "dev"
max_receive_count = 3

# Las claves son el nombre del consumidor; platform las expone como QUEUE_URL_<CLAVE>.
consumers = {
  siniestros-parametrico = { event_types = ["evento_parametrico.recibido"], visibility_timeout_s = 60 }
  auditoria              = {} # auditoría, analítica y notificaciones reciben todos los eventos
}
