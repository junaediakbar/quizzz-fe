import { RequestOptions, ApiError } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Token storage helpers
const TOKEN_KEY = 'quizapp_token';

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
};

// Build URL with query parameters
const buildUrl = (endpoint: string, params?: Record<string, string>): string => {
  const url = `${API_URL}${endpoint}`;
  if (!params) return url;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
};

// Main API client function
export const apiRequest = async <T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const {
    method = 'GET',
    body,
    headers = {},
    params,
  } = options;

  const url = buildUrl(endpoint, params);

  // Default headers
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = getAuthToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Merge headers
  const finalHeaders = { ...defaultHeaders, ...headers };

  const config: RequestInit = {
    method,
    headers: finalHeaders,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      removeAuthToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    // Handle other error statuses
    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // 204 / empty body — jangan parse JSON (DELETE bank, hapus tautan bank, dll.)
    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text.trim()) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Invalid JSON response');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
};

// Convenience methods
export const get = <T = unknown>(endpoint: string, params?: Record<string, string>): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'GET', params });
};

export const post = <T = unknown>(endpoint: string, body?: unknown): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'POST', body });
};

/** Multipart upload (no Content-Type — browser sets boundary). */
export async function postFormData<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
  const url = buildUrl(endpoint);
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { method: 'POST', headers, body: formData });
  if (response.status === 401) {
    removeAuthToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const put = <T = unknown>(endpoint: string, body?: unknown): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'PUT', body });
};

export const del = <T = unknown>(endpoint: string): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
};

export const patch = <T = unknown>(endpoint: string, body?: unknown): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'PATCH', body });
};

/** GET JSON export / attachment — downloads blob without forcing JSON parse */
export async function downloadBlobGet(
  endpoint: string,
  params?: Record<string, string>,
  filename = 'download.json'
): Promise<void> {
  const url = buildUrl(endpoint, params);
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    removeAuthToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as ApiError).error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
