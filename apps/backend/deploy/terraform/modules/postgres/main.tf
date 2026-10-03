# Un almacén relacional de la Tabla 2: primaria con réplica síncrona en otra zona
# (Multi-AZ), Connection Proxy (RDS Proxy) y réplica de lectura opcional (CQRS).
locals {
  identifier = "${var.prefix}-${var.name}"
}

resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "master" {
  name                    = "${local.identifier}-master"
  recovery_window_in_days = var.deletion_protection ? 7 : 0
}

resource "aws_secretsmanager_secret_version" "master" {
  secret_id = aws_secretsmanager_secret.master.id
  secret_string = jsonencode({
    username = var.username
    password = random_password.master.result
  })
}

resource "aws_security_group" "db" {
  name        = "${local.identifier}-db"
  description = "PostgreSQL ${var.name}: acceso solo desde el clúster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL desde nodos EKS y RDS Proxy"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
    self            = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "primary" {
  identifier     = local.identifier
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.allocated_storage_gb * 5
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.name
  username = var.username
  password = random_password.master.result

  # Réplica síncrona en otra zona: se promueve sola si cae la primaria (ASR-08, ASR-09).
  multi_az               = var.multi_az
  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false

  backup_retention_period      = var.backup_retention_days
  performance_insights_enabled = true
  deletion_protection          = var.deletion_protection
  skip_final_snapshot          = !var.deletion_protection
  final_snapshot_identifier    = var.deletion_protection ? "${local.identifier}-final" : null
  apply_immediately            = !var.deletion_protection
}

resource "aws_db_instance" "read_replica" {
  count = var.read_replica ? 1 : 0

  identifier             = "${local.identifier}-ro"
  replicate_source_db    = aws_db_instance.primary.identifier
  instance_class         = var.instance_class
  storage_encrypted      = true
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
}

# ---------- Connection Proxy (RDS Proxy)

data "aws_iam_policy_document" "proxy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "proxy" {
  count              = var.enable_proxy && var.proxy_role_arn == null ? 1 : 0
  name               = "${local.identifier}-proxy"
  assume_role_policy = data.aws_iam_policy_document.proxy_assume.json
}

resource "aws_iam_role_policy" "proxy" {
  count = length(aws_iam_role.proxy)
  name  = "read-db-secret"
  role  = aws_iam_role.proxy[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.master.arn
    }]
  })
}

resource "aws_db_proxy" "this" {
  count = var.enable_proxy ? 1 : 0

  name                   = local.identifier
  engine_family          = "POSTGRESQL"
  role_arn               = coalesce(var.proxy_role_arn, try(aws_iam_role.proxy[0].arn, null))
  vpc_subnet_ids         = var.subnet_ids
  vpc_security_group_ids = [aws_security_group.db.id]
  require_tls            = true
  idle_client_timeout    = 1800

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.master.arn
  }

  depends_on = [aws_secretsmanager_secret_version.master]
}

resource "aws_db_proxy_default_target_group" "this" {
  count         = var.enable_proxy ? 1 : 0
  db_proxy_name = aws_db_proxy.this[0].name

  connection_pool_config {
    max_connections_percent      = 90
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 5
  }
}

resource "aws_db_proxy_target" "this" {
  count                  = var.enable_proxy ? 1 : 0
  db_proxy_name          = aws_db_proxy.this[0].name
  target_group_name      = aws_db_proxy_default_target_group.this[0].name
  db_instance_identifier = aws_db_instance.primary.identifier
}
