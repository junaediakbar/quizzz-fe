/** Pilihan ganda di dalam satu langkah soal step-by-step.
 *  Ditulis guru di akhir teks langkah: "x = .... (A. 3  B. 5  C. 15)".
 *  Jawaban murid disimpan sebagai hurufnya, jadi kunci langkah cukup "B". */
export interface StepChoices {
  /** Teks langkah tanpa daftar pilihan. */
  prompt: string;
  choices: { letter: string; text: string }[];
}

const CHOICE_BLOCK = /\(\s*(A\.\s*[^()]*?\s+B\.\s*[^()]*?)\s*\)\s*$/;

/** null bila langkah tidak berisi pilihan (minimal A dan B). */
export function parseStepChoices(step: string): StepChoices | null {
  const m = step.trim().match(CHOICE_BLOCK);
  if (!m) return null;
  const parts = m[1].split(/\s+(?=[B-E]\.\s)/);
  const choices = parts.map((p) => {
    const [, letter, text] = p.match(/^([A-E])\.\s*([\s\S]*)$/) ?? [];
    return { letter: letter ?? '', text: (text ?? '').trim() };
  });
  if (choices.some((c) => !c.letter || !c.text)) return null;
  return { prompt: step.trim().slice(0, m.index).trim(), choices };
}
