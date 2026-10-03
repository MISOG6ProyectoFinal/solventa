data "terraform_remote_state" "eks" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "eks/terraform.tfstate"
    region = var.region
  }
}

data "terraform_remote_state" "data" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "data/terraform.tfstate"
    region = var.region
  }
}

data "terraform_remote_state" "messaging" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "messaging/terraform.tfstate"
    region = var.region
  }
}
