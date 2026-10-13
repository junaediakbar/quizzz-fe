// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  error: string;
  statusCode?: number;
}

// Generic fetch wrapper options
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

/** Metadata pagination yang dikirim semua endpoint list. */
export interface ListPageMeta {
  /** Jumlah baris pada respons ini (bukan total). */
  count: number;
  /** Jumlah seluruh baris yang cocok dengan filter. */
  total: number;
  /** 0 = tanpa batas. */
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ListQuery {
  limit?: number;
  offset?: number;
}
