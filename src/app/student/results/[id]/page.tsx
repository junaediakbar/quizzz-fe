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
import { cn } from '@/lib/utils';
import { formatGradeLabel } from '@/lib/constants/grades';
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

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/student/results">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="font-semibold truncate">{result.examTitle || 'Hasil Ujian'}</h1>
              <p className="text-xs text-muted-foreground">
                {result.examGrade ? `${formatGradeLabel(result.examGrade)} · ` : ''}
                {result.submittedAt.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!visible && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {result.message ||
                'Hasil ujian belum dipublikasikan. Silakan tunggu penilaian dari guru.'}
            </AlertDescription>
          </Alert>
        )}

        {visible && (
          <>
            <Card>
              <CardHeader>
                <CardDescription>Ringkasan nilai</CardDescription>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <CardTitle className={cn('text-4xl tabular-nums', getScoreColor(result.percentage))}>
                      {result.percentage.toFixed(0)}%
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">
                      {result.score} / {result.maxScore} poin
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
                        Ambang: {result.passingScore}%
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {Math.round(result.timeSpent / 60)} menit
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

            <section>
              <h2 className="text-lg font-semibold mb-4">Review Jawaban</h2>
              <ResultReviewList answers={result.answers} showAnswerKey={showAnswerKey} />
            </section>
          </>
        )}

        <div className="flex gap-3 pb-8">
          <Button variant="outline" asChild className="flex-1 sm:flex-none">
            <Link href="/student/results">Semua Hasil</Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/student/dashboard">Dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
