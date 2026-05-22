'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnswerReview } from '@/lib/types';
import { OptionImageDisplay, QuestionStemWithImages } from '@/components/shared/question-image-display';
import { stripMediaMarkersFromText } from '@/lib/question-images';
import { cn, formatNumber } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

function formatAnswer(value?: string | string[]) {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  return value;
}

interface ResultReviewListProps {
  answers: AnswerReview[];
  showAnswerKey: boolean;
}

export function ResultReviewList({ answers, showAnswerKey }: ResultReviewListProps) {
  if (answers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Belum ada detail jawaban untuk hasil ini.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {answers.map((ans, index) => (
        <AnswerReviewCard
          key={ans.questionId}
          index={index + 1}
          answer={ans}
          showAnswerKey={showAnswerKey}
        />
      ))}
    </div>
  );
}


function AnswerReviewCard({
  index,
  answer,
  showAnswerKey,
}: {
  index: number;
  answer: AnswerReview;
  showAnswerKey: boolean;
}) {
  const q = answer.question;
  const title = q?.title || `Soal ${index}`;
  const typeLabel = q?.type?.replace('-', ' ') ?? '';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Soal {index} · {typeLabel}
            </p>
            <QuestionStemWithImages
              title={title}
              content={q?.content && q.content !== title ? q.content : undefined}
              images={q?.images}
              imageUrls={q?.imageUrls}
              titleClassName="text-base leading-snug"
              contentClassName="text-sm text-muted-foreground whitespace-pre-wrap"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {answer.pendingReview ? (
              <Badge variant="secondary" className="gap-1">
                <Clock className="w-3 h-3" />
                Menunggu penilaian
              </Badge>
            ) : answer.isCorrect ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Benar
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                Salah
              </Badge>
            )}
            <Badge variant="outline">
              {formatNumber(answer.points)}/{formatNumber(answer.maxPoints)} poin
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {q?.options && q.options.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Pilihan</p>
            <ul className="space-y-1.5">
              {q.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const studentAns = formatAnswer(answer.studentAnswer);
                const correctAns = showAnswerKey ? formatAnswer(answer.correctAnswer) : '';
                const isStudentPick =
                  studentAns === opt ||
                  studentAns === letter ||
                  studentAns.toLowerCase() === opt.toLowerCase();
                const isCorrectOpt =
                  showAnswerKey &&
                  (correctAns === opt ||
                    correctAns === letter ||
                    correctAns.toLowerCase() === opt.toLowerCase());

                return (
                  <li
                    key={i}
                    className={cn(
                      'text-sm rounded-lg border px-3 py-2 flex flex-col gap-2',
                      isCorrectOpt && 'border-emerald-500/50 bg-emerald-500/10',
                      isStudentPick && !isCorrectOpt && 'border-destructive/50 bg-destructive/5',
                      !isStudentPick && !isCorrectOpt && 'border-border'
                    )}
                  >
                    <span className="font-medium mr-2">{letter}.</span>
                    <span className="flex-1">{stripMediaMarkersFromText(opt)}</span>
                    <OptionImageDisplay images={q?.images} optionIndex={i} className="w-full" />
                    {isStudentPick && (
                      <span className="ml-2 text-xs text-muted-foreground">(jawaban Anda)</span>
                    )}
                    {isCorrectOpt && showAnswerKey && (
                      <span className="ml-2 text-xs text-emerald-600">(kunci)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Jawaban Anda</p>
            <p className="text-sm font-medium whitespace-pre-wrap">
              {formatAnswer(answer.studentAnswer)}
            </p>
          </div>
          {showAnswerKey && answer.correctAnswer !== undefined && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                Kunci Jawaban
              </p>
              <p className="text-sm font-medium whitespace-pre-wrap">
                {formatAnswer(answer.correctAnswer)}
              </p>
            </div>
          )}
        </div>

        {showAnswerKey && q?.explanation && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Penjelasan</p>
            <p className="text-sm whitespace-pre-wrap">{q.explanation}</p>
          </div>
        )}

        {answer.feedback && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Feedback guru</p>
            <p className="text-sm whitespace-pre-wrap">{answer.feedback}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
