// Jalankan: node --test src/lib/question-hint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitHint } from './question-hint.ts';

test('memisahkan baris Petunjuk dari teks soal', () => {
  assert.deepEqual(splitHint('Tentukan nilai x dari 3x + 5 = 20.\nPetunjuk: Pindahkan 5 ke ruas kanan dulu.'), {
    content: 'Tentukan nilai x dari 3x + 5 = 20.',
    hint: 'Pindahkan 5 ke ruas kanan dulu.',
  });
});

test('Hint: tanpa membedakan huruf besar/kecil, beberapa baris digabung', () => {
  assert.deepEqual(splitHint('Soal\nHINT: satu\npetunjuk : dua'), { content: 'Soal', hint: 'satu\ndua' });
});

test('tanpa petunjuk atau petunjuk kosong -> hint null, teks tetap', () => {
  assert.deepEqual(splitHint('Berapa 2 + 2?'), { content: 'Berapa 2 + 2?', hint: null });
  assert.deepEqual(splitHint('Soal\nPetunjuk:   '), { content: 'Soal', hint: null });
});

test('kata petunjuk di tengah kalimat tidak dianggap hint', () => {
  assert.equal(splitHint('Baca petunjuk: lalu jawab').hint, null);
  assert.equal(splitHint('Baca petunjuk: lalu jawab').content, 'Baca petunjuk: lalu jawab');
});
