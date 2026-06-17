import { S3Client } from "@aws-sdk/client-s3";

export const HOT_BUCKET = process.env.S3_BUCKET_HOT ?? "app-hot";
export const COLD_BUCKET = process.env.S3_BUCKET_COLD ?? "app-cold";

const region = process.env.S3_REGION ?? "us-east-1";
const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true";
const credentials = {
  accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
  secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin",
};

export const hotClient = new S3Client({
  region,
  endpoint: process.env.S3_ENDPOINT ?? "http://minio-hot:9000",
  forcePathStyle,
  credentials,
});

export const coldClient = new S3Client({
  region,
  endpoint: process.env.S3_ENDPOINT_COLD ?? "http://minio-cold:9000",
  forcePathStyle,
  credentials,
});
