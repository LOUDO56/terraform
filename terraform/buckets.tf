resource "minio_s3_bucket" "hot" {
  bucket = var.bucket_hot
}

resource "minio_s3_bucket" "cold" {
  provider = minio.cold
  bucket   = var.bucket_cold
}

resource "minio_s3_bucket_versioning" "hot" {
  bucket = minio_s3_bucket.hot.bucket

  versioning_configuration {
    status = "Enabled"
  }
}

resource "minio_s3_bucket_versioning" "cold" {
  provider = minio.cold
  bucket   = minio_s3_bucket.cold.bucket

  versioning_configuration {
    status = "Enabled"
  }
}
