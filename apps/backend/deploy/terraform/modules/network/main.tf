# VPC multi-zona: subredes públicas (balanceadores), privadas (nodos EKS) y de
# base de datos (RDS, ElastiCache) en cada zona de disponibilidad.
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.21"

  name = var.name
  cidr = var.cidr
  azs  = local.azs

  public_subnets   = [for i, _ in local.azs : cidrsubnet(var.cidr, 8, i)]
  private_subnets  = [for i, _ in local.azs : cidrsubnet(var.cidr, 4, i + 1)]
  database_subnets = [for i, _ in local.azs : cidrsubnet(var.cidr, 8, i + 100)]

  create_database_subnet_group = true
  enable_nat_gateway           = true
  # Una NAT por zona sostiene el activo-activo; una sola abarata los ambientes de prueba.
  single_nat_gateway   = var.single_nat_gateway
  enable_dns_hostnames = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }
}
