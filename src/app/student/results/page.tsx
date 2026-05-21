'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resultsApi } from '@/lib/api';
import type { ExamResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatDurationMinutes, formatPercent } from '@/lib/utils';
import { formatGradeLabel } from '@/lib/constants/grades';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Loader2,
  XCircle,
} from 'lucide-react';

function getScoreColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBgColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500/10';
  if (pct >= 60) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

export default function StudentResultsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await resultsApi.list();
        if (!cancelled) setResults(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="border-b bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/student/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" />
            <h1 className="truncate text-lg font-semibold">Semua Hasil Ujian</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {results.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Belum ada hasil ujian. Selesaikan ujian untuk melihat hasil di sini.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/student/results/${result.id}`}
                  className="flex items-center justify-between gap-4 p-5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                        getScoreBgColor(result.percentage)
                      )}
                    >
                      {result.passed ? (
                        <CheckCircle2 className={cn('w-5 h-5', getScoreColor(result.percentage))} />
                      ) : (
                        <XCircle className={cn('w-5 h-5', getScoreColor(result.percentage))} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {result.examTitle || `Ujian ${result.examId.slice(0, 8)}…`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {result.examGrade ? `${formatGradeLabel(result.examGrade)} · ` : ''}
                        {result.submittedAt.toLocaleDateString('id-ID')} ·{' '}
                        {formatDurationMinutes(result.timeSpent)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-lg font-bold tabular-nums', getScoreColor(result.percentage))}>
                      {formatPercent(result.percentage)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
