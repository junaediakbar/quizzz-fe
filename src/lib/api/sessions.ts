import { get, post, put } from './client';
import { Question, ExamResult } from '../types';
import { mapExamResult, mapQuestion } from './mappers';

export interface StartSessionRequest {
  exam_id: string;
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
    };
  },

  get: async (id: string): Promise<unknown> => {
    return get(`/sessions/${id}`);
  },

  submitAnswer: async (id: string, data: SubmitAnswerRequest): Promise<void> => {
    return put(`/sessions/${id}/answer`, data);
  },

  submitExam: async (id: string): Promise<{ result_id: string }> => {
    return put(`/sessions/${id}/submit`);
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
