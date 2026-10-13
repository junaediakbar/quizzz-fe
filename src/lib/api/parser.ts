import { post } from './client';
import { ParseResult } from '@/lib/types';
import { mapParseResult } from './mappers';

/** Mesin parsing yang bisa dipilih guru. */
export type ParseMode = 'auto' | 'ai' | 'manual';

export interface ParseRequest {
  text: string;
  /** data:image/…;base64,... — butuh GEMINI_API_KEY / ZAI_API_KEY di backend */
  images?: string[];
  /**
   * auto   = AI dulu, otomatis fallback ke parser aturan bila AI gagal (default)
   * ai     = pakai AI
   * manual = hanya parser aturan sistem (tanpa memanggil AI)
   */
  mode?: ParseMode;
}

/**
 * Parse text and/or images into structured questions.
 * `mode` memilih mesin: AI atau parser manual milik sistem.
 */
export const parseQuestions = async (
  text: string,
  images?: string[],
  mode: ParseMode = 'auto'
): Promise<ParseResult> => {
  const body: ParseRequest = {
    text,
    ...(images && images.length > 0 ? { images } : {}),
    mode,
  };
  const raw = await post<Record<string, unknown>>('/parser/parse', body);
  return mapParseResult(raw);
};
