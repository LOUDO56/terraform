terraform {
  required_version = ">= 1.5.0"

  backend "local" {}

  required_providers {
    minio = {
      source  = "aminueza/minio"
      version = "~> 3.0"
    }
  }
}
