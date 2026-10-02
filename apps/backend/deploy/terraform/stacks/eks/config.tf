terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.95"
    }
  }
  # bucket, key y region llegan de environments/<env>/eks/backend.tfvars
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project     = "solventa"
      environment = var.environment
      stack       = "eks"
      terraform   = "true"
    }
  }
}
