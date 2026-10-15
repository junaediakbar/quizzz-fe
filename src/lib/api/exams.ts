import { get, post, put, del } from './client';
import { Exam, ExamConfig } from '../types';
import { mapExam } from './mappers';

export interface LiveStudentSession {
  sessionId: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  answeredCount: number;
  /** questionId -> jawaban sementara murid */
  answers: Record<string, string>;
}

export interface LiveExamResponse {
  examId: string;
  examTitle: string;
  totalQuestions: number;
  serverTime: string;
  sessions: LiveStudentSession[];
}

/** Bagian ujian yang dikirim ke backend (snake_case) */
export interface ExamPartRequest {
  title: string;
  description?: string;
  question_ids: string[];
  /** > 0 menimpa poin bank soal untuk semua soal di bagian ini */
  points_per_question?: number;
}

export interface CreateExamRequest {
  title: string;
  description?: string;
  subject: string;
  grade: string;
  config: ExamConfig;
  question_ids?: string[];
  /** Bila diisi, soal dikelompokkan per bagian (question_ids diabaikan backend) */
  parts?: ExamPartRequest[];
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
  parts?: ExamPartRequest[];
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface ExamListResponse {
  exams: Exam[];
  count: number;
  /** Total ujian yang cocok dengan filter (bukan panjang halaman). */
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ExamListResponse> => {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.subject) params.subject = filters.subject;
    if (filters?.search) params.search = filters.search;
    if (filters?.limit !== undefined) params.limit = String(filters.limit);
    if (filters?.offset) params.offset = String(filters.offset);
    const raw = await get<{
      exams: Record<string, unknown>[];
      count?: number;
      total?: number;
      limit?: number;
      offset?: number;
      has_more?: boolean;
    }>('/exams', Object.keys(params).length > 0 ? params : undefined);
    return {
      exams: (raw.exams || []).map((e) => mapExam(e)),
      count: raw.count ?? (raw.exams || []).length,
      total: raw.total ?? raw.count ?? (raw.exams || []).length,
      limit: raw.limit ?? 0,
      offset: raw.offset ?? 0,
      hasMore: raw.has_more ?? false,
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
      ...(data.parts && data.parts.length > 0 ? { parts: data.parts } : {}),
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
    if (data.parts !== undefined) body.parts = data.parts;
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

  /** Sesi aktif murid + jawaban sementara (live monitoring, guru pemilik ujian). */
  getLive: async (id: string): Promise<LiveExamResponse> => {
    const raw = await get<{
      exam_id: string;
      exam_title?: string;
      total_questions?: number;
      server_time?: string;
      sessions?: Record<string, unknown>[];
    }>(`/exams/${id}/live`);
    return {
      examId: raw.exam_id,
      examTitle: raw.exam_title ?? '',
      totalQuestions: Number(raw.total_questions ?? 0),
      serverTime: raw.server_time ?? new Date().toISOString(),
      sessions: (raw.sessions || []).map((s) => ({
        sessionId: String(s.session_id ?? ''),
        studentId: String(s.student_id ?? ''),
        studentName: String(s.student_name ?? ''),
        attemptNumber: Number(s.attempt_number ?? 1),
        status: String(s.status ?? ''),
        startedAt: s.started_at ? String(s.started_at) : null,
        submittedAt: s.submitted_at ? String(s.submitted_at) : null,
        updatedAt: String(s.updated_at ?? ''),
        answeredCount: Number(s.answered_count ?? 0),
        answers: (s.answers && typeof s.answers === 'object' ? s.answers : {}) as Record<string, string>,
      })),
    };
  },
};
