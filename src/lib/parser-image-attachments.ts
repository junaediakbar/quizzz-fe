import { mediaApi } from '@/lib/api/media';
import {
  extractMediaMarkersFromText,
  flattenImageUrls,
  mergeQuestionImages,
  sanitizeQuestionMedia,
  type QuestionImage,
  type QuestionImagePosition,
  uniqPushImage,
} from '@/lib/question-images';

export type ParsedImageAssociation =
  | { kind: 'upload'; questionIndex: number; position: QuestionImagePosition; optionIndex?: number }
  | {
      kind: 'url';
      questionIndex: number;
      url: string;
      position: QuestionImagePosition;
      optionIndex?: number;
    };

type PendingMarker =
  | { kind: 'upload'; position: QuestionImagePosition; optionIndex?: number }
  | { kind: 'url'; url: string; position: QuestionImagePosition; optionIndex?: number };

type BlockPhase = 'pre_stem' | 'stem' | 'pre_options' | 'options' | 'post';

const numbered = /^\d+\.\s/;
const placeholder = /^\[\s*(?:!\s*)?Link\s+Image\s*\]\s*$/i;
const labeledUrl = /^\[\s*(?:!\s*)?Link\s+Image\s*\]\s*:\s*(https?:\/\/\S+)/i;
const optionLine = /^[a-d][\).\)]\s/i;

/** Ekstrak URL + posisi eksplisit: [!above url], [!below url], [!option-b url], [!url] */
function parseImageMarkerLine(
  line: string
): { url: string; position?: QuestionImagePosition; optionIndex?: number } | { upload: true; position?: QuestionImagePosition; optionIndex?: number } | null {
  const t = line.trim();
  if (placeholder.test(t)) return { upload: true };

  const lu = labeledUrl.exec(t);
  if (lu) {
    const url = lu[1].trim().replace(/[),.;]+$/, '');
    return { url, position: 'below' };
  }

  const optionOnly =
    /^\[\s*!\s*option\s*[-_\s]*([a-d])\s*:?\s*(https?:\/\/[^\]]+)\]\s*$/i.exec(t);
  if (optionOnly) {
    const letter = optionOnly[1].toLowerCase();
    return {
      url: optionOnly[2].trim().replace(/[),.;]+$/, ''),
      position: 'option',
      optionIndex: letter.charCodeAt(0) - 'a'.charCodeAt(0),
    };
  }

  const explicit =
    /^\[\s*!\s*(above|below|after)\s*:?\s*(https?:\/\/[^\]]+)\]\s*$/i.exec(t) ||
    /^\[\s*!\s*(above|below|after)\s+(https?:\/\/[^\]]+)\]\s*$/i.exec(t);
  if (explicit) {
    const url = explicit[2].trim().replace(/[),.;]+$/, '');
    return { url, position: explicit[1].toLowerCase() as QuestionImagePosition };
  }

  const inline = /^\[\s*!\s*(https?:\/\/[^\]]+)\]\s*$/i.exec(t);
  if (inline) {
    return { url: inline[1].trim().replace(/[),.;]+$/, '') };
  }

  const md = /^!\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)\s*\)\s*$/i.exec(t);
  if (md) return { url: md[1].trim() };

  if (/^https?:\/\/\S+$/i.test(t) && /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i.test(t)) {
    return { url: t };
  }

  return null;
}

/** Baris hanya berisi penanda/URL gambar */
function isStandaloneImageLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return parseImageMarkerLine(t) !== null;
}

/** Gambar di akhir blok dipindah ke awal blok berikutnya → posisi "above" soal berikutnya */
function peelTrailingImageLines(lines: string[]): { block: string[]; leadingForNext: string[] } {
  const leadingForNext: string[] = [];
  let end = lines.length;
  while (end > 0) {
    const t = lines[end - 1].trim();
    if (!t) {
      end--;
      continue;
    }
    if (isStandaloneImageLine(lines[end - 1])) {
      leadingForNext.unshift(lines[end - 1]);
      end--;
    } else {
      break;
    }
  }
  return { block: lines.slice(0, end), leadingForNext };
}

function splitQuestionBlocks(template: string): string[][] {
  const lines = template.split(/\r?\n/);
  const blocks: string[][] = [];
  let prelude: string[] = [];
  let current: string[] | null = null;
  let carryLeading: string[] = [];

  const flushCurrent = () => {
    if (!current) return;
    const { block, leadingForNext } = peelTrailingImageLines(current);
    if (block.length > 0) blocks.push(block);
    carryLeading = leadingForNext;
    current = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (t && numbered.test(t)) {
      flushCurrent();
      current = [...carryLeading, line];
      carryLeading = [];
    } else if (current) {
      current.push(line);
    } else if (t) {
      prelude.push(line);
    }
  }
  if (current) {
    const { block } = peelTrailingImageLines(current);
    if (block.length > 0) blocks.push(block);
    else if (carryLeading.length) blocks.push([...carryLeading]);
  }
  if (blocks.length > 0 && prelude.length > 0) {
    blocks[0] = [...prelude, ...blocks[0]];
  } else if (blocks.length === 0 && prelude.length > 0) {
    blocks.push(prelude);
  }
  return blocks;
}

function inferPosition(phase: BlockPhase): QuestionImagePosition {
  switch (phase) {
    case 'pre_stem':
      return 'above';
    case 'stem':
    case 'pre_options':
      return 'below';
    case 'options':
      return 'after';
    default:
      return 'after';
  }
}

function parseOptionLine(line: string): { text: string; images: QuestionImage[] } {
  const m = /^([a-d])[\).\)]\s*(.*)$/i.exec(line.trim());
  if (!m) return { text: line.trim(), images: [] };
  const optIdx = m[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
  const { cleanText, extracted } = extractMediaMarkersFromText(m[2], optIdx);
  return { text: cleanText, images: extracted };
}

function isAnswerLine(line: string): boolean {
  const low = line.trim().toLowerCase();
  return low.startsWith('correct answer:') || low.startsWith('answer:');
}

function isExplanationLine(line: string): boolean {
  return line.trim().toLowerCase().startsWith('explanation:');
}

type BlockUploadSlot = { position: QuestionImagePosition; optionIndex?: number };

/** Parse satu blok soal → gambar berposisi + slot upload */
function parseImagesFromBlock(blockLines: string[]): {
  images: QuestionImage[];
  uploads: BlockUploadSlot[];
} {
  const images: QuestionImage[] = [];
  const uploads: BlockUploadSlot[] = [];
  let phase: BlockPhase = 'pre_stem';
  let optionIndex = -1;

  const push = (img: QuestionImage) => uniqPushImage(images, img);

  for (const raw of blockLines) {
    const line = raw.trim();
    if (!line) continue;

    const numberedMatch = numbered.exec(line);
    if (numberedMatch) {
      const stem = line.replace(/^\d+\.\s*/, '').trim();
      phase = 'stem';
      if (stem) phase = 'pre_options';
      continue;
    }

    const marker = parseImageMarkerLine(line);
    if (marker) {
      if ('upload' in marker && marker.upload) {
        uploads.push({
          position: marker.position ?? inferPosition(phase),
          ...(marker.optionIndex !== undefined ? { optionIndex: marker.optionIndex } : {}),
        });
        continue;
      }
      if ('url' in marker && marker.url) {
        const position = marker.position ?? inferPosition(phase);
        push({
          url: marker.url,
          position,
          ...(position === 'option'
            ? { optionIndex: marker.optionIndex ?? (optionIndex >= 0 ? optionIndex : 0) }
            : {}),
        });
        if (phase === 'pre_stem') phase = 'stem';
        continue;
      }
    }

    if (optionLine.test(line)) {
      phase = 'options';
      optionIndex += 1;
      const { images: optImgs } = parseOptionLine(line);
      for (const img of optImgs) {
        push(img);
      }
      continue;
    }

    if (isAnswerLine(line) || isExplanationLine(line)) {
      phase = 'post';
      continue;
    }

    if (phase === 'pre_stem') {
      phase = 'pre_options';
    } else if (phase === 'stem') {
      phase = 'pre_options';
    }
  }

  return { images, uploads };
}

/**
 * Template → asosiasi gambar per indeks soal (0-based), dengan posisi above/below/after/option.
 */
export function parseImageAssociationsFromTemplate(template: string): ParsedImageAssociation[] {
  const blocks = splitQuestionBlocks(template);
  const out: ParsedImageAssociation[] = [];

  blocks.forEach((block, questionIndex) => {
    const { images, uploads } = parseImagesFromBlock(block);
    for (const slot of uploads) {
      out.push({
        kind: 'upload',
        questionIndex,
        position: slot.position,
        optionIndex: slot.optionIndex,
      });
    }
    for (const img of images) {
      if (!img.url) continue;
      out.push({
        kind: 'url',
        questionIndex,
        url: img.url,
        position: img.position,
        optionIndex: img.optionIndex,
      });
    }
  });

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

export type QuestionWithImages = {
  images?: QuestionImage[];
  imageUrls?: string[];
};

export async function attachImagesFromParserTemplate<T extends QuestionWithImages>(
  template: string,
  uploadDataURLs: string[],
  questions: T[]
): Promise<{ questions: T[]; warnings: string[] }> {
  const warnings: string[] = [];
  const assocs = parseImageAssociationsFromTemplate(template);
  const hasTemplateMarkers = assocs.length > 0;
  const next: T[] = questions.map((q) => ({
    ...q,
    images: hasTemplateMarkers ? [] : [...(q.images ?? [])],
    imageUrls: hasTemplateMarkers ? [] : [...(q.imageUrls ?? []).filter(Boolean)],
  }));

  let uploadSlot = 0;
  const uploadMarkers = assocs.filter((x) => x.kind === 'upload').length;

  if (uploadMarkers === 0 && uploadDataURLs.length > 0) {
    warnings.push(
      'Ada gambar diunggah tanpa penanda [!Link Image] pada teks — tambahkan penanda di posisi yang sesuai (atas/bawah soal atau di opsi).'
    );
  }

  for (const a of assocs) {
    if (a.questionIndex < 0 || a.questionIndex >= next.length) {
      warnings.push(
        `Penanda gambar diabaikan — tidak ada soal ke-${a.questionIndex + 1} (${next.length} soal hasil parse).`
      );
      continue;
    }

    const row = next[a.questionIndex];
    const imgs = [...(row.images ?? [])];

    if (a.kind === 'url') {
      uniqPushImage(imgs, {
        url: a.url,
        position: a.position,
        ...(a.optionIndex !== undefined ? { optionIndex: a.optionIndex } : {}),
      });
      next[a.questionIndex] = {
        ...row,
        images: imgs,
        imageUrls: flattenImageUrls(imgs),
      };
      continue;
    }

    const dataUrl = uploadDataURLs[uploadSlot++];
    if (!dataUrl) {
      warnings.push(`[!Link Image]: kurang satu berkas gambar untuk soal ${a.questionIndex + 1}.`);
      continue;
    }

    try {
      const file = dataURLToUploadFile(dataUrl);
      const { url } = await mediaApi.upload(file);
      uniqPushImage(imgs, {
        url,
        position: a.position,
        ...(a.optionIndex !== undefined ? { optionIndex: a.optionIndex } : {}),
      });
      next[a.questionIndex] = {
        ...row,
        images: imgs,
        imageUrls: flattenImageUrls(imgs),
      };
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

  const sanitized = next.map((q) => sanitizeQuestionMedia(q));

  return { questions: sanitized, warnings };
}

export async function attachUploadedPageImagesByQuestionMap<T extends QuestionWithImages>(
  questions: T[],
  pageDataURLs: string[],
  questionPageMap: number[]
): Promise<{ questions: T[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (!questions.length || !pageDataURLs.length || !questionPageMap.length) {
    return { questions, warnings };
  }

  const next: T[] = questions.map((q) => ({
    ...q,
    images: [...(q.images ?? [])],
    imageUrls: [...(q.imageUrls ?? [])],
  }));
  const uploadCache = new Map<number, string>();

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
      const imgs = mergeQuestionImages(row.images, [{ url, position: 'below' }]);
      next[qi] = { ...row, images: imgs, imageUrls: flattenImageUrls(imgs) };
    } catch {
      warnings.push(
        `Gagal upload lampiran halaman PDF untuk soal ${qi + 1}. Cek konfigurasi Cloudinary backend.`
      );
    }
  }

  const sanitized = next.map((q) => sanitizeQuestionMedia(q));
  return { questions: sanitized, warnings };
}
