import { del, get, post, put } from './client';
import { User } from '../types';
import { mapUser } from './mappers';

export const teacherStudentsApi = {
  list: async (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    students: User[];
    count: number;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> => {
    const q: Record<string, string> = {};
    if (params?.search?.trim()) q.search = params.search.trim();
    if (params?.limit !== undefined) q.limit = String(params.limit);
    if (params?.offset) q.offset = String(params.offset);
    const raw = await get<{
      students: Record<string, unknown>[];
      count?: number;
      total?: number;
      limit?: number;
      offset?: number;
      has_more?: boolean;
    }>('/teacher/students', Object.keys(q).length ? q : undefined);
    const students = (raw.students || []).map((s) => mapUser(s));
    return {
      students,
      count: raw.count ?? students.length,
      total: raw.total ?? raw.count ?? students.length,
      limit: raw.limit ?? 0,
      offset: raw.offset ?? 0,
      hasMore: raw.has_more ?? false,
    };
  },

  get: async (id: string): Promise<User> => {
    const raw = await get<Record<string, unknown>>(`/teacher/students/${id}`);
    return mapUser(raw);
  },

  create: async (data: {
    name: string;
    email: string;
    password?: string;
  }): Promise<User> => {
    const raw = await post<Record<string, unknown>>('/teacher/students', data);
    return mapUser(raw);
  },

  update: async (
    id: string,
    data: { name?: string; email?: string; avatar?: string | null }
  ): Promise<User> => {
    const raw = await put<Record<string, unknown>>(`/teacher/students/${id}`, data);
    return mapUser(raw);
  },

  delete: async (id: string): Promise<void> => {
    await del(`/teacher/students/${id}`);
  },
};
