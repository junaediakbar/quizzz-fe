import { post } from './client';
import { ParseResult } from '@/lib/types';
import { mapParseResult } from './mappers';

export interface ParseRequest {
  text: string;
  /** data:image/…;base64,... — butuh GEMINI_API_KEY / ZAI_API_KEY di backend */
  images?: string[];
}

/**
 * Parse text and/or images into structured questions (AI vision bila ada gambar).
 */
export const parseQuestions = async (text: string, images?: string[]): Promise<ParseResult> => {
  const body: ParseRequest = {
    text,
    ...(images && images.length > 0 ? { images } : {}),
  };
  const raw = await post<Record<string, unknown>>('/parser/parse', body);
  return mapParseResult(raw);
};
