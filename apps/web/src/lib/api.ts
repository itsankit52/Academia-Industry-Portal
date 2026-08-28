import axios, { type AxiosRequestConfig } from 'axios';
import type { ApiSuccess } from '@aip/types';
import { ApiClientError } from './ApiClientError';

let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status: number | undefined = error.response?.status;
    const code: string | undefined = error.response?.data?.error?.code;

    if (status === 401 && code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push(() => resolve(api(original)));
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        refreshQueue.forEach((cb) => cb());
        refreshQueue = [];
        return api(original);
      } catch {
        refreshQueue = [];
        const { useAuthStore } = await import('@/store/auth');
        useAuthStore.getState().clearUser();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    const errData = error.response?.data?.error;
    throw new ApiClientError(
      errData?.code ?? 'UNKNOWN',
      errData?.message ?? error.message ?? 'An unexpected error occurred.',
      errData?.details,
      status,
    );
  },
);

async function unwrap<T>(promise: Promise<{ data: unknown; status: number }>): Promise<T> {
  const { data, status } = await promise;
  if (status === 204 || data === null || data === undefined || data === '') {
    return undefined as unknown as T;
  }
  const envelope = data as ApiSuccess<T>;
  return envelope.data;
}

export function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.get(url, config));
}

export function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.post(url, body, config));
}

export function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.put(url, body, config));
}

export function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.patch(url, body, config));
}

export function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.delete(url, config));
}
