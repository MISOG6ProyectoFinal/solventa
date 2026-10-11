region              = "us-east-1"
environment         = "dev"
state_bucket        = "solventa-tfstate-712589718837"
deletion_protection = false
redis_node_count    = 1
redis_node_type     = "cache.t4g.micro"

# Tabla 2: un PostgreSQL por almacén. Perfil económico para dev: instancias micro
# en una sola zona. Para ensayar el failover del VC-004 se activa multi_az por almacén.
stores = {
  cotizacion = { instance_class = "db.t4g.micro", multi_az = false, enable_proxy = false }
  polizas    = { instance_class = "db.t4g.micro", multi_az = false, enable_proxy = false }
  siniestros = { instance_class = "db.t4g.micro", multi_az = false } # con RDS Proxy: recibe a los workers
  identidad  = { instance_class = "db.t4g.micro", multi_az = false, enable_proxy = false }
  pagos      = { instance_class = "db.t4g.micro", multi_az = false, enable_proxy = false }
  auditoria  = { instance_class = "db.t4g.micro", multi_az = false, enable_proxy = false }
}

# proxy_role_arn = "arn:aws:iam::<cuenta>:role/LabRole"
