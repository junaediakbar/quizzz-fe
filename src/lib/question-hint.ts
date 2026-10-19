/** Petunjuk (hint) opsional ditulis guru sebagai baris tersendiri di teks soal:
 *  "Petunjuk: Pindahkan 5 ke ruas kanan dulu." (atau "Hint: ...").
 *  Murid baru melihatnya setelah menekan tombol petunjuk. */
const HINT_LINE = /^\s*(?:petunjuk|hint)\s*:\s*(.*)$/i;

export function splitHint(content: string): { content: string; hint: string | null } {
  const hints: string[] = [];
  const rest: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(HINT_LINE);
    if (m) {
      if (m[1].trim()) hints.push(m[1].trim());
    } else {
      rest.push(line);
    }
  }
  return { content: rest.join('\n').trim(), hint: hints.length > 0 ? hints.join('\n') : null };
}
