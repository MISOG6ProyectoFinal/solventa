locals {
  network   = data.terraform_remote_state.network.outputs
  registry  = data.terraform_remote_state.container_registry.outputs.registry
  messaging = data.terraform_remote_state.messaging.outputs
  nombre    = "${var.prefix}-${var.environment}-ahorro"

  kubeconfig_parameter = "/${var.prefix}/${var.environment}/ahorro/kubeconfig"

  plataforma = merge({
    ENVIRONMENT       = var.environment
    AWS_REGION        = var.region
    REDIS_URL         = ""
    EVENTS_TOPIC_ARN  = local.messaging.topic_arn
    EVIDENCIAS_BUCKET = module.evidencias.bucket
  }, { for k, url in local.messaging.queue_urls : "QUEUE_URL_${upper(replace(k, "-", "_"))}" => url })
}

data "aws_caller_identity" "current" {}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

module "evidencias" {
  source = "../../modules/object_storage"

  bucket_name    = "${var.prefix}-${var.environment}-evidencias-ahorro-${data.aws_caller_identity.current.account_id}"
  force_destroy  = true
  kms_encryption = false
}

resource "aws_security_group" "k3s" {
  name        = local.nombre
  description = "k3s del modo ahorro: HTTP solo desde CloudFront, sin acceso directo a la API de Kubernetes"
  vpc_id      = local.network.vpc_id

  ingress {
    description     = "Ingress de k3s detras de CloudFront"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  egress {
    description = "Salida a ECR, SNS, SQS, S3, SSM e imagenes publicas"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "k3s" {
  statement {
    sid       = "TokenDeEcr"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "ImagenesDeSolventa"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = ["arn:aws:ecr:${var.region}:${data.aws_caller_identity.current.account_id}:repository/${var.prefix}/*"]
  }
  statement {
    sid       = "PublicarEnElBus"
    actions   = ["sns:Publish"]
    resources = [local.messaging.topic_arn]
  }
  statement {
    sid       = "ConsumirColas"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"]
    resources = values(local.messaging.queue_arns)
  }
  statement {
    sid       = "Evidencias"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${module.evidencias.arn}/*"]
  }
  statement {
    sid       = "PublicarKubeconfig"
    actions   = ["ssm:PutParameter"]
    resources = [aws_ssm_parameter.kubeconfig.arn]
  }
}

resource "aws_iam_role" "k3s" {
  name               = local.nombre
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy" "k3s" {
  role   = aws_iam_role.k3s.id
  policy = data.aws_iam_policy_document.k3s.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.k3s.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "k3s" {
  name = local.nombre
  role = aws_iam_role.k3s.name
}

resource "aws_ssm_parameter" "kubeconfig" {
  name        = local.kubeconfig_parameter
  description = "Kubeconfig de k3s del modo ahorro. Lo publica la instancia al arrancar."
  type        = "SecureString"
  value       = "pendiente"

  lifecycle {
    ignore_changes = [value]
  }
}

data "cloudinit_config" "k3s" {
  gzip          = true
  base64_encode = true

  part {
    content_type = "text/cloud-config"
    content = yamlencode({
      cloud_final_modules = [["scripts-user", "always"]]
    })
  }

  part {
    content_type = "text/x-shellscript"
    content = templatefile("${path.module}/arranque.sh.tftpl", {
      k3s_version          = var.k3s_version
      region               = var.region
      registry             = local.registry
      kubeconfig_parameter = local.kubeconfig_parameter
      almacenes            = join(" ", var.almacenes)
      plataforma           = local.plataforma
    })
  }
}

resource "aws_instance" "k3s" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = local.network.public_subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.k3s.id]
  iam_instance_profile   = aws_iam_instance_profile.k3s.name

  user_data_base64 = data.cloudinit_config.k3s.rendered

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_size = var.root_volume_gb
    volume_type = "gp3"
    encrypted   = true
  }

  dynamic "instance_market_options" {
    for_each = var.spot ? [1] : []
    content {
      market_type = "spot"
      spot_options {
        spot_instance_type             = "persistent"
        instance_interruption_behavior = "stop"
      }
    }
  }

  tags = {
    Name = local.nombre
  }

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "k3s" {
  domain   = "vpc"
  instance = aws_instance.k3s.id
  tags = {
    Name = local.nombre
  }
}
