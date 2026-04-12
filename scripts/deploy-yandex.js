const { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const fs = require("fs");
const path = require("path");

const REGION = process.env.VITE_YANDEX_REGION || "ru-central1";
const BUCKET_NAME = process.env.VITE_YANDEX_BUCKET_NAME || "holodos-app-ru";

const s3Client = new S3Client({
  region: REGION,
  endpoint: "https://storage.yandexcloud.net",
  credentials: {
    accessKeyId: process.env.VITE_YANDEX_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_YANDEX_SECRET_ACCESS_KEY,
  },
});

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
};

async function uploadFolder(folderPath, baseFolder = "") {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const fullPath = path.join(folderPath, file);
    const relativePath = path.join(baseFolder, file);

    if (fs.lstatSync(fullPath).isDirectory()) {
      await uploadFolder(fullPath, relativePath);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const fileContent = fs.readFileSync(fullPath);

      console.log(`📤 Загрузка: ${relativePath} (${contentType})`);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: relativePath.replace(/\\/g, "/"), // Ensure S3 uses forward slashes
          Body: fileContent,
          ContentType: contentType,
        })
      );
    }
  }
}

async function run() {
  const distPath = path.join(__dirname, "../dist");
  if (!fs.existsSync(distPath)) {
    console.error("❌ Ошибка: папка dist не найдена. Сначала запусти 'npm run build'!");
    process.exit(1);
  }

  console.log(`🚀 Начинаю деплой в бакет: ${BUCKET_NAME}...`);
  try {
    await uploadFolder(distPath);
    console.log("✅ Деплой успешно завершен!");
    console.log(`🔗 Ссылка на сайт: http://${BUCKET_NAME}.website.yandexcloud.net`);
  } catch (error) {
    console.error("❌ Ошибка деплоя:", error);
    process.exit(1);
  }
}

run();
