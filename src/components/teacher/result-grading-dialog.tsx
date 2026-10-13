'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  ExternalLink,
  PenLine,
  Clock,
  User as UserIcon,
  ShieldAlert,
} from 'lucide-react';
import { cn, formatDurationMinutes, formatPercent } from '@/lib/utils';
import { MathText } from '@/components/shared/math-text';
import { OptionImageDisplay, QuestionStemWithImages } from '@/components/shared/question-image-display';
import { stripMediaMarkersFromText } from '@/lib/question-images';
import { resultsApi, sessionsApi, type ProctoringEvent } from '@/lib/api';
import type { ExamResult, QuestionType } from '@/lib/types';
import { toast } from 'sonner';

/** Tipe yang dinilai otomatis; sisanya (uraian/menjodohkan) perlu penilaian guru. */
const AUTO_GRADED: QuestionType[] = ['multiple-choice', 'true-false', 'short-answer', 'fill-blank'];

const TYPE_LABEL: Record<string, string> = {
  'multiple-choice': 'Pilihan Ganda',
  'true-false': 'Benar/Salah',
  'short-answer': 'Jawaban Singkat',
  essay: 'Uraian',
  matching: 'Menjodohkan',
  'fill-blank': 'Isian',
};

interface DraftRow {
  points: number;
  feedback: string;
}

export interface ResultGradingDialogProps {
  resultId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dipanggil setelah penilaian tersimpan (mis. untuk refresh daftar hasil). */
  onGraded?: () => void;
}

export function ResultGradingDialog({
  resultId,
  open,
  onOpenChange,
  onGraded,
}: ResultGradingDialogProps) {
  const [detail, setDetail] = useState<ExamResult | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [violations, setViolations] = useState<ProctoringEvent[]>([]);

  /** Muat detail dari server (dipakai tombol "Coba lagi" & setelah menyimpan). */
  const reload = useCallback(async (id: string) => {
    const res = await resultsApi.get(id);
    setDetail(res);
    setError('');
    const next: Record<string, DraftRow> = {};
    for (const a of res.answers ?? []) {
      next[a.questionId] = { points: a.points, feedback: a.feedback ?? '' };
    }
    setDraft(next);
  }, []);

  /**
   * Ambil detail saat dialog dibuka. Semua setState terjadi setelah await
   * (bukan sinkron di body effect) supaya tidak memicu cascading render.
   */
  useEffect(() => {
    if (!open || !resultId) return;
    let cancelled = false;
    resultsApi
      .get(resultId)
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
        setError('');
        const next: Record<string, DraftRow> = {};
        for (const a of res.answers ?? []) {
          next[a.questionId] = { points: a.points, feedback: a.feedback ?? '' };
        }
        setDraft(next);
        // Pelanggaran integritas (jika ada) — opsional, jangan gagalkan dialog.
        sessionsApi
          .getProctoringEvents(res.sessionId)
          .then((evts) => {
            if (!cancelled) setViolations(evts);
          })
          .catch(() => {
            if (!cancelled) setViolations([]);
          });
      })
      .catch((e) => {
        if (cancelled) return;
        setDetail(null);
        setError(e instanceof Error ? e.message : 'Gagal memuat detail hasil');
      });
    return () => {
      cancelled = true;
    };
  }, [open, resultId]);

  const answers = useMemo(() => detail?.answers ?? [], [detail]);
  /** Belum ada detail & belum error & dialog terbuka = masih memuat. */
  const loading = Boolean(open && resultId && !detail && !error);
  const pendingCount = useMemo(() => answers.filter((a) => a.pendingReview).length, [answers]);
  const draftTotal = useMemo(
    () => answers.reduce((sum, a) => sum + (draft[a.questionId]?.points ?? 0), 0),
    [answers, draft]
  );

  const setPoints = (qid: string, points: number, maxPoints: number) => {
    const clamped = Math.max(0, Math.min(maxPoints, Number.isFinite(points) ? points : 0));
    setDraft((prev) => ({ ...prev, [qid]: { ...(prev[qid] ?? { points: 0, feedback: '' }), points: clamped } }));
  };

  const setFeedback = (qid: string, feedback: string) => {
    setDraft((prev) => ({ ...prev, [qid]: { ...(prev[qid] ?? { points: 0, feedback: '' }), feedback } }));
  };

  const handleSave = async () => {
    if (!resultId || !detail) return;
    setSaving(true);
    try {
      const points: Record<string, number> = {};
      const feedback: Record<string, string> = {};
      for (const a of answers) {
        const row = draft[a.questionId];
        if (!row) continue;
        points[a.questionId] = row.points;
        feedback[a.questionId] = row.feedback;
      }
      const updated = await resultsApi.grade(resultId, { points, feedback });
      toast.success(
        `Penilaian ${detail.studentName} tersimpan — skor ${updated.score}/${detail.maxScore}${
          updated.passed ? ' (lulus)' : ''
        }`
      );
      // Muat ulang agar badge "perlu dinilai" & skor ikut terbarui.
      await reload(resultId);
      onGraded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan penilaian');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            Periksa & Nilai Jawaban
          </DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.studentName} • ${detail.examTitle || 'Ujian'}`
              : 'Memuat detail jawaban murid…'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!resultId) return;
                  setError('');
                  void reload(resultId).catch((e) =>
                    setError(e instanceof Error ? e.message : 'Gagal memuat detail hasil')
                  );
                }}
              >
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        ) : detail ? (
          <>
            {/* Ringkasan */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{detail.studentName}</span>
                <Badge variant="outline">{detail.examTitle || 'Ujian'}</Badge>
                {detail.passed ? (
                  <Badge className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/10 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Lulus
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" /> Belum lulus
                  </Badge>
                )}
                {pendingCount > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 gap-1">
                    <PenLine className="h-3 w-3" /> {pendingCount} jawaban perlu dinilai
                  </Badge>
                )}
                {detail.gradedAt && (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Dinilai {detail.gradedAt.toLocaleString('id-ID')}
                  </Badge>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Skor tersimpan</p>
                  <p className="text-lg font-semibold">
                    {detail.score}/{detail.maxScore}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({formatPercent(detail.percentage)})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Skor pada form</p>
                  <p className={cn('text-lg font-semibold', draftTotal !== detail.score && 'text-amber-600')}>
                    {draftTotal}/{detail.maxScore}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">KKM</p>
                  <p className="text-lg font-semibold">
                    {detail.passingScore !== undefined ? `${detail.passingScore}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Waktu</p>
                  <p className="flex items-center gap-1 text-lg font-semibold">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDurationMinutes(Math.round(detail.timeSpent / 60))}
                  </p>
                </div>
              </div>

              <Progress className="mt-3 h-1.5" value={Math.min(100, detail.percentage)} />
            </div>

            {violations.length > 0 && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4" />
                  {violations.length} pelanggaran integritas tercatat
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(
                    violations.reduce<Record<string, number>>((acc, v) => {
                      acc[v.eventType] = (acc[v.eventType] ?? 0) + 1;
                      return acc;
                    }, {})
                  ).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type} ×{count}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Terakhir: {violations[violations.length - 1]?.eventType}
                  {violations[violations.length - 1]?.createdAt
                    ? ` · ${new Date(violations[violations.length - 1].createdAt).toLocaleString('id-ID')}`
                    : ''}
                </p>
              </div>
            )}

            {/* Daftar jawaban */}
            <div className="flex-1 space-y-3 overflow-y-auto py-1 pr-1">
              {answers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Tidak ada detail jawaban untuk hasil ini.
                </p>
              ) : (
                answers.map((a, i) => {
                  const q = a.question;
                  const type = (q?.type ?? 'multiple-choice') as QuestionType;
                  const isManual = !AUTO_GRADED.includes(type);
                  const row = draft[a.questionId] ?? { points: a.points, feedback: '' };
                  const studentAnswer = stripMediaMarkersFromText(String(a.studentAnswer ?? ''));
                  const correctAnswer = a.correctAnswer ? String(a.correctAnswer) : '';
                  return (
                    <div
                      key={a.questionId || i}
                      className={cn(
                        'rounded-xl border p-3',
                        a.pendingReview ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Soal {i + 1}</Badge>
                        <Badge variant="secondary">{TYPE_LABEL[type] ?? type}</Badge>
                        {isManual && (
                          <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/10">
                            Dinilai manual
                          </Badge>
                        )}
                        {a.isCorrect ? (
                          <Badge className="gap-1 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/10">
                            <CheckCircle2 className="h-3 w-3" /> Benar
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" /> Belum tepat
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          maks {a.maxPoints} poin
                        </span>
                      </div>

                      <QuestionStemWithImages
                        title={q?.title}
                        content={q?.content && q.content !== q.title ? q.content : undefined}
                        images={q?.images}
                        imageUrls={q?.imageUrls}
                        titleClassName="text-sm font-medium"
                        contentClassName="text-sm whitespace-pre-wrap text-muted-foreground"
                      />

                      {q?.options && q.options.length > 0 && type === 'multiple-choice' && (
                        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {q.options.map((opt, oi) => {
                            const isStudent = studentAnswer === opt;
                            const isKey = correctAnswer === opt;
                            return (
                              <div
                                key={oi}
                                className={cn(
                                  'flex items-start gap-2 rounded-lg border px-2 py-1 text-xs',
                                  isKey && 'border-emerald-500/50 bg-emerald-500/10',
                                  !isKey && isStudent && 'border-red-500/40 bg-red-500/10'
                                )}
                              >
                                <span className="font-medium text-muted-foreground">
                                  {String.fromCharCode(97 + oi)})
                                </span>
                                <MathText className="min-w-0 flex-1">{opt}</MathText>
                                <OptionImageDisplay images={q.images} optionIndex={oi} />
                                {isKey && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-2 space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">Jawaban murid: </span>
                          {studentAnswer ? (
                            <MathText as="span" className="font-medium">
                              {studentAnswer}
                            </MathText>
                          ) : (
                            <span className="italic text-muted-foreground">tidak dijawab</span>
                          )}
                        </p>
                        {correctAnswer && (
                          <p>
                            <span className="text-muted-foreground">Kunci: </span>
                            <MathText as="span">{correctAnswer}</MathText>
                          </p>
                        )}
                        {q?.explanation ? (
                          <p className="text-xs text-muted-foreground">
                            Pembahasan: <MathText as="span">{q.explanation}</MathText>
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr]">
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`points-${a.questionId}`}>
                            Poin (0–{a.maxPoints})
                          </Label>
                          <Input
                            id={`points-${a.questionId}`}
                            type="number"
                            min={0}
                            max={a.maxPoints}
                            value={row.points}
                            onChange={(e) => setPoints(a.questionId, Number(e.target.value), a.maxPoints)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`fb-${a.questionId}`}>
                            Umpan balik untuk murid (opsional)
                          </Label>
                          <Textarea
                            id={`fb-${a.questionId}`}
                            rows={2}
                            value={row.feedback}
                            onChange={(e) => setFeedback(a.questionId, e.target.value)}
                            placeholder="mis. Jawaban sudah benar, lengkapi satuannya."
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}

        <DialogFooter className="flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" asChild className="justify-start">
            <Link href={`/student/results/${resultId ?? ''}`}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Tampilan murid
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Tutup
            </Button>
            <Button onClick={handleSave} disabled={saving || loading || !detail} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan penilaian
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
