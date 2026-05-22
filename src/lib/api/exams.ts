import { get, post, put, del } from './client';
import { Exam, ExamConfig } from '../types';
import { mapExam } from './mappers';

export interface CreateExamRequest {
  title: string;
  description?: string;
  subject: string;
  grade: string;
  config: ExamConfig;
  question_ids?: string[];
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface UpdateExamRequest {
  title?: string;
  description?: string;
  subject?: string;
  grade?: string;
  config?: ExamConfig;
  status?: string;
  question_ids?: string[];
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface ExamListResponse {
  exams: Exam[];
  count: number;
}

/** Backend expects snake_case JSON keys on ExamConfig */
function configToApi(c: ExamConfig) {
  return {
    duration: c.duration,
    shuffle_questions: c.shuffleQuestions,
    shuffle_options: c.shuffleOptions,
    show_results: c.showResults,
    allow_review: c.allowReview,
    max_attempts: c.maxAttempts,
    passing_score: c.passingScore,
    security_enabled: c.securityEnabled,
    max_violations: c.maxViolations,
    require_fullscreen: c.requireFullscreen,
    block_copy_paste: c.blockCopyPaste,
    detect_focus_loss: c.detectFocusLoss,
  };
}

export const examsApi = {
  list: async (filters?: {
    status?: string;
    subject?: string;
    limit?: number;
  }): Promise<ExamListResponse> => {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.subject) params.subject = filters.subject;
    if (filters?.limit) params.limit = filters.limit.toString();
    const raw = await get<{ exams: Record<string, unknown>[]; count: number }>(
      '/exams',
      Object.keys(params).length > 0 ? params : undefined
    );
    return {
      exams: (raw.exams || []).map((e) => mapExam(e)),
      count: raw.count ?? (raw.exams || []).length,
    };
  },

  get: async (id: string): Promise<Exam> => {
    const raw = await get<Record<string, unknown>>(`/exams/${id}`);
    return mapExam(raw);
  },

  create: async (data: CreateExamRequest): Promise<Exam> => {
    const raw = await post<Record<string, unknown>>('/exams', {
      title: data.title,
      description: data.description ?? '',
      subject: data.subject,
      grade: data.grade,
      config: configToApi(data.config),
      question_ids: data.question_ids,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
    });
    return mapExam(raw);
  },

  update: async (id: string, data: UpdateExamRequest): Promise<Exam> => {
    const body: Record<string, unknown> = {};
    if (data.title !== undefined) body.title = data.title;
    if (data.description !== undefined) body.description = data.description;
    if (data.subject !== undefined) body.subject = data.subject;
    if (data.grade !== undefined) body.grade = data.grade;
    if (data.config !== undefined) body.config = configToApi(data.config);
    if (data.status !== undefined) body.status = data.status;
    if (data.question_ids !== undefined) body.question_ids = data.question_ids;
    if (data.scheduled_start !== undefined) body.scheduled_start = data.scheduled_start;
    if (data.scheduled_end !== undefined) body.scheduled_end = data.scheduled_end;
    const raw = await put<Record<string, unknown>>(`/exams/${id}`, body);
    return mapExam(raw);
  },

  delete: async (id: string): Promise<void> => {
    return del(`/exams/${id}`);
  },

  publish: async (id: string): Promise<Exam> => {
    const raw = await post<Record<string, unknown>>(`/exams/${id}/publish`);
    return mapExam(raw);
  },

  getAnalytics: async (id: string): Promise<unknown> => {
    return get(`/exams/${id}/analytics`);
  },
};
