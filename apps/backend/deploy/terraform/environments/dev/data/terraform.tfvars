region              = "us-east-1"
environment         = "dev"
state_bucket        = "solventa-g6-terraform-state-dev"
deletion_protection = false
redis_enabled       = false

shared_instance = { instance_class = "db.t4g.micro" }

stores = {
  cotizacion = {}
  polizas    = {}
  siniestros = {}
  identidad  = {}
  pagos      = {}
  auditoria  = {}
}

# proxy_role_arn = "arn:aws:iam::<cuenta>:role/LabRole"
