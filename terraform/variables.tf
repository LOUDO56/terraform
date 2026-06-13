variable "minio_hot_server" {
  type    = string
  default = "localhost:9000"
}

variable "minio_cold_server" {
  type    = string
  default = "localhost:9002"
}

variable "minio_cold_internal" {
  type    = string
  default = "minio-cold:9000"
}

variable "minio_user" {
  type    = string
  default = "minioadmin"
}

variable "minio_password" {
  type      = string
  default   = "minioadmin"
  sensitive = true
}

variable "minio_region" {
  type    = string
  default = "us-east-1"
}

variable "bucket_hot" {
  type    = string
  default = "app-hot"
}

variable "bucket_cold" {
  type    = string
  default = "app-cold"
}
