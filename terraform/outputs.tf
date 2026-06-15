output "hot_bucket" {
  value = minio_s3_bucket.hot.bucket
}

output "cold_bucket" {
  value = minio_s3_bucket.cold.bucket
}

output "hot_endpoint" {
  value = "http://${var.minio_hot_server}"
}

output "cold_endpoint" {
  value = "http://${var.minio_cold_server}"
}

output "region" {
  value = var.minio_region
}

output "replication_service_account" {
  value = minio_iam_service_account.replication.access_key
}
