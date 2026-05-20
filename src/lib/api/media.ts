import { postFormData } from './client';

export interface MediaUploadResponse {
  url: string;
  public_id?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export const mediaApi = {
  upload: async (file: File): Promise<MediaUploadResponse> => {
    const fd = new FormData();
    fd.append('file', file);
    return postFormData<MediaUploadResponse>('/media/upload', fd);
  },
};
