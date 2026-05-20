import { get, post, put, del } from './client';
import { Question, QuestionType } from '../types';
import { mapQuestion } from './mappers';

export interface CreateQuestionRequest {
  type: QuestionType;
  title: string;
  content: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  tags?: string[];
  /** HTTPS image URLs (from /media/upload or any public URL) */
  image_urls?: string[];
  category_id?: string;
}

export interface UpdateQuestionRequest {
  type: QuestionType;
  title: string;
  content: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  tags?: string[];
  image_urls?: string[] | null;
  category_id?: string;
}

export interface QuestionListResponse {
  questions: Question[];
  count: number;
}

export const questionsApi = {
  list: async (filters?: {
    type?: string;
    difficulty?: string;
    category_id?: string;
    created_by?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<QuestionListResponse> => {
    const params: Record<string, string> = {};
    if (filters?.type) params.type = filters.type;
    if (filters?.difficulty) params.difficulty = filters.difficulty;
    if (filters?.category_id) params.category_id = filters.category_id;
    if (filters?.created_by) params.created_by = filters.created_by;
    if (filters?.search) params.search = filters.search;
    if (filters?.limit) params.limit = filters.limit.toString();
    if (filters?.offset) params.offset = filters.offset.toString();
    const raw = await get<{ questions: Record<string, unknown>[]; count: number }>(
      '/questions',
      Object.keys(params).length > 0 ? params : undefined
    );
    return {
      questions: (raw.questions || []).map((q) => mapQuestion(q)),
      count: raw.count ?? (raw.questions || []).length,
    };
  },

  get: async (id: string): Promise<Question> => {
    const raw = await get<Record<string, unknown>>(`/questions/${id}`);
    return mapQuestion(raw);
  },

  create: async (data: CreateQuestionRequest): Promise<Question> => {
    const raw = await post<Record<string, unknown>>('/questions', data);
    return mapQuestion(raw);
  },

  update: async (id: string, data: UpdateQuestionRequest): Promise<Question> => {
    const raw = await put<Record<string, unknown>>(`/questions/${id}`, data);
    return mapQuestion(raw);
  },

  delete: async (id: string): Promise<void> => {
    return del(`/questions/${id}`);
  },

  import: async (
    questions: CreateQuestionRequest[]
  ): Promise<{
    imported: number;
    questions: Question[];
    failed?: { index: number; error: string }[];
  }> => {
    const raw = await post<{
      imported: number;
      questions: Record<string, unknown>[];
      failed?: { index: number; error: string }[];
    }>('/questions/import', questions);
    return {
      imported: raw.imported,
      questions: (raw.questions || []).map((q) => mapQuestion(q)),
      failed: raw.failed,
    };
  },

  export: async (filters?: {
    created_by?: string;
  }): Promise<unknown> => {
    return get('/questions/export', filters);
  },

  getMissingOptions: async (): Promise<QuestionListResponse> => {
    const raw = await get<{ questions: Record<string, unknown>[]; count: number }>(
      '/questions/missing-options'
    );
    return {
      questions: (raw.questions || []).map((q) => mapQuestion(q)),
      count: raw.count ?? 0,
    };
  },

  bulkFixOptions: async (fixes: { question_id: string; options: string[] }[]): Promise<{
    updated: number;
    failed: string[];
  }> => {
    return post('/questions/bulk-fix-options', fixes);
  },
};
