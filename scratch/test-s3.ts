import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// ВСТАВЬ СВОИ КЛЮЧИ СЮДА ДЛЯ ТЕСТА (потом удалим)
const ACCESS_KEY_ID = "YCAJEDjFtwbJUKPLPCRuQ6IJJ"; 
const SECRET_ACCESS_KEY = "ТВОЙ_СЕКРЕТНЫЙ_КЛЮЧ"; 
const BUCKET_NAME = "holodos-app-ru";

const client = new S3Client({
  region: "ru-central1",
  endpoint: "https://storage.yandexcloud.net",
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

async function testConnection() {
  console.log("🚀 Начинаю проверку связи с Yandex Cloud...");
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const response = await client.send(command);
    console.log("✅ Успех! Соединение установлено.");
    console.log(`B бакете '${BUCKET_NAME}' найдено объектов: ${response.KeyCount}`);
  } catch (err: any) {
    console.error("❌ Ошибка соединения:", err.message);
    if (err.message.includes("SignatureDoesNotMatch")) {
      console.error("👉 Скорее всего, ошибка в Secret Access Key.");
    }
  }
}

testConnection();
