/** Opsi kelas 1–12 (nilai disimpan sebagai string angka). */
export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  return { value: String(n), label: `Kelas ${n}` };
});

/** Tampilkan label kelas dari nilai DB (mis. "7" → "Kelas 7"). */
export function formatGradeLabel(grade?: string | null): string {
  if (!grade?.trim()) return '';
  const trimmed = grade.trim();
  if (/^kelas\s+/i.test(trimmed)) return trimmed;
  const num = parseInt(trimmed, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= 12) return `Kelas ${num}`;
  if (/^\d+/.test(trimmed)) {
    const m = trimmed.match(/^(\d+)/);
    if (m) return `Kelas ${m[1]}`;
  }
  return trimmed;
}
