import type { ApiResponse, AuthTokens } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  const payload = await parseJson<T>(response);

  if (!response.ok || payload.success === false) {
    const message = payload.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload.data;
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
    apiRequest<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }, false),
};

export { API_URL };
