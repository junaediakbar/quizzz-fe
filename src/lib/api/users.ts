import { get, put, del } from './client';
import { User, UserRole } from '../types';
import { mapUser } from './mappers';

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  avatar?: string;
}

export interface UserListResponse {
  users: User[];
  count: number;
  /** Total pengguna yang cocok dengan filter (bukan panjang halaman). */
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Admin-only user endpoints (`/users`). The backend also accepts a `role`
 * query param on list, but the admin table fetches everything once and filters
 * client-side so search + role filter stay instant.
 */
export const usersApi = {
  list: async (filters?: {
    role?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserListResponse> => {
    const params: Record<string, string> = {};
    if (filters?.role) params.role = filters.role;
    if (filters?.search) params.search = filters.search;
    if (filters?.limit !== undefined) params.limit = String(filters.limit);
    if (filters?.offset) params.offset = String(filters.offset);
    const raw = await get<{
      users: Record<string, unknown>[];
      count?: number;
      total?: number;
      limit?: number;
      offset?: number;
      has_more?: boolean;
    }>('/users', Object.keys(params).length > 0 ? params : undefined);
    const users = (raw.users || []).map((u) => mapUser(u));
    return {
      users,
      count: raw.count ?? users.length,
      total: raw.total ?? raw.count ?? users.length,
      limit: raw.limit ?? 0,
      offset: raw.offset ?? 0,
      hasMore: raw.has_more ?? false,
    };
  },

  get: async (id: string): Promise<User> => {
    const raw = await get<Record<string, unknown>>(`/users/${id}`);
    return mapUser(raw);
  },

  update: async (id: string, data: UpdateUserRequest): Promise<User> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.email !== undefined) body.email = data.email;
    if (data.role !== undefined) body.role = data.role;
    if (data.avatar !== undefined) body.avatar = data.avatar;
    const raw = await put<Record<string, unknown>>(`/users/${id}`, body);
    return mapUser(raw);
  },

  delete: async (id: string): Promise<void> => {
    return del(`/users/${id}`);
  },
};
