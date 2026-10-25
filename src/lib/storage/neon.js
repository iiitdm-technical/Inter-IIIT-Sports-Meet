import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

let client;

function config() {
  const { AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, NEON_STORAGE_BUCKET } = process.env;
  if (!AWS_ENDPOINT_URL_S3 || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !NEON_STORAGE_BUCKET) {
    throw new Error("Neon Object Storage is not configured");
  }
  return { endpoint: AWS_ENDPOINT_URL_S3, region: AWS_REGION, bucket: NEON_STORAGE_BUCKET };
}

function storage() {
  const settings = config();
  if (!client) {
    client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return { client, bucket: settings.bucket };
}

export async function putProof(key, bytes, contentType) {
  const { client, bucket } = storage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }));
}

export async function headProof(key) {
  const { client, bucket } = storage();
  const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { pathname: key, contentType: result.ContentType, size: result.ContentLength };
}

/** Returns { body: web ReadableStream, contentType, size }. */
export async function getProof(key) {
  const { client, bucket } = storage();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return { body: result.Body.transformToWebStream(), contentType: result.ContentType, size: result.ContentLength };
}

export async function deleteProof(key) {
  const { client, bucket } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Keys stored under `prefix` (at most 1,000; one IIIT holds only a few). */
export async function listProofs(prefix) {
  const { client, bucket } = storage();
  const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }));
  return (result.Contents || []).map((item) => item.Key).filter(Boolean);
}

/** Deployment preflight: write, read back and delete a small object. */
export async function checkStorage() {
  const { client, bucket } = storage();
  const key = `env-check/${randomUUID()}.txt`;
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "storage-ready", ContentType: "text/plain" }));
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if ((await object.Body.transformToString()) !== "storage-ready") throw new Error("Neon Object Storage returned unexpected content");
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  return "private Neon Object Storage bucket";
}
