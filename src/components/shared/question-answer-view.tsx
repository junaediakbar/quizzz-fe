'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lightbulb, Link2 } from 'lucide-react';
import { OptionImageDisplay, QuestionStemWithImages } from '@/components/shared/question-image-display';
import { MathText } from '@/components/shared/math-text';
import { stripMediaMarkersFromText } from '@/lib/question-images';
import { parseStepChoices, stripAnswerKeys } from '@/lib/step-choices';
import { splitHint } from '@/lib/question-hint';
import { cn } from '@/lib/utils';
import type { Question } from '@/lib/types';

/** Tampilan soal + area jawaban persis seperti yang dilihat murid saat ujian.
 *  Dipakai halaman ujian dan pratinjau hasil parse guru agar keduanya identik. */
export function QuestionAnswerView({
  question,
  value,
  onChange,
}: {
  question: Pick<Question, 'type' | 'title' | 'content' | 'options' | 'images' | 'imageUrls'>;
  value: string;
  onChange: (value: string) => void;
}) {
  // Kunci jawaban tidak boleh pernah tampil ke murid, meski tersimpan di teks soal.
  const { content, hint } = splitHint(stripAnswerKeys(question.content));
  /** Petunjuk yang sedang dibuka; dibandingkan dengan teksnya agar otomatis tertutup saat pindah soal. */
  const [openHint, setOpenHint] = useState<string | null>(null);
  const hintOpen = hint !== null && openHint === hint;

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <QuestionStemWithImages
          title={question.title}
          content={content}
          images={question.images}
          imageUrls={question.imageUrls}
          titleClassName="text-base sm:text-lg md:text-[18px] font-medium leading-relaxed mb-3 font-heading"
          contentClassName="text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed text-foreground/90"
        />
        {hint && (
          <div className="mt-4 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={hintOpen}
              onClick={() => setOpenHint(hintOpen ? null : hint)}
              className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            >
              <Lightbulb className="h-4 w-4 mr-1.5" />
              {hintOpen ? 'Sembunyikan petunjuk' : 'Lihat petunjuk'}
            </Button>
            {hintOpen && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[14px] sm:text-[15px]">
                <MathText as="p" className="whitespace-pre-wrap leading-relaxed">
                  {hint}
                </MathText>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {question.type === 'multiple-choice' && question.options && (
          <div className="space-y-2.5">
            {question.options.map((option, index) => {
              const isSelected = value === option;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onChange(option)}
                  className={cn(
                    'w-full text-left p-3.5 sm:p-4 rounded-xl border text-[14px] sm:text-[15px] md:text-[16px] transition-all flex items-start gap-3 touch-manipulation cursor-pointer',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-xs font-medium text-foreground'
                      : 'border-border bg-card hover:bg-muted/40 hover:border-primary/40 active:scale-[0.99]'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors mt-0.5',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <MathText className="leading-relaxed">
                      {stripMediaMarkersFromText(option)}
                    </MathText>
                    <OptionImageDisplay
                      images={question.images}
                      optionIndex={index}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
    
        {question.type === 'true-false' && (
          <div className="grid grid-cols-2 gap-3">
            {['True', 'False'].map((option) => {
              const isSelected = value === option.toLowerCase();
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange(option.toLowerCase())}
                  className={cn(
                    'p-4 sm:p-5 rounded-xl border-2 font-medium text-center transition-all touch-manipulation active:scale-[0.98]',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/40 hover:border-primary/40'
                  )}
                >
                  {option === 'True' ? 'Benar (True)' : 'Salah (False)'}
                </button>
              );
            })}
          </div>
        )}
    
        {(question.type === 'short-answer' ||
          question.type === 'essay' ||
          question.type === 'fill-blank') && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Tuliskan jawaban Anda di sini…"
            className="w-full p-3.5 sm:p-4 rounded-xl border border-input min-h-[140px] text-[15px] sm:text-[16px] leading-relaxed focus-visible:ring-2 focus-visible:ring-ring bg-card"
          />
        )}
    
        {question.type === 'step-by-step' && (
          <StepByStepAnswers
            steps={question.options ?? []}
            images={question.images}
            value={value}
            onChange={onChange}
          />
        )}
      </div>
    </>
  );
}

/** Input jawaban per langkah untuk soal step-by-step.
 *  Nilai disimpan sebagai JSON object {"1":"..","2":".."} di map jawaban. */
function StepByStepAnswers({
  steps,
  images,
  value,
  onChange,
}: {
  steps: string[];
  images?: Question['images'];
  value: string;
  onChange: (value: string) => void;
}) {
  let byStep: Record<string, string> = {};
  if (value.startsWith('{')) {
    try {
      byStep = JSON.parse(value) as Record<string, string>;
    } catch {
      byStep = {};
    }
  } else if (value.trim() && steps.length > 0) {
    // jawaban lama (teks biasa) dianggap milik langkah 1
    byStep = { '1': value };
  }

  const update = (index: number, v: string) => {
    const next = { ...byStep, [String(index + 1)]: v };
    if (Object.values(next).every((x) => !x.trim())) {
      onChange('');
      return;
    }
    onChange(JSON.stringify(next));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Kerjakan setiap langkah secara berurutan. Klik pilihan yang benar, atau isi kotak dengan{' '}
        <strong>jawaban singkat saja</strong> berupa angka atau huruf (mis. <code>15</code> atau <code>B</code>),
        tanpa menuliskan cara atau satuan.
      </p>
      {steps.map((step, i) => {
        const parsed = parseStepChoices(step);
        const current = byStep[String(i + 1)] ?? '';
        return (
          <div key={i} className="rounded-xl border border-border bg-card p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <MathText as="p" className="text-[14px] sm:text-[15px] leading-relaxed">
                  {stripMediaMarkersFromText(parsed?.prompt ?? step)}
                </MathText>
                <OptionImageDisplay images={images} optionIndex={i} className="mt-0" />
                <StepReferenceBadges step={step} currentStep={i + 1} totalSteps={steps.length} byStep={byStep} />
                {parsed ? (
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Pilihan langkah ${i + 1}`}>
                    {parsed.choices.map((c) => {
                      const isSelected = current.trim().toUpperCase() === c.letter;
                      return (
                        <button
                          key={c.letter}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => update(i, isSelected ? '' : c.letter)}
                          className={cn(
                            'flex items-start gap-2.5 rounded-lg border p-2.5 text-left text-[14px] sm:text-[15px] transition-all touch-manipulation',
                            isSelected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary font-medium'
                              : 'border-border hover:bg-muted/40 hover:border-primary/40'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {c.letter}
                          </span>
                          <MathText className="leading-relaxed pt-0.5">{c.text}</MathText>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    value={current}
                    onChange={(e) => update(i, e.target.value)}
                    placeholder="Angka/huruf saja"
                    aria-label={`Jawaban langkah ${i + 1}`}
                    autoComplete="off"
                    className="max-w-[12rem]"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Menandai langkah lain yang disebut dalam teks (mis. "hasil langkah 1") dan
 *  menampilkan nilai jawaban langkah tersebut saat ini sebagai acuan cepat. */
function StepReferenceBadges({
  step,
  currentStep,
  totalSteps,
  byStep,
}: {
  step: string;
  currentStep: number;
  totalSteps: number;
  byStep: Record<string, string>;
}) {
  const refs = Array.from(new Set(Array.from(step.matchAll(/langkah\s*(\d+)/gi), (m) => Number(m[1]))))
    .filter((n) => n >= 1 && n <= totalSteps && n !== currentStep);

  if (refs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {refs.map((n) => {
        const refValue = byStep[String(n)]?.trim();
        return (
          <span
            key={n}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              refValue ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            <Link2 className="w-3 h-3 shrink-0" />
            Langkah {n}: {refValue || 'belum diisi'}
          </span>
        );
      })}
    </div>
  );
}
