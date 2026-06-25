import type { ApiResponse, AuthTokens } from './types';

const PRODUCTION_API_URL = 'https://territory-run-api-erbs.onrender.com';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:3000');

type TokenGetter = () => string | null;
type TokenRefresher = () => Promise<string | null>;

let getAccessToken: TokenGetter = () => null;
let refreshAccessToken: TokenRefresher = async () => null;

export function configureApiAuth(getter: TokenGetter, refresher: TokenRefresher) {
  getAccessToken = getter;
  refreshAccessToken = refresher;
}

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  return response.json() as Promise<ApiResponse<T>>;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  timeoutMs = 120_000,
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    signal: options.signal ?? controller.signal,
  };

  try {
    let response = await fetch(`${API_URL}${path}`, fetchOptions);

    if (response.status === 401 && auth) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
      }
    }

    const payload = await parseJson<T>(response);

    if (!response.ok || payload.success === false) {
      const message = payload.error?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return payload.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Сервер не ответил вовремя (таймаут 2 мин). Render мог просыпаться — попробуйте ещё раз.',
      );
    }
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        'Не удалось связаться с сервером. Подождите ~30 сек (Render просыпается) и попробуйте снова.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiUploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<T>(path, { method: 'POST', body: formData });
}

export const authApi = {
  register: (email: string, nickname: string, password: string) =>
    apiRequest<AuthTokens>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, nickname, password }),
    }, false),

  login: (email: string, password: string) =>
    apiRequest<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false),

  refresh: (refreshToken: string) =>
    apiRequest<{ accessToken: string; refreshToken?: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }, false),

  logout: async (refreshToken: string) => {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok && response.status !== 204) {
      throw new Error('Не удалось выйти из аккаунта');
    }
  },
};

export { API_URL };
