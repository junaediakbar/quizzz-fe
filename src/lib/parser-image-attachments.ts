import { mediaApi } from '@/lib/api/media';

export type ParsedImageAssociation =
  | { kind: 'upload'; questionIndex: number }
  | { kind: 'url'; questionIndex: number; url: string };

/**
 * Template: tiap blok `N. ...` menaikkan indeks soal (0-based).
 * Baris `[!Link Image]` / `[Link Image]` = slot bergambar (urutan = urutan unggahan).
 * `![Label](URL)` atau baris satu URL *.png|.jpg|.webp|.gif atau `[! Link Image]: https://…`
 */
export function parseImageAssociationsFromTemplate(template: string): ParsedImageAssociation[] {
  const lines = template.split(/\r?\n/);
  let currentQ = -1;
  const out: ParsedImageAssociation[] = [];
  const numbered = /^\d+\.\s/;
  const placeholder = /^\[\s*(?:!\s*)?Link\s+Image\s*\]\s*$/i;
  const labeledUrl =
    /^\[\s*(?:!\s*)?Link\s+Image\s*\]\s*:\s*(https?:\/\/\S+)/i;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const lu = labeledUrl.exec(line);
    if (lu) {
      const url = lu[1].trim().replace(/[),.;]+$/, '');
      if (currentQ >= 0 && /^https?:\/\//i.test(url)) {
        out.push({ kind: 'url', questionIndex: currentQ, url });
      }
      continue;
    }
    if (numbered.test(line)) {
      currentQ += 1;
      continue;
    }
    if (placeholder.test(line)) {
      if (currentQ >= 0) out.push({ kind: 'upload', questionIndex: currentQ });
      continue;
    }

    const md = /^!\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)\s*\)\s*$/i.exec(line);
    if (md && currentQ >= 0) {
      out.push({ kind: 'url', questionIndex: currentQ, url: md[1].trim() });
      continue;
    }

    if (currentQ >= 0 && /^https?:\/\/\S+$/i.test(line)) {
      if (/\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i.test(line)) {
        out.push({ kind: 'url', questionIndex: currentQ, url: line.trim() });
      }
    }
  }
  return out;
}

export function dataURLToUploadFile(dataUrl: string): File {
  const compact = dataUrl.replace(/\s/g, '');
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(compact);
  if (!m) {
    throw new Error('Bukan data URL base64 yang valid.');
  }
  const mimeRaw = m[1].toLowerCase();
  const mime = mimeRaw.split(';')[0]?.trim() || 'image/png';
  let ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  if (!ext || ext.length > 8) ext = 'png';

  if (typeof atob !== 'undefined') {
    const binStr = atob(m[2]);
    const raw = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) raw[i] = binStr.charCodeAt(i);
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    return new File([raw], `parser-${id}.${ext}`, { type: mime });
  }
  throw new Error('Decoder base64 tidak tersedia.');
}

function uniqPush(arr: string[], url: string) {
  const t = url.trim();
  if (t && !arr.includes(t)) arr.push(t);
}

export async function attachImagesFromParserTemplate<T extends { imageUrls?: string[] }>(
  template: string,
  uploadDataURLs: string[],
  questions: T[]
): Promise<{ questions: T[]; warnings: string[] }> {
  const warnings: string[] = [];
  const assocs = parseImageAssociationsFromTemplate(template);
  const next: T[] = questions.map((q) => ({
    ...q,
    imageUrls: [...(q.imageUrls ?? []).filter(Boolean)],
  }));

  let uploadSlot = 0;
  const uploadMarkers = assocs.filter((x) => x.kind === 'upload').length;

  if (uploadMarkers === 0 && uploadDataURLs.length > 0) {
    warnings.push(
      'Ada gambar diunggah tanpa penanda [!Link Image] pada teks — gambar itu tidak dapat dipasangkan otomatis. Tambahkan satu baris [!Link Image] di bawah soal yang bergambar.'
    );
  }

  for (const a of assocs) {
    if (a.kind === 'url') {
      if (a.questionIndex >= 0 && a.questionIndex < next.length) {
        const row = next[a.questionIndex];
        const urls = [...(row.imageUrls ?? [])];
        uniqPush(urls, a.url);
        next[a.questionIndex] = { ...row, imageUrls: urls };
      } else {
        warnings.push(
          `Taut gambar diabaikan — tidak ada soal ke-${a.questionIndex + 1} (${next.length} soal hasil parse).`
        );
      }
      continue;
    }

    const dataUrl = uploadDataURLs[uploadSlot++];
    if (!dataUrl) {
      warnings.push(
        `[!Link Image]: kurang satu berkas gambar (harus ${uploadMarkers} foto untuk ${uploadMarkers} penanda).`
      );
      continue;
    }
    if (a.questionIndex < 0 || a.questionIndex >= next.length) {
      warnings.push(
        `Satu foto terlewat — penanda bergambar merujuk soal yang tidak ada (indeks ${a.questionIndex + 1}).`
      );
      continue;
    }

    try {
      const row = next[a.questionIndex];
      const urls = [...(row.imageUrls ?? [])];
      const file = dataURLToUploadFile(dataUrl);
      const { url } = await mediaApi.upload(file);
      uniqPush(urls, url);
      next[a.questionIndex] = { ...row, imageUrls: urls };
    } catch {
      warnings.push(
        `Gagal menyimpan gambar untuk soal ${a.questionIndex + 1}. Periksa Cloudinary (CLOUDINARY_*) di backend.`
      );
    }
  }

  const used = uploadSlot;
  if (uploadMarkers > 0 && uploadDataURLs.length > used) {
    warnings.push(`${uploadDataURLs.length - used} gambar lebih banyak daripada penanda [!Link Image]; tidak digunakan.`);
  }
  if (uploadMarkers > 0 && uploadDataURLs.length < uploadMarkers) {
    warnings.push(
      `${uploadMarkers - uploadDataURLs.length} penanda [!Link Image] tidak punya foto (kurang upload).`
    );
  }

  return { questions: next, warnings };
}

/**
 * Best-effort fallback for PDF flow: attach rendered page image URL
 * to parsed question by detected question->page map.
 */
export async function attachUploadedPageImagesByQuestionMap<T extends { imageUrls?: string[] }>(
  questions: T[],
  pageDataURLs: string[],
  questionPageMap: number[]
): Promise<{ questions: T[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (!questions.length || !pageDataURLs.length || !questionPageMap.length) {
    return { questions, warnings };
  }

  const next: T[] = questions.map((q) => ({ ...q, imageUrls: [...(q.imageUrls ?? [])] }));
  const uploadCache = new Map<number, string>(); // pageIndex -> secureURL

  for (let qi = 0; qi < next.length; qi++) {
    const pageIdx = questionPageMap[qi];
    if (pageIdx == null || pageIdx < 0 || pageIdx >= pageDataURLs.length) continue;
    try {
      let url = uploadCache.get(pageIdx);
      if (!url) {
        const file = dataURLToUploadFile(pageDataURLs[pageIdx]);
        const res = await mediaApi.upload(file);
        url = res.url;
        uploadCache.set(pageIdx, url);
      }
      const row = next[qi];
      const urls = [...(row.imageUrls ?? [])];
      uniqPush(urls, url);
      next[qi] = { ...row, imageUrls: urls };
    } catch {
      warnings.push(
        `Gagal upload lampiran halaman PDF untuk soal ${qi + 1}. Cek konfigurasi Cloudinary backend.`
      );
    }
  }

  return { questions: next, warnings };
}
