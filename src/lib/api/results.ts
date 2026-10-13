import { del, get, put } from './client';
import { ExamResult } from '../types';
import { mapExamResult } from './mappers';

export interface GradeResultRequest {
  /** question_id -> poin yang diberikan (0..max_points) */
  points?: Record<string, number>;
  /** question_id -> umpan balik untuk murid */
  feedback?: Record<string, string>;
}

export interface GradeResultResponse {
  message: string;
  score: number;
  passed: boolean;
}

export const resultsApi = {
  list: async (params?: {
    exam_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    results: ExamResult[];
    count: number;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> => {
    const q = new URLSearchParams();
    if (params?.exam_id) q.set('exam_id', params.exam_id);
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    const raw = await get<{
      results: Record<string, unknown>[];
      count?: number;
      total?: number;
      limit?: number;
      offset?: number;
      has_more?: boolean;
    }>(`/results${qs ? `?${qs}` : ''}`);
    const results = (raw.results || []).map((r) => mapExamResult(r));
    return {
      results,
      count: raw.count ?? results.length,
      total: raw.total ?? raw.count ?? results.length,
      limit: raw.limit ?? 0,
      offset: raw.offset ?? 0,
      hasMore: raw.has_more ?? false,
    };
  },

  get: async (id: string): Promise<ExamResult> => {
    const raw = await get<Record<string, unknown>>(`/results/${id}`);
    return mapExamResult(raw);
  },

  /**
   * Penilaian manual (guru/admin): timpa poin per soal + simpan umpan balik.
   * Backend menghitung ulang total skor & status lulus dari poin tersebut.
   * Response: { message, score, passed } — bukan objek hasil lengkap.
   */
  grade: async (id: string, data: GradeResultRequest): Promise<GradeResultResponse> => {
    return put<GradeResultResponse>(`/results/${id}/grade`, {
      ...(data.points ? { points: data.points } : {}),
      ...(data.feedback ? { feedback: data.feedback } : {}),
    });
  },

  delete: async (id: string): Promise<void> => {
    return del(`/results/${id}`);
  },
};
