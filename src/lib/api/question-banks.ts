import { get, post, put, del } from './client';
import { Question, QuestionBank } from '../types';
import { mapQuestion, mapQuestionBank } from './mappers';

export interface CreateQuestionBankRequest {
  name: string;
  description?: string;
  is_public?: boolean;
}

export const questionBanksApi = {
  list: async (): Promise<{ banks: QuestionBank[]; count: number }> => {
    const raw = await get<{ banks: Record<string, unknown>[]; count: number }>('/question-banks');
    return {
      banks: (raw.banks || []).map((b) => mapQuestionBank(b)),
      count: raw.count ?? 0,
    };
  },

  get: async (id: string): Promise<{ bank: QuestionBank; questions: Question[] }> => {
    const raw = await get<{
      bank: Record<string, unknown>;
      questions: Record<string, unknown>[];
    }>(`/question-banks/${id}`);
    return {
      bank: mapQuestionBank(raw.bank || {}),
      questions: (raw.questions || []).map((q) => mapQuestion(q)),
    };
  },

  create: async (data: CreateQuestionBankRequest): Promise<QuestionBank> => {
    const raw = await post<Record<string, unknown>>('/question-banks', data);
    return mapQuestionBank(raw);
  },

  update: async (id: string, data: Partial<CreateQuestionBankRequest>): Promise<QuestionBank> => {
    const raw = await put<Record<string, unknown>>(`/question-banks/${id}`, data);
    return mapQuestionBank(raw);
  },

  delete: async (id: string): Promise<void> => {
    return del(`/question-banks/${id}`);
  },

  addQuestion: async (bankId: string, questionId: string, order: number): Promise<void> => {
    await post(`/question-banks/${bankId}/questions`, {
      question_id: questionId,
      order,
    });
  },

  removeQuestion: async (bankId: string, questionId: string): Promise<void> => {
    return del(`/question-banks/${bankId}/questions/${questionId}`);
  },
};
