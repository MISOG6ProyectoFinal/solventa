data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "network/terraform.tfstate"
    region = var.region
  }
}

data "terraform_remote_state" "container_registry" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "container_registry/terraform.tfstate"
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
