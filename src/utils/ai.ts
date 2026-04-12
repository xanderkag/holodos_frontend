import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { apiPostFormData } from "./api";

// Оставляем для обратной совместимости — используется в AiContext для логов
export const N8N_TEXT_WEBHOOK_URL = '[via backend]';

type LogLevel = 'info' | 'net' | 'warn' | 'error';
let logCallback: ((msg: string, level: LogLevel) => void) | null = null;

export const setAiLogCallback = (cb: (msg: string, level: LogLevel) => void) => {
  logCallback = cb;
};

export const logDiagnostic = (msg: string, level: LogLevel = 'info') => {
  console.log(`[n8n-DIAG] ${msg}`);
  if (logCallback) logCallback(msg, level);
};

async function logAssistantRequest(userEmail: string, productsCount: number, model: string, error?: string, details?: string) {
  try {
    await addDoc(collection(db, 'ai_logs'), {
      userEmail,
      timestamp: serverTimestamp(),
      count: productsCount,
      model,
      error: error || null,
      details: details || null,
      status: error ? 'error' : 'success'
    });
  } catch (err) {
    console.error("Failed to log Assistant request:", err);
  }
}

async function base64ToBlob(base64: any, mimeType: string): Promise<Blob> {
  try {
    if (!base64 || typeof base64 !== 'string') {
        throw new Error('Данные изображения отсутствуют или повреждены');
    }
    const base64Data = base64.split(',')[1] || base64;
    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeType });
  } catch (err: any) {
    logDiagnostic(`n8n ERROR (Blob): ${err.message}`, 'error');
    throw new Error('Не удалось подготовить файл для отправки.');
  }
}

export async function analyzeImage(
    base64Image: any,
    userEmail: string,
    userId: string,
    tab: string,
    currentList: any[] = [],
    currentStock: any[] = [],
    currentDiary: any[] = [],
    currentBaseline: any[] = [],
    priority: 'normal' | 'priority' = 'normal'
): Promise<any> {
    const imgSizeKB = Math.round((base64Image?.length || 0) * 0.75 / 1024);
    logDiagnostic(`Vision: Preparing payload (~${imgSizeKB} KB)...`, 'info');

    try {
        const blob = await base64ToBlob(base64Image, 'image/jpeg');

        const formData = new FormData();
        formData.append('data', blob, 'image.jpg');
        formData.append('type', 'image');
        formData.append('tab', tab);
        formData.append('userEmail', userEmail);
        formData.append('userId', userId);
        formData.append('appUrl', window.location.origin);
        formData.append('currentList', JSON.stringify(currentList));
        formData.append('currentStock', JSON.stringify(currentStock));
        formData.append('currentDiary', JSON.stringify(currentDiary));
        formData.append('currentBaseline', JSON.stringify(currentBaseline));
        formData.append('list', JSON.stringify(currentList));
        formData.append('stock', JSON.stringify(currentStock));
        formData.append('priority', priority);

        logDiagnostic('Vision: POST /ai/image...', 'net');

        try {
          const result = await apiPostFormData<any>('/ai/image', formData);
          logDiagnostic('Vision: Success received', 'net');

          let itemsCount = 0;
          if (result.actions) {
              result.actions.forEach((a: any) => {
                  if (a.items) itemsCount += a.items.length;
              });
          }

          await logAssistantRequest(userEmail, itemsCount, "backend-image");
          return result;
        } catch (fetchErr: any) {
          logDiagnostic(`Vision Exception: ${fetchErr.message}`, 'error');
          throw fetchErr;
        }
    } catch (error: any) {
        console.error("Assistant Error (image):", error);
        await logAssistantRequest(userEmail, 0, "backend-image-FAILED", error.message);
        throw error;
    }
}

export async function sendVoiceToN8N(
    audioBlob: Blob,
    userEmail: string,
    userId: string,
    currentList: any[] = [],
    currentStock: any[] = [],
    currentDiary: any[] = [],
    currentBaseline: any[] = [],
    priority: 'normal' | 'priority' = 'normal'
): Promise<any> {
    logDiagnostic(`Voice: Preparing upload (${Math.round(audioBlob.size / 1024)} KB)...`, 'net');

    const fd = new FormData();
    fd.append('data', audioBlob, 'voice.webm');
    fd.append('type', 'voice');
    fd.append('userEmail', userEmail);
    fd.append('userId', userId);
    fd.append('appUrl', window.location.origin);
    fd.append('currentList', JSON.stringify(currentList));
    fd.append('currentStock', JSON.stringify(currentStock));
    fd.append('currentDiary', JSON.stringify(currentDiary));
    fd.append('currentBaseline', JSON.stringify(currentBaseline));
    fd.append('list', JSON.stringify(currentList));
    fd.append('stock', JSON.stringify(currentStock));
    fd.append('priority', priority);

    try {
        const json = await apiPostFormData<any>('/ai/voice', fd);
        logDiagnostic('Voice: Success received', 'net');

        let itemsCount = 0;
        if (json.actions) {
            json.actions.forEach((a: any) => {
                if (a.items) itemsCount += a.items.length;
            });
        }
        await logAssistantRequest(userEmail, itemsCount, "backend-voice");

        return json;
    } catch (err: any) {
        logDiagnostic(`Voice Exception: ${err.message}`, 'error');
        throw err;
    }
}

export async function runDiagnostic(_apiKey: string, userEmail: string) {
  await logAssistantRequest(userEmail, 0, "DIAGNOSTIC-N8N", undefined, "Проверка связи с n8n.");
  return ["n8n-webhook"];
}
