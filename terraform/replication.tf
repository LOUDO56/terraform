data "minio_iam_policy_document" "replication" {
  statement {
    sid       = "ReadBuckets"
    effect    = "Allow"
    resources = ["arn:aws:s3:::*"]
    actions   = ["s3:ListBucket"]
  }

  statement {
    sid       = "EnableReplicationConfig"
    effect    = "Allow"
    resources = ["arn:aws:s3:::${var.bucket_cold}"]

    actions = [
      "s3:GetReplicationConfiguration",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:GetBucketLocation",
      "s3:GetBucketVersioning",
      "s3:GetBucketObjectLockConfiguration",
      "s3:GetEncryptionConfiguration",
    ]
  }

  statement {
    sid       = "EnableReplicatingData"
    effect    = "Allow"
    resources = ["arn:aws:s3:::${var.bucket_cold}/*"]

    actions = [
      "s3:GetReplicationConfiguration",
      "s3:ReplicateTags",
      "s3:AbortMultipartUpload",
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetObjectVersionTagging",
      "s3:PutObject",
      "s3:PutObjectRetention",
      "s3:PutBucketObjectLockConfiguration",
      "s3:PutObjectLegalHold",
      "s3:DeleteObject",
      "s3:ReplicateObject",
      "s3:ReplicateDelete",
    ]
  }
}

resource "minio_iam_policy" "replication" {
  provider = minio.cold
  name     = "hot-to-cold-replication"
  policy   = data.minio_iam_policy_document.replication.json
}

resource "minio_iam_user" "replication" {
  provider      = minio.cold
  name          = "replication-svc"
  force_destroy = true
}

resource "minio_iam_user_policy_attachment" "replication" {
  provider    = minio.cold
  user_name   = minio_iam_user.replication.name
  policy_name = minio_iam_policy.replication.id
}

resource "minio_iam_service_account" "replication" {
  provider    = minio.cold
  target_user = minio_iam_user.replication.name

  depends_on = [minio_iam_user_policy_attachment.replication]
}

resource "minio_s3_bucket_replication" "hot_to_cold" {
  bucket = minio_s3_bucket.hot.bucket

  rule {
    delete_replication          = true
    delete_marker_replication   = true
    existing_object_replication = true
    metadata_sync               = false

    target {
      bucket     = minio_s3_bucket.cold.bucket
      host       = var.minio_cold_internal
      secure     = false
      access_key = minio_iam_service_account.replication.access_key
      secret_key = minio_iam_service_account.replication.secret_key
    }
  }

  depends_on = [
    minio_s3_bucket_versioning.hot,
    minio_s3_bucket_versioning.cold,
  ]
}
