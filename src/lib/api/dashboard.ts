import { get } from './client';
import { StudentDashboardStats, TeacherDashboardStats } from '@/lib/types';
import { mapStudentDashboard, mapTeacherDashboard } from './mappers';

export const dashboardApi = {
  teacher: async (userId: string): Promise<TeacherDashboardStats> => {
    const raw = await get<Record<string, unknown>>(`/dashboard/teacher/${userId}`);
    return mapTeacherDashboard(raw);
  },
  student: async (userId: string): Promise<StudentDashboardStats> => {
    const raw = await get<Record<string, unknown>>(`/dashboard/student/${userId}`);
    return mapStudentDashboard(raw);
  },
};
