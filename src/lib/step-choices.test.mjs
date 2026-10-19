// Jalankan: node --test src/lib/step-choices.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStepChoices, stripAnswerKeys } from './step-choices.ts';

test('stripAnswerKeys membuang kunci di akhir baris, teks lain utuh', () => {
  assert.equal(
    stripAnswerKeys('Tentukan x.\nLangkah 1: 12 ÷ 3 = .... | Kunci: 4\nLangkah 2: pilih (A. 3  B. 5) | kunci jawaban : B'),
    'Tentukan x.\nLangkah 1: 12 ÷ 3 = ....\nLangkah 2: pilih (A. 3  B. 5)'
  );
  assert.equal(stripAnswerKeys('Nilai |x| = 3, jawaban: tulis angka'), 'Nilai |x| = 3, jawaban: tulis angka');
  assert.equal(stripAnswerKeys('a | Jawaban= 7'), 'a');
});

test('mengenali pilihan A-C di akhir langkah', () => {
  assert.deepEqual(parseStepChoices('Bagi kedua ruas dengan 3, sehingga x = .... (A. 3  B. 5  C. 15)'), {
    prompt: 'Bagi kedua ruas dengan 3, sehingga x = ....',
    choices: [
      { letter: 'A', text: '3' },
      { letter: 'B', text: '5' },
      { letter: 'C', text: '15' },
    ],
  });
});

test('teks pilihan boleh berisi spasi dan titik', () => {
  const r = parseStepChoices('Bunyi gitar karena .... (A. senar dipukul B. senar bergetar. C. x = 2.5 D. 1/2)');
  assert.deepEqual(r?.choices.map((c) => c.text), ['senar dipukul', 'senar bergetar.', 'x = 2.5', '1/2']);
});

test('langkah tanpa pilihan atau hanya satu pilihan -> null', () => {
  assert.equal(parseStepChoices('Hitung nilai x = ....'), null);
  assert.equal(parseStepChoices('Hitung (A. 3)'), null);
  assert.equal(parseStepChoices('Hasil (dalam cm) adalah ....'), null);
});

test('daftar pilihan harus di akhir langkah', () => {
  assert.equal(parseStepChoices('(A. 3 B. 5) lalu kalikan 2'), null);
});
