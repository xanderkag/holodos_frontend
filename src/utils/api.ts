import { auth } from './firebase';

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

async function getIdToken(): Promise<string> {
  const { isDemoMode } = await import('./demoMocks');
  if (isDemoMode()) return 'demo_token';

  const user = auth.currentUser;
  if (!user) throw new Error('Пользователь не авторизован');
  return user.getIdToken();
}

// JSON запрос к backend
export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { isDemoMode, mockApiPost } = await import('./demoMocks');
  if (isDemoMode()) return mockApiPost<T>(path, body);

  const token = await getIdToken();
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 413) throw new ApiError('Файл слишком большой', 413, 'payload_too_large');
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(err.message || `Ошибка сервера ${response.status}`, response.status, err.code, err);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      throw new ApiError('Превышено время ожидания ответа от сервера', 408, 'timeout');
    }
    if (error.name === 'ApiError') throw error;
    throw error;
  }
}

// PATCH запрос к backend
export async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { isDemoMode, mockApiPost } = await import('./demoMocks');
  if (isDemoMode()) return mockApiPost<T>(path, body);

  const token = await getIdToken();
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 413) throw new ApiError('Файл слишком большой', 413, 'payload_too_large');
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(err.message || `Ошибка сервера ${response.status}`, response.status, err.code, err);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      throw new ApiError('Превышено время ожидания ответа от сервера', 408, 'timeout');
    }
    if (error.name === 'ApiError') throw error;
    throw error;
  }
}

// Multipart запрос к backend (для файлов)
export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const { isDemoMode, mockApiPost } = await import('./demoMocks');
  if (isDemoMode()) {
    // We convert formData to a record for the mock or pass an empty object
    return mockApiPost<T>(path, {}); 
  }

  const token = await getIdToken();
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: {
        'X-Firebase-Authorization': `Bearer ${token}`,
        // Content-Type НЕ выставляем — браузер сам добавит boundary для multipart
      },
      signal: AbortSignal.timeout(60000),
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 413) throw new ApiError('Файл слишком большой', 413, 'payload_too_large');
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(err.message || `Ошибка сервера ${response.status}`, response.status, err.code, err);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      throw new ApiError('Превышено время ожидания ответа от сервера', 408, 'timeout');
    }
    if (error.name === 'ApiError') throw error;
    throw error;
  }
}
