import { post } from './client';
import { setAuthToken } from './client';
import { User } from '../types';
import { mapUser } from './mappers';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'teacher' | 'student' | 'admin';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await post<{ token: string; user: Record<string, unknown> }>('/auth/register', data);
    if (response.token) {
      setAuthToken(response.token);
    }
    return { token: response.token, user: mapUser(response.user) };
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await post<{ token: string; user: Record<string, unknown> }>('/auth/login', data);
    if (response.token) {
      setAuthToken(response.token);
    }
    return { token: response.token, user: mapUser(response.user) };
  },

  logout: async (): Promise<void> => {
    try {
      await post('/auth/logout');
    } finally {
      // Always remove token locally, even if API call fails
      const { removeAuthToken } = await import('./client');
      removeAuthToken();
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const raw = await get<Record<string, unknown>>('/auth/me');
    return mapUser(raw);
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const raw = await put<Record<string, unknown>>('/auth/me', data);
    return mapUser(raw);
  },

  changePassword: async (data: ChangePasswordRequest): Promise<{ message: string }> => {
    return put<{ message: string }>('/auth/password', data);
  },
};

// Re-import get for consistency
import { get, put } from './client';
