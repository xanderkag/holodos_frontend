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
  const user = auth.currentUser;
  if (!user) throw new Error('Пользователь не авторизован');
  return user.getIdToken();
}

// JSON запрос к backend
export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(err.message || `Ошибка сервера ${response.status}`, response.status, err.code, err);
  }

  return response.json();
}

// PATCH запрос к backend
export async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(err.message || `Ошибка сервера ${response.status}`, response.status, err.code, err);
  }

  return response.json();
}

// Multipart запрос к backend (для файлов)
export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'X-Firebase-Authorization': `Bearer ${token}`,
      // Content-Type НЕ выставляем — браузер сам добавит boundary для multipart
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(err.message || `Ошибка сервера ${response.status}`, response.status, err.code, err);
  }

  return response.json();
}
