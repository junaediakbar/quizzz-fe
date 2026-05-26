import katex from 'katex';

export type MathSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean };

/** Delimiter: $$...$$, $...$, \[...\], \(...\) */
const MATH_DELIMITER =
  /\$\$([\s\S]*?)\$\$|\$((?:\\.|[^$\\])+)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;

const HAS_DELIMITER = /\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\\])+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;

const LATEX_FRAGMENT =
  /\\[a-zA-Z]+(?:\*\[[^\]]*\])?(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}){0,2}/g;

/** Bungkus perintah LaTeX tanpa $ agar tetap ter-render (mis. \sqrt{25} dari AI). */
export function normalizeMathDelimiters(text: string): string {
  if (!text?.trim() || HAS_DELIMITER.test(text)) return text;

  const trimmed = text.trim();
  if (trimmed.startsWith('\\') && !trimmed.includes('\n')) {
    return `$${trimmed}$`;
  }

  return text.replace(LATEX_FRAGMENT, (match, offset, whole) => {
    const before = whole[offset - 1];
    const after = whole[offset + match.length];
    if (before === '$' || after === '$') return match;
    return `$${match}$`;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseMathSegments(input: string): MathSegment[] {
  if (!input) return [];

  const segments: MathSegment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(MATH_DELIMITER)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'text', value: input.slice(lastIndex, index) });
    }

    const display = match[1] !== undefined || match[4] !== undefined;
    const latex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (latex) {
      segments.push({ kind: 'math', value: latex, display });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({ kind: 'text', value: input.slice(lastIndex) });
  }

  return segments;
}

export function containsMathDelimiters(text: string): boolean {
  return HAS_DELIMITER.test(text);
}

export function renderLatexToHtml(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    });
  } catch {
    return `<span class="math-error">${escapeHtml(latex)}</span>`;
  }
}

/** Plain text with newlines → HTML; math segments rendered via KaTeX. */
export function buildMathHtml(input: string): string {
  if (!input) return '';

  const normalized = normalizeMathDelimiters(input);
  const segments = parseMathSegments(normalized);
  if (segments.length === 0) {
    return escapeHtml(input).replace(/\n/g, '<br />');
  }

  const hasMath = segments.some((s) => s.kind === 'math');
  if (!hasMath) {
    return escapeHtml(input).replace(/\n/g, '<br />');
  }

  return segments
    .map((seg) => {
      if (seg.kind === 'text') {
        return escapeHtml(seg.value).replace(/\n/g, '<br />');
      }
      const rendered = renderLatexToHtml(seg.value, seg.display);
      if (seg.display) {
        return `<span class="math-display my-2 block overflow-x-auto">${rendered}</span>`;
      }
      return `<span class="math-inline">${rendered}</span>`;
    })
    .join('');
}
