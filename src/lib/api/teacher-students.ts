import { del, get, post, put } from './client';
import { User } from '../types';
import { mapUser } from './mappers';

export const teacherStudentsApi = {
  list: async (params?: { search?: string }): Promise<{ students: User[]; count: number }> => {
    const q: Record<string, string> = {};
    if (params?.search?.trim()) q.search = params.search.trim();
    const raw = await get<{ students: Record<string, unknown>[]; count: number }>(
      '/teacher/students',
      Object.keys(q).length ? q : undefined
    );
    return {
      students: (raw.students || []).map((s) => mapUser(s)),
      count: raw.count ?? 0,
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
