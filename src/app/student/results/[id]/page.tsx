'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resultsApi } from '@/lib/api';
import type { ExamResult } from '@/lib/types';
import { ResultReviewList } from '@/components/student/result-review';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn, formatDurationMinutes, formatNumber, formatPercent } from '@/lib/utils';
import { formatGradeLabel } from '@/lib/constants/grades';
import { MathText } from '@/components/shared/math-text';
import { OptionImageDisplay, QuestionStemWithImages } from '@/components/shared/question-image-display';
import { stripMediaMarkersFromText } from '@/lib/question-images';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  Trophy,
  XCircle,
} from 'lucide-react';

function getScoreColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function PrintableQuestions({ result }: { result: ExamResult }) {
  const answers = result.answers ?? [];
  return (
    <div className="only-print px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{result.examTitle || 'Soal Ujian'}</h1>
        <p className="text-sm text-muted-foreground">
          {result.examGrade ? `${formatGradeLabel(result.examGrade)} · ` : ''}
          {result.submittedAt.toLocaleString('id-ID')}
        </p>
      </div>

      {answers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Soal tidak tersedia untuk hasil ini.</p>
      ) : (
        <div className="space-y-5">
          {answers.map((ans, index) => {
            const q = ans.question;
            const title = q?.title || `Soal ${index + 1}`;
            return (
              <div key={ans.questionId || index} className="print-avoid-break">
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Soal {index + 1}
                  </p>
                </div>

                <QuestionStemWithImages
                  title={title}
                  content={q?.content && q.content !== title ? q.content : undefined}
                  images={q?.images}
                  imageUrls={q?.imageUrls}
                  titleClassName="text-base leading-snug"
                  contentClassName="text-sm whitespace-pre-wrap"
                />

                {q?.options && q.options.length > 0 && (
                  <div className="mt-3">
                    <ul className="space-y-2">
                      {q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        return (
                          <li key={i} className="text-sm">
                            <div className="flex gap-2">
                              <span className="font-medium">{letter}.</span>
                              <div className="min-w-0 flex-1">
                                <MathText as="span">{stripMediaMarkersFromText(opt)}</MathText>
                                <OptionImageDisplay images={q?.images} optionIndex={i} className="mt-2" />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudentResultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const resultId = params.id as string;

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resultId || authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await resultsApi.get(resultId);
        if (!cancelled) setResult(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Gagal memuat hasil ujian');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultId, user, authLoading, router]);

  const showAnswerKey = Boolean(
    result?.resultsVisible !== false && result?.allowReview !== false
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive">{error || 'Hasil tidak ditemukan'}</p>
        <Button variant="outline" asChild>
          <Link href="/student/dashboard">Kembali ke Dashboard</Link>
        </Button>
      </div>
    );
  }

  const visible = result.resultsVisible !== false;
  const canDownloadQuestions = (result.answers ?? []).some((a) => Boolean(a.question));

  return (
    <>
      <div className="no-print border-b bg-background/80">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/student/results">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate font-semibold">{result.examTitle || 'Hasil Ujian'}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {result.examGrade ? `${formatGradeLabel(result.examGrade)} · ` : ''}
                {result.submittedAt.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {!visible && (
          <Alert className="no-print">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {result.message ||
                'Hasil ujian belum dipublikasikan. Silakan tunggu penilaian dari guru.'}
            </AlertDescription>
          </Alert>
        )}

        {visible && (
          <>
            <Card className="no-print">
              <CardHeader>
                <CardDescription>Ringkasan nilai</CardDescription>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <CardTitle className={cn('text-4xl tabular-nums', getScoreColor(result.percentage))}>
                      {formatPercent(result.percentage)}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">
                      {formatNumber(result.score)} / {formatNumber(result.maxScore)} poin
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.passed ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1 text-sm px-3 py-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Lulus
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 text-sm px-3 py-1">
                        <XCircle className="w-4 h-4" />
                        Belum lulus
                      </Badge>
                    )}
                    {result.passingScore !== undefined && (
                      <Badge variant="outline" className="gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        Ambang: {formatPercent(result.passingScore)}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDurationMinutes(result.timeSpent)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {!showAnswerKey && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Kunci jawaban disembunyikan untuk ujian ini. Anda tetap dapat melihat jawaban
                    yang Anda kirimkan.
                  </p>
                </CardContent>
              )}
            </Card>

            <section className="no-print">
              <h2 className="text-lg font-semibold mb-4">Review Jawaban</h2>
              <ResultReviewList answers={result.answers} showAnswerKey={showAnswerKey} />
            </section>
          </>
        )}

        <div className="no-print flex flex-col gap-3 pb-8 sm:flex-row">
          {canDownloadQuestions && (
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={() => {
                window.print();
              }}
            >
              Download Soal (PDF)
            </Button>
          )}
          <Button variant="outline" asChild className="flex-1 sm:flex-none">
            <Link href="/student/results">Semua Hasil</Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/student/dashboard">Dashboard</Link>
          </Button>
        </div>
      </main>

      {canDownloadQuestions && <PrintableQuestions result={result} />}
    </>
  );
}
