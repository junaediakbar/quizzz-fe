export interface PdfParserInput {
  text: string;
  pageImages: string[];
  questionPageMap: number[]; // q1 -> page index, q2 -> page index, ...
  warnings: string[];
}

const MAX_PAGES = 20;

type PdfJsModule = {
  version?: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfDocumentLike> };
};
type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfPageLike>;
};
type PdfPageLike = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>;
  };
};

/**
 * Extract text + rendered page images from PDF in browser (pdf.js).
 * Used as parser input so AI can read both OCR-like visuals and text.
 */
export async function buildParserInputFromPdf(file: File): Promise<PdfParserInput> {
  const warnings: string[] = [];
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const v = pdfjs.version || '4.10.38';
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/legacy/build/pdf.worker.min.mjs`;
  }

  const bytes = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const totalPages = Number(pdf.numPages || 0);
  const pages = Math.min(totalPages, MAX_PAGES);
  if (totalPages > MAX_PAGES) {
    warnings.push(`PDF ${totalPages} halaman, diproses ${MAX_PAGES} halaman pertama.`);
  }

  const allPageTexts: string[] = [];
  const pageImages: string[] = [];
  const questionPageMap: number[] = [];

  for (let pageNum = 1; pageNum <= pages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // Text
    const txt = await page.getTextContent();
    const pageLines = (txt.items || [])
      .map((i) => String(i?.str ?? '').trim())
      .filter(Boolean);
    const pageText = pageLines.join('\n');
    allPageTexts.push(pageText);

    // Detect question numbering starts on this page
    const starts = pageText.match(/(^|\n)\s*\d+\.\s+/g);
    if (starts && starts.length > 0) {
      for (let i = 0; i < starts.length; i++) {
        questionPageMap.push(pageNum - 1);
      }
    }

    // Render page image
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      warnings.push(`Gagal render halaman ${pageNum} (canvas context null).`);
      continue;
    }
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvasContext: ctx, viewport }).promise;
    pageImages.push(canvas.toDataURL('image/jpeg', 0.86));
  }

  const text = allPageTexts.join('\n\n');
  if (!text.trim()) {
    warnings.push('Teks PDF tidak terbaca. AI akan mengandalkan gambar halaman.');
  }

  return { text, pageImages, questionPageMap, warnings };
}
