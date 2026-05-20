import { get } from './client';
import { ExamResult } from '../types';
import { mapExamResult } from './mappers';

export const resultsApi = {
  list: async (params?: { exam_id?: string }): Promise<ExamResult[]> => {
    const qs = params?.exam_id ? `?exam_id=${encodeURIComponent(params.exam_id)}` : '';
    const raw = await get<{ results: Record<string, unknown>[] }>(`/results${qs}`);
    return (raw.results || []).map((r) => mapExamResult(r));
  },

  get: async (id: string): Promise<ExamResult> => {
    const raw = await get<Record<string, unknown>>(`/results/${id}`);
    return mapExamResult(raw);
  },
};
