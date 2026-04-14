import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { apiPost } from "./api";

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
        // Use JSON payload directly to bypass Yandex Gateway multipart/form-data corruption
        const base64Data = base64Image.includes('base64,') ? base64Image : `data:image/jpeg;base64,${base64Image}`;

        const payload = {
            imageBase64: base64Data,
            type: 'image',
            tab,
            userEmail,
            userId,
            appUrl: window.location.origin,
            currentList,
            currentStock,
            currentDiary,
            currentBaseline,
            list: currentList,
            stock: currentStock,
            priority
        };

        logDiagnostic('Vision: POST /ai/image (JSON)...', 'net');

        try {
          const result = await apiPost<any>('/ai/image', payload);
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
        if (error?.name === 'ApiError' && error.status === 403 && error.code === 'limit_reached') {
            logDiagnostic(`Vision Limit Reached: ${error.message}`, 'info');
            throw error;
        }
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

    // Convert Blob to Base64 to bypass Yandex API Gateway multipart corruption
    const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
    });

    const payload = {
        audioBase64: base64Audio,
        type: 'voice',
        userEmail,
        userId,
        appUrl: window.location.origin,
        currentList,
        currentStock,
        currentDiary,
        currentBaseline,
        list: currentList,
        stock: currentStock,
        priority
    };

    try {
        const json = await apiPost<any>('/ai/voice', payload);

        logDiagnostic(`Voice: Success received. Actions: ${json.actions?.length || 0}`, 'net');
        console.log('Voice Response Body:', JSON.stringify(json));

        let itemsCount = 0;
        if (json.actions) {
            json.actions.forEach((a: any) => {
                if (a.items) itemsCount += a.items.length;
            });
        }
        await logAssistantRequest(userEmail, itemsCount, "backend-voice");

        return json;
    } catch (error: any) {
        if (error?.name === 'ApiError' && error.status === 403 && error.code === 'limit_reached') {
            logDiagnostic(`Voice Limit Reached: ${error.message}`, 'info');
            throw error;
        }
        logDiagnostic(`Voice Exception: ${error.message}`, 'error');
        throw error;
    }
}

export async function runDiagnostic(_apiKey: string, userEmail: string) {
  await logAssistantRequest(userEmail, 0, "DIAGNOSTIC-N8N", undefined, "Проверка связи с n8n.");
  return ["n8n-webhook"];
}
