terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.95"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.36"
    }
  }
  # bucket, key y region llegan de environments/<env>/edge/backend.tfvars
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project     = "solventa"
      environment = var.environment
      stack       = "edge"
      terraform   = "true"
    }
  }
}

locals {
  cluster = one(data.terraform_remote_state.eks[*].outputs)
}

provider "kubernetes" {
  host                   = try(local.cluster.cluster_endpoint, null)
  cluster_ca_certificate = try(base64decode(local.cluster.cluster_certificate_authority_data), null)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", try(local.cluster.cluster_name, ""), "--region", var.region]
  }
}
