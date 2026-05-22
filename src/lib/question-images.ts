/** Posisi gambar relatif terhadap teks soal / opsi */
export type QuestionImagePosition = 'above' | 'below' | 'after' | 'option';

export interface QuestionImage {
  url: string;
  position: QuestionImagePosition;
  /** Indeks opsi (0 = a) bila position === 'option' */
  optionIndex?: number;
}

const IMG_URL_RE = /^https?:\/\/.+/i;

export function isQuestionImagePosition(v: string): v is QuestionImagePosition {
  return v === 'above' || v === 'below' || v === 'after' || v === 'option';
}

/** Normalisasi dari API: string[] (lama = below) atau objek berposisi */
export function normalizeQuestionImages(raw: unknown): QuestionImage[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];

  const out: QuestionImage[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && IMG_URL_RE.test(item.trim())) {
      out.push({ url: item.trim(), position: 'below' });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const url = String(o.url ?? o.URL ?? '').trim();
      if (!IMG_URL_RE.test(url)) continue;
      const posRaw = String(o.position ?? o.Position ?? 'below').toLowerCase();
      const position: QuestionImagePosition = isQuestionImagePosition(posRaw) ? posRaw : 'below';
      const optionIndex =
        o.option_index !== undefined
          ? Number(o.option_index)
          : o.optionIndex !== undefined
            ? Number(o.optionIndex)
            : undefined;
      out.push({
        url,
        position,
        ...(position === 'option' && optionIndex !== undefined && !Number.isNaN(optionIndex)
          ? { optionIndex }
          : {}),
      });
    }
  }
  return out;
}

export function flattenImageUrls(images: QuestionImage[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const img of images) {
    const u = img.url.trim();
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}

export function imagesForPosition(
  images: QuestionImage[] | undefined,
  position: QuestionImagePosition,
  optionIndex?: number
): QuestionImage[] {
  if (!images?.length) return [];
  return images.filter((img) => {
    if (img.position !== position) return false;
    if (position === 'option') return img.optionIndex === optionIndex;
    return true;
  });
}

/** Payload simpan ke API (image_urls JSON berposisi) */
export function imagesToApiPayload(images: QuestionImage[]): Record<string, unknown>[] {
  return images.map((img) => ({
    url: img.url,
    position: img.position,
    ...(img.position === 'option' && img.optionIndex !== undefined
      ? { option_index: img.optionIndex }
      : {}),
  }));
}

export function mergeQuestionImages(
  existing: QuestionImage[] | undefined,
  additions: QuestionImage[]
): QuestionImage[] {
  const out = [...(existing ?? [])];
  for (const add of additions) {
    const dup = out.some(
      (x) =>
        x.url === add.url &&
        x.position === add.position &&
        x.optionIndex === add.optionIndex
    );
    if (!dup) out.push(add);
  }
  return out;
}

export function uniqPushImage(images: QuestionImage[], img: QuestionImage) {
  const dup = images.some(
    (x) =>
      x.url === img.url && x.position === img.position && x.optionIndex === img.optionIndex
  );
  if (!dup) images.push(img);
}

const RE_OPTION_MARKER =
  /\[\s*!\s*option\s*[-_\s]*([a-d])\s*:?\s*(https?:\/\/[^\]]+)\]\s*/gi;
const RE_POSITION_MARKER =
  /\[\s*!\s*(above|below|after)\s*:?\s*(https?:\/\/[^\]]+)\]\s*/gi;
const RE_PLAIN_MARKER = /\[\s*!\s*(https?:\/\/[^\]]+)\]\s*/gi;
const RE_MD_IMAGE = /!\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)\s*\)/gi;
const RE_LINK_IMAGE = /^\[\s*(?:!\s*)?link\s+image\s*\]\s*$/i;

/**
 * Ambil gambar dari teks (opsi / content), hapus penanda dari teks tampilan.
 * defaultOptionIndex: dipakai untuk [!url] polos di dalam baris opsi a/b/c/d.
 */
export function extractMediaMarkersFromText(
  text: string,
  defaultOptionIndex?: number
): { cleanText: string; extracted: QuestionImage[] } {
  const extracted: QuestionImage[] = [];
  let clean = text;

  const take = (img: QuestionImage) => uniqPushImage(extracted, img);

  clean = clean.replace(RE_OPTION_MARKER, (_, letter: string, url: string) => {
    const idx = letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    take({ url: url.trim(), position: 'option', optionIndex: idx });
    return '';
  });

  clean = clean.replace(RE_POSITION_MARKER, (_, pos: string, url: string) => {
    const position = pos.toLowerCase() as QuestionImagePosition;
    take({ url: url.trim(), position });
    return '';
  });

  clean = clean.replace(RE_PLAIN_MARKER, (_, url: string) => {
    if (defaultOptionIndex !== undefined) {
      take({ url: url.trim(), position: 'option', optionIndex: defaultOptionIndex });
    } else {
      take({ url: url.trim(), position: 'below' });
    }
    return '';
  });

  clean = clean.replace(RE_MD_IMAGE, (_, url: string) => {
    if (defaultOptionIndex !== undefined) {
      take({ url: url.trim(), position: 'option', optionIndex: defaultOptionIndex });
    } else {
      take({ url: url.trim(), position: 'below' });
    }
    return '';
  });

  clean = clean.replace(RE_LINK_IMAGE, '').trim();

  return { cleanText: clean.replace(/\s{2,}/g, ' ').trim(), extracted };
}

/** Teks tampilan tanpa penanda gambar */
export function stripMediaMarkersFromText(text: string): string {
  return extractMediaMarkersFromText(text).cleanText;
}

/** Baris hanya berisi penanda gambar (bukan teks soal) */
export function isStandaloneMediaMarkerLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (RE_LINK_IMAGE.test(t)) return true;
  const { cleanText, extracted } = extractMediaMarkersFromText(t);
  return extracted.length > 0 && cleanText === '';
}

/** Hapus baris penanda gambar sebelum kirim ke AI parser (templat asli tetap untuk lampiran) */
export function stripStandaloneMediaLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !isStandaloneMediaMarkerLine(line))
    .join('\n');
}

export type QuestionMediaFields = {
  content?: string;
  options?: string[];
  images?: QuestionImage[];
  imageUrls?: string[];
};

/** Bersihkan penanda di content/opsi dan gabungkan ke images */
export function sanitizeQuestionMedia<T extends QuestionMediaFields>(q: T): T {
  const images = [...(q.images ?? [])];
  let content = q.content ?? '';

  if (content) {
    const { cleanText, extracted } = extractMediaMarkersFromText(content);
    content = cleanText;
    for (const img of extracted) uniqPushImage(images, img);
  }

  const options = q.options?.map((opt, idx) => {
    const letterMatch = /^([a-d])[\).\)]\s*(.*)$/i.exec(opt.trim());
    const optIdx = letterMatch
      ? letterMatch[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
      : idx;
    const body = letterMatch ? letterMatch[2] : opt;
    const { cleanText, extracted } = extractMediaMarkersFromText(body, optIdx);
    for (const img of extracted) uniqPushImage(images, img);
    if (letterMatch) {
      if (!cleanText) return '';
      return `${letterMatch[1].toLowerCase()}) ${cleanText}`.trim();
    }
    return cleanText || opt;
  });

  return {
    ...q,
    content,
    ...(options ? { options } : {}),
    images,
    imageUrls: flattenImageUrls(images),
  };
}
