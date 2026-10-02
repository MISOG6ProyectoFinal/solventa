region              = "us-east-1"
environment         = "dev"
state_bucket        = "solventa-terraform-state-dev"
deletion_protection = false
redis_node_count    = 2

# Tabla 2. En dev las bases son pequeñas; Multi-AZ se mantiene para probar el failover.
stores = {
  cotizacion = {}
  polizas    = {}
  siniestros = { instance_class = "db.t4g.large" } # recibe la escritura de los workers
  identidad  = {}
  pagos      = {}                      # TODO: perímetro PCI (VPC/cuenta separada)
  auditoria  = { read_replica = true } # réplica de lectura para analítica (CQRS)
}

# proxy_role_arn = "arn:aws:iam::<cuenta>:role/LabRole"
