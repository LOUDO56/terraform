provider "minio" {
  minio_server   = var.minio_hot_server
  minio_user     = var.minio_user
  minio_password = var.minio_password
  minio_region   = var.minio_region
  minio_ssl      = false
}

provider "minio" {
  alias          = "cold"
  minio_server   = var.minio_cold_server
  minio_user     = var.minio_user
  minio_password = var.minio_password
  minio_region   = var.minio_region
  minio_ssl      = false
}
