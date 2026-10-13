import { get, post, put } from './client';
import { Question, ExamResult } from '../types';
import { mapExamResult, mapQuestion } from './mappers';
import { mapSecurityFromApi, type ExamSecuritySettings } from '@/lib/exam-security';

export interface StartSessionRequest {
  exam_id: string;
}

/** Bagian ujian yang dikirim backend saat sesi dimulai */
export interface SessionPart {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  questionCount: number;
}

export interface StartSessionResponse {
  /** true jika murid sudah pernah submit — tidak ada soal untuk dikerjakan lagi */
  already_completed?: boolean;
  session_id: string;
  exam_id: string;
  exam_title?: string;
  result_id?: string;
  questions: Question[];
  duration: number;
  started_at: string;
  answers?: Record<string, string>;
  score?: number | null;
  security?: ExamSecuritySettings;
  /** Bagian-bagian soal (kosong bila ujian tidak punya bagian) */
  parts?: SessionPart[];
  /** Percobaan ke-berapa (1-based) */
  attemptNumber?: number;
}

/** Satu pelanggaran integritas yang dicatat selama ujian */
export interface ProctoringEvent {
  id: string;
  sessionId: string;
  eventType: string;
  detail?: Record<string, unknown>;
  createdAt: string;
}

export interface SubmitAnswerRequest {
  question_id: string;
  answer: string;
}

export const sessionsApi = {
  start: async (data: StartSessionRequest): Promise<StartSessionResponse> => {
    const raw = await post<{
      already_completed?: boolean;
      session_id: string;
      exam_id: string;
      exam_title?: string;
      result_id?: string;
      questions?: Record<string, unknown>[];
      duration?: number;
      started_at?: string;
      answers?: Record<string, string>;
      score?: number | null;
      security?: Record<string, unknown>;
      parts?: Record<string, unknown>[];
      attempt_number?: number;
    }>('/sessions', data);
    if (raw.already_completed) {
      return {
        already_completed: true,
        session_id: raw.session_id,
        exam_id: raw.exam_id,
        exam_title: raw.exam_title,
        result_id: raw.result_id,
        questions: [],
        duration: raw.duration ?? 0,
        started_at: raw.started_at ?? new Date().toISOString(),
        score: raw.score,
      };
    }
    return {
      session_id: raw.session_id,
      exam_id: raw.exam_id,
      exam_title: raw.exam_title,
      questions: (raw.questions || []).map((q) => mapQuestion(q as Record<string, unknown>)),
      duration: raw.duration ?? 60,
      started_at: raw.started_at ?? new Date().toISOString(),
      answers: raw.answers,
      security: mapSecurityFromApi(raw.security),
      attemptNumber: raw.attempt_number,
      parts: (raw.parts || []).map((p) => ({
        id: String(p.id ?? ''),
        title: String(p.title ?? ''),
        description: p.description ? String(p.description) : undefined,
        orderIndex: Number(p.order_index ?? 0),
        questionCount: Number(p.question_count ?? 0),
      })),
    };
  },

  get: async (id: string): Promise<unknown> => {
    return get(`/sessions/${id}`);
  },

  submitAnswer: async (id: string, data: SubmitAnswerRequest): Promise<void> => {
    return put(`/sessions/${id}/answer`, data);
  },

  submitExam: async (id: string): Promise<{ result_id: string; time_exceeded?: boolean }> => {
    return put(`/sessions/${id}/submit`);
  },

  /** Pelanggaran integritas yang tercatat pada sebuah sesi (guru pemilik ujian / murid). */
  getProctoringEvents: async (sessionId: string): Promise<ProctoringEvent[]> => {
    const raw = await get<{ events?: Record<string, unknown>[] }>(
      `/sessions/${sessionId}/proctoring-events`
    );
    return (raw.events || []).map((e) => {
      let detail: Record<string, unknown> | undefined;
      if (typeof e.detail === 'string' && e.detail) {
        try {
          detail = JSON.parse(e.detail) as Record<string, unknown>;
        } catch {
          detail = undefined;
        }
      } else if (e.detail && typeof e.detail === 'object') {
        detail = e.detail as Record<string, unknown>;
      }
      return {
        id: String(e.id ?? ''),
        sessionId: String(e.session_id ?? sessionId),
        eventType: String(e.event_type ?? ''),
        detail,
        createdAt: String(e.created_at ?? ''),
      };
    });
  },

  getResult: async (id: string): Promise<ExamResult> => {
    const raw = await get<Record<string, unknown>>(`/sessions/${id}/result`);
    return mapExamResult(raw);
  },

  /** Anti-cheating / focus events (PRD §3.4) */
  logProctoringEvent: async (
    sessionId: string,
    eventType: string,
    detail?: Record<string, unknown>
  ): Promise<void> => {
    await post(`/sessions/${sessionId}/proctoring-events`, {
      event_type: eventType,
      detail: detail ?? {},
    });
  },
};
