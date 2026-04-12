import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = import.meta.env.VITE_YANDEX_REGION || "ru-central1";
const BUCKET_NAME = import.meta.env.VITE_YANDEX_BUCKET_NAME || "holodos-app-ru";

// Yandex Cloud Object Storage is S3-compatible.
// Credentials MUST be provided in environment variables.
const s3Client = new S3Client({
  region: REGION,
  endpoint: "https://storage.yandexcloud.net",
  credentials: {
    accessKeyId: import.meta.env.VITE_YANDEX_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.VITE_YANDEX_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Uploads a file (Blob) to Yandex Object Storage and returns its public URL.
 * @param blob The file to upload.
 * @param fileName The name of the file (e.g., 'photo.jpg').
 * @param userId The ID of the user performing the upload.
 * @param folder The folder to store the file in (e.g., 'images', 'voice').
 */
export async function uploadToYandex(
  blob: Blob,
  fileName: string,
  userId: string,
  folder: string = "uploads"
): Promise<string> {
  const timestamp = Date.now();
  const safeFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
  const key = `${folder}/${userId}/${timestamp}_${safeFileName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: blob,
      ContentType: blob.type,
      // Note: ACL 'public-read' requires the bucket to allow it.
      // Based on the screenshot, the bucket has public access enabled.
      ACL: "public-read",
    });

    await s3Client.send(command);

    // Construct the public URL
    const publicUrl = `https://${BUCKET_NAME}.storage.yandexcloud.net/${key}`;
    console.log(`[Storage] File uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("[Storage] Error uploading to Yandex Cloud:", error);
    throw new Error("Не удалось загрузить файл в облачное хранилище.");
  }
}
