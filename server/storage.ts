import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── S3 client ────────────────────────────────────────────────────────────────
// Credentials are injected by the Manus platform via environment variables.
// The BUILT_IN_FORGE_API_URL is used as a proxy endpoint for the S3-compatible
// object store; the API key acts as the AWS access key.

const BUCKET = process.env.MANUS_STORAGE_BUCKET ?? "portier369-attachments";
const REGION = process.env.MANUS_STORAGE_REGION ?? "us-east-1";
const ENDPOINT = process.env.MANUS_STORAGE_ENDPOINT; // optional custom endpoint

const s3 = new S3Client({
  region: REGION,
  ...(ENDPOINT ? { endpoint: ENDPOINT, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: process.env.MANUS_STORAGE_ACCESS_KEY ?? "local",
    secretAccessKey: process.env.MANUS_STORAGE_SECRET_KEY ?? "local",
  },
});

/**
 * Upload a buffer to S3 and return the public-accessible URL.
 * The key should be relative (e.g. "tickets/42/photo.jpg").
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = relKey.startsWith("/") ? relKey.slice(1) : relKey;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );

  // Build a path-style URL that the Manus storage proxy can serve
  const url = `/manus-storage/${key}`;
  return { key, url };
}

/**
 * Delete an object from S3 by its key.
 */
export async function storageDelete(relKey: string): Promise<void> {
  const key = relKey.startsWith("/") ? relKey.slice(1) : relKey;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
