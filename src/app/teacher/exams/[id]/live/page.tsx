'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { examsApi, type LiveExamResponse, type LiveStudentSession } from '@/lib/api';
import type { Exam, Question } from '@/lib/types';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { MathText } from '@/components/shared/math-text';
import { OptionImageDisplay, QuestionStemWithImages } from '@/components/shared/question-image-display';
import { stripMediaMarkersFromText } from '@/lib/question-images';

const POLL_MS = 3000;

function formatTime(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function statusBadge(status: string) {
  switch (status) {
    case 'in-progress':
      return <Badge className="bg-green-500/10 text-green-600">Mengerjakan</Badge>;
    case 'submitted':
    case 'graded':
      return <Badge className="bg-blue-500/10 text-blue-600">Selesai</Badge>;
    case 'not-started':
      return <Badge variant="secondary">Belum mulai</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/** Teks jawaban yang mudah dibaca guru: untuk pilihan ganda tampilkan isi opsinya. */
function displayAnswer(q: Question | undefined, raw: string | undefined): string {
  if (raw === undefined || raw === null || raw.trim() === '') return '';
  if (!q) return raw;
  const opts = q.options ?? [];
  if (q.type === 'multiple-choice' && opts.length > 0) {
    const idx = opts.findIndex((o) => o === raw);
    if (idx >= 0) return `${String.fromCharCode(65 + idx)}. ${opts[idx]}`;
  }
  if (q.type === 'true-false') {
    const v = raw.trim().toLowerCase();
    if (v === 'true') return 'Benar';
    if (v === 'false') return 'Salah';
  }
  return raw;
}

/** Kunci jawaban sebagai teks (soal bertahap menyimpan beberapa kunci). */
function answerKeyText(q: Question): string {
  const key = q.correctAnswer;
  return Array.isArray(key) ? key.join('; ') : String(key ?? '');
}

export default function ExamLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [live, setLive] = useState<LiveExamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const loadExam = useCallback(async () => {
    try {
      const e = await examsApi.get(id);
      setExam(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ujian');
    }
  }, [id]);

  const loadLive = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await examsApi.getLive(id);
      setLive(res);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data live');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExam();
    loadLive();
  }, [loadExam, loadLive]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(loadLive, POLL_MS);
    return () => clearInterval(t);
  }, [autoRefresh, loadLive]);

  const questionById = useMemo(() => {
    const m = new Map<string, Question>();
    (exam?.questions ?? []).forEach((q) => m.set(q.id, q));
    return m;
  }, [exam]);

  const sessions: LiveStudentSession[] = useMemo(() => live?.sessions ?? [], [live]);

  const selected = useMemo(() => {
    if (sessions.length === 0) return null;
    return sessions.find((s) => s.sessionId === selectedId) ?? sessions[0];
  }, [sessions, selectedId]);

  const activeCount = sessions.filter((s) => s.status === 'in-progress').length;
  const doneCount = sessions.filter((s) => s.status === 'submitted' || s.status === 'graded').length;
  const totalQ = live?.totalQuestions ?? exam?.questions.length ?? 0;

  const copyNotice = () => toast.message('Data diperbarui otomatis tiap 3 detik.');

  return (
    <TeacherNav userName={user?.name} userAvatar={user?.avatar}>
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/teacher/exams`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Live Monitoring</h1>
              <p className="text-sm text-muted-foreground">
                {live?.examTitle || exam?.title || '...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Mengerjakan: {activeCount}</Badge>
            <Badge variant="outline">Selesai: {doneCount}</Badge>
            <Badge variant="outline">Total murid: {sessions.length}</Badge>
            <Button
              size="sm"
              variant={autoRefresh ? 'default' : 'outline'}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? 'Auto-refresh: On' : 'Auto-refresh: Off'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { loadLive(); copyNotice(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Terakhir diperbarui {formatTime(lastUpdated.toISOString())}
          </p>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Belum ada murid yang memulai ujian ini.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Daftar murid */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Murid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
                {sessions.map((s) => {
                  const isSel = selected?.sessionId === s.sessionId;
                  return (
                    <button
                      key={s.sessionId}
                      type="button"
                      onClick={() => setSelectedId(s.sessionId)}
                      className={`w-full text-left rounded-md border p-3 transition ${
                        isSel ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{s.studentName || 'Tanpa nama'}</span>
                        {statusBadge(s.status)}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {s.answeredCount}/{totalQ} terjawab
                        </span>
                        <span>Percobaan {s.attemptNumber}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-emerald-600"
                          style={{
                            width: `${totalQ > 0 ? Math.min(100, (s.answeredCount / totalQ) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Detail jawaban murid terpilih */}
            {selected && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>{selected.studentName || 'Tanpa nama'}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Mulai {formatTime(selected.startedAt)} · Update {formatTime(selected.updatedAt)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(exam?.questions ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Soal ujian belum dimuat.</p>
                  )}
                  {(exam?.questions ?? []).map((q, i) => {
                    const raw = selected.answers[q.id];
                    const text = displayAnswer(questionById.get(q.id), raw);
                    const answered = text !== '';
                    return (
                      <div key={q.id} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{q.title || `Soal ${i + 1}`}</span>
                          <Badge variant={answered ? 'default' : 'outline'}>
                            {answered ? 'Terjawab' : 'Belum'}
                          </Badge>
                        </div>
                        <QuestionStemWithImages
                          content={q.content}
                          images={q.images}
                          imageUrls={q.imageUrls}
                          titleClassName="text-sm font-medium"
                          contentClassName="text-sm leading-relaxed"
                        />
                        {q.type === 'multiple-choice' && (q.options ?? []).length > 0 && (
                          <ul className="space-y-1.5">
                            {(q.options ?? []).map((option, idx) => {
                              const isKey = answerKeyText(q) === option;
                              return (
                                <li
                                  key={idx}
                                  className={`flex items-start gap-2 rounded border px-2.5 py-1.5 text-sm ${
                                    raw === option ? 'border-primary bg-primary/10 font-medium' : ''
                                  } ${isKey ? 'border-green-600 ring-1 ring-green-600' : ''}`}
                                >
                                  <span className="font-semibold">{String.fromCharCode(65 + idx)}.</span>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <MathText>{stripMediaMarkersFromText(option)}</MathText>
                                    <OptionImageDisplay images={q.images} optionIndex={idx} />
                                  </div>
                                  {isKey && (
                                    <Badge className="bg-green-600/10 text-green-700 dark:text-green-400">Kunci</Badge>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="text-muted-foreground">Jawaban murid: </span>
                            {answered ? (
                              <span className="whitespace-pre-wrap font-medium">{text}</span>
                            ) : (
                              <span className="text-muted-foreground">— belum dijawab —</span>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Kunci jawaban: </span>
                            <span className="whitespace-pre-wrap font-medium text-green-700 dark:text-green-400">
                              {displayAnswer(q, answerKeyText(q)) || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </TeacherNav>
  );
}
