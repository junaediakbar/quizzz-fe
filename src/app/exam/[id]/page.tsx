'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LayoutGrid,
  Shield,
  WifiOff,
  Check,
  X,
  Keyboard,
  CircleDashed,
  Send,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { OptionImageDisplay, QuestionStemWithImages } from '@/components/shared/question-image-display';
import { MathText } from '@/components/shared/math-text';
import { stripMediaMarkersFromText } from '@/lib/question-images';
import { cn, formatCountdown, clampSeconds } from '@/lib/utils';
import { Question } from '@/lib/types';
import { examsApi, sessionsApi, type SessionPart } from '@/lib/api';
import {
  DEFAULT_EXAM_SECURITY,
  securityFromExamConfig,
  type ExamSecuritySettings,
} from '@/lib/exam-security';
import { toast } from 'sonner';

type Phase = 'meta' | 'preflight' | 'active' | 'locked' | 'error';

const LS_PREFIX = 'quizzz_exam_draft_';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const QUESTION_TYPE_LABEL: Record<string, string> = {
  'multiple-choice': 'Pilihan ganda',
  'true-false': 'Benar / Salah',
  'short-answer': 'Isian singkat',
  essay: 'Esai',
  'fill-blank': 'Isian',
  matching: 'Menjodohkan',
};

const DIFFICULTY_STYLE: Record<string, { label: string; className: string }> = {
  easy: { label: 'Mudah', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  medium: { label: 'Sedang', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  hard: { label: 'Sulit', className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' },
};

/** Cincin hitung mundur di sekitar ikon jam. */
function TimerRing({ pct, className }: { pct: number; className?: string }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <svg viewBox="0 0 24 24" className={cn('-rotate-90', className)} aria-hidden>
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={3} />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = typeof params.id === 'string' ? params.id : '';

  const [phase, setPhase] = useState<Phase>('meta');
  const [metaError, setMetaError] = useState('');
  const [examTitle, setExamTitle] = useState('Exam');
  const [durationMin, setDurationMin] = useState(60);
  const [questionCount, setQuestionCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [examDeadlineMs, setExamDeadlineMs] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [online, setOnline] = useState(true);
  const [security, setSecurity] = useState<ExamSecuritySettings>(DEFAULT_EXAM_SECURITY);
  const [mobileNavigatorOpen, setMobileNavigatorOpen] = useState(false);
  /** Bagian-bagian soal (kosong bila ujian tidak dibagi per bagian) */
  const [examParts, setExamParts] = useState<SessionPart[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Load exam metadata only (PRD: agree rules → fullscreen → start session)
  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMetaError('');
      try {
        const ex = await examsApi.get(examId);
        if (cancelled) return;
        setExamTitle(ex.title);
        setDurationMin(ex.config.duration || 60);
        setQuestionCount(ex.questionCount ?? ex.questions?.length ?? 0);
        setSecurity(securityFromExamConfig(ex.config));
        setPhase('preflight');
      } catch (e) {
        if (!cancelled) {
          setMetaError(e instanceof Error ? e.message : 'Could not load exam');
          setPhase('error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const logEvent = useCallback(
    async (eventType: string, detail?: Record<string, unknown>) => {
      if (!sessionId) return;
      try {
        await sessionsApi.logProctoringEvent(sessionId, eventType, detail);
      } catch {
        /* offline — queued locally not implemented server-side */
      }
    },
    [sessionId]
  );

  const beginExam = async () => {
    if (!examId) return;
    if (security.requireFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        toast.error('Fullscreen wajib untuk memulai ujian ini. Izinkan mode layar penuh.');
        return;
      }
    }

    setLoading(true);
    try {
      const s = await sessionsApi.start({ exam_id: examId });
      if (s.already_completed) {
        toast.info(
          typeof s.score === 'number'
            ? `Anda sudah menyelesaikan ujian ini (nilai: ${s.score}).`
            : 'Anda sudah menyelesaikan ujian ini.'
        );
        await document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
        if (s.result_id) {
          router.push(`/student/results/${s.result_id}`);
        } else {
          router.push('/student/dashboard');
        }
        return;
      }
      setSessionId(s.session_id);
      setExamTitle(s.exam_title || examTitle);
      setExamQuestions(s.questions);
      setExamParts(s.parts ?? []);
      setDurationMin(s.duration || durationMin);
      if (s.security) setSecurity(s.security);
      if (s.answers && typeof s.answers === 'object') {
        setAnswers((prev) => ({ ...prev, ...s.answers }));
      }

      // Pulihkan draf lokal (mis. jawaban diisi saat koneksi terputus) lalu
      // sinkronkan ke server. Jawaban dari server selalu dianggap lebih baru.
      try {
        const raw = localStorage.getItem(LS_PREFIX + s.session_id);
        const saved = raw ? (JSON.parse(raw) as { answers?: Record<string, string> }) : null;
        const local = saved?.answers && typeof saved.answers === 'object' ? saved.answers : {};
        const server = (s.answers && typeof s.answers === 'object' ? s.answers : {}) as Record<string, string>;
        const knownIds = new Set((s.questions || []).map((q) => q.id));
        const toRestore = Object.entries(local).filter(
          ([qid, ans]) => knownIds.has(qid) && !(qid in server) && typeof ans === 'string' && ans.trim() !== ''
        );
        if (toRestore.length > 0) {
          setAnswers((prev) => ({ ...prev, ...Object.fromEntries(toRestore) }));
          toast.info(`${toRestore.length} jawaban dari penyimpanan lokal dipulihkan.`);
          void Promise.all(
            toRestore.map(([qid, ans]) =>
              sessionsApi.submitAnswer(s.session_id, { question_id: qid, answer: ans }).catch(() => {})
            )
          );
        }
      } catch {
        /* draf lokal rusak — abaikan */
      }
      // Jam server bisa berbeda dari jam perangkat murid. Batasi waktu mulai ke
      // "sekarang" supaya selisih jam tidak pernah MEMBERI waktu ekstra, dan
      // sisa waktu tidak pernah melebihi durasi ujian.
      const rawStart = new Date(s.started_at).getTime();
      const durationSec = (s.duration || 60) * 60;
      const startMs = Number.isFinite(rawStart) ? Math.min(rawStart, Date.now()) : Date.now();
      const endMs = startMs + durationSec * 1000;
      const remain = clampSeconds(Math.min(durationSec, Math.floor((endMs - Date.now()) / 1000)));
      setExamDeadlineMs(endMs);
      setTimeRemaining(remain);
      setPhase('active');
      if (remain <= 0) {
        toast.warning('Waktu ujian sudah habis. Silakan submit jawaban.');
        setShowSubmitDialog(true);
      }
      await sessionsApi.logProctoringEvent(s.session_id, 'exam_started', { fullscreen: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start exam');
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      setPhase('preflight');
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = examQuestions[currentQuestionIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] || '' : '';
  const answeredCount = Object.keys(answers).filter((k) => answers[k]?.trim()).length;
  const progress =
    examQuestions.length > 0 ? (answeredCount / examQuestions.length) * 100 : 0;

  /** Part (bagian) untuk sebuah soal, berdasarkan part_id dari backend. */
  const partOfQuestion = useCallback(
    (q: Question | undefined) => {
      if (!q || examParts.length === 0 || !q.partId) return undefined;
      return examParts.find((p) => p.id === q.partId);
    },
    [examParts]
  );

  const currentPart = partOfQuestion(currentQuestion);
  /** Nomor soal di dalam bagiannya (mis. "Bagian A — soal 3 dari 10") */
  const indexInPart = currentPart
    ? examQuestions
        .filter((q) => q.partId === currentPart.id)
        .findIndex((q) => q.id === currentQuestion?.id) + 1
    : 0;

  /** Kelompok soal per bagian (untuk navigator). */
  const questionGroups = useMemo(() => {
    if (examParts.length === 0) {
      return [{ part: undefined as SessionPart | undefined, items: examQuestions.map((q, i) => ({ q, i })) }];
    }
    const groups: { part?: SessionPart; items: { q: Question; i: number }[] }[] = examParts.map((p) => ({
      part: p,
      items: [],
    }));
    const orphans: { q: Question; i: number }[] = [];
    examQuestions.forEach((q, i) => {
      const g = groups.find((x) => x.part?.id === q.partId);
      if (g) g.items.push({ q, i });
      else orphans.push({ q, i });
    });
    const nonEmpty = groups.filter((g) => g.items.length > 0);
    if (orphans.length > 0) nonEmpty.push({ part: undefined, items: orphans });
    return nonEmpty;
  }, [examParts, examQuestions]);

  const handleSubmit = useCallback(() => {
    setShowSubmitDialog(true);
  }, []);

  const finalizeLock = useCallback(
    async (count: number) => {
      if (!sessionId) return;
      setPhase('locked');
      await sessionsApi.logProctoringEvent(sessionId, 'exam_locked_violations', { count });
      setSubmitting(true);
      try {
        const { result_id } = await sessionsApi.submitExam(sessionId);
        toast.error('Exam ended due to integrity policy.');
        router.push(`/student/results/${result_id}`);
      } catch {
        setSubmitting(false);
      }
    },
    [sessionId, router]
  );

  const recordViolation = useCallback(
    async (reason: string) => {
      if (!security.enabled) return;
      const limit = security.maxViolations;
      setViolationCount((c) => {
        const n = c + 1;
        void logEvent('focus_loss', { reason, count: n });
        if (limit > 0 && n >= limit) {
          void finalizeLock(n);
        } else {
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 10000);
          const limitLabel = limit > 0 ? `${n}/${limit}` : `${n}`;
          toast.warning(`Peringatan integritas ${limitLabel}: ${reason}`);
        }
        return n;
      });
    },
    [logEvent, finalizeLock, security.enabled, security.maxViolations]
  );

  useEffect(() => {
    if (phase !== 'active' || examDeadlineMs == null) return;
    const tick = () => {
      const remain = clampSeconds(Math.floor((examDeadlineMs - Date.now()) / 1000));
      setTimeRemaining(remain);
      if (remain <= 0) {
        handleSubmit();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [handleSubmit, phase, examDeadlineMs]);

  useEffect(() => {
    if (phase !== 'active' || !security.enabled) return;
    const onVis = () => {
      const hidden = document.hidden;
      setPageHidden(security.detectFocusLoss && hidden);
      if (hidden && security.detectFocusLoss) void recordViolation('tab_or_window_hidden');
    };
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && security.requireFullscreen) void recordViolation('fullscreen_exit');
    };
    if (security.detectFocusLoss) {
      document.addEventListener('visibilitychange', onVis);
    }
    if (security.requireFullscreen) {
      document.addEventListener('fullscreenchange', onFs);
    }
    return () => {
      if (security.detectFocusLoss) document.removeEventListener('visibilitychange', onVis);
      if (security.requireFullscreen) document.removeEventListener('fullscreenchange', onFs);
    };
  }, [phase, recordViolation, security]);

  useEffect(() => {
    if (phase !== 'active' || !sessionId) return;
    const onOnline = () => {
      setOnline(true);
      toast.success('Connection restored — syncing answers…');
      void syncAnswersToServer();
    };
    const onOffline = () => {
      setOnline(false);
      toast.message('Offline — answers saved in this browser.', { duration: 5000 });
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [phase, sessionId, answers]);

  const syncAnswersToServer = async () => {
    if (!sessionId) return;
    for (const [qid, ans] of Object.entries(answers)) {
      try {
        await sessionsApi.submitAnswer(sessionId, { question_id: qid, answer: ans });
      } catch {
        /* retry later */
      }
    }
  };

  useEffect(() => {
    if (phase !== 'active' || !sessionId) return;
    const id = window.setInterval(() => {
      try {
        localStorage.setItem(
          LS_PREFIX + sessionId,
          JSON.stringify({ answers, savedAt: Date.now(), examId })
        );
      } catch {
        /* quota */
      }
    }, 10000);
    return () => clearInterval(id);
  }, [phase, sessionId, answers, examId]);
  useEffect(() => {
    if (phase !== 'active' || !security.enabled || !security.blockCopyPaste) return;
    const block = (e: Event) => e.preventDefault();
    const keyBlock = (e: KeyboardEvent) => {
      if (e.key === 'F12') e.preventDefault();
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) e.preventDefault();
      if (e.metaKey && e.altKey && e.key === 'i') e.preventDefault();
    };
    window.addEventListener('copy', block, true);
    window.addEventListener('cut', block, true);
    window.addEventListener('paste', block, true);
    window.addEventListener('contextmenu', block, true);
    window.addEventListener('keydown', keyBlock, true);
    return () => {
      window.removeEventListener('copy', block, true);
      window.removeEventListener('cut', block, true);
      window.removeEventListener('paste', block, true);
      window.removeEventListener('contextmenu', block, true);
      window.removeEventListener('keydown', keyBlock, true);
    };
  }, [phase, security.enabled, security.blockCopyPaste]);

  const persistAnswer = async (questionId: string, value: string) => {
    if (!sessionId) return;
    setSaveState('saving');
    try {
      await sessionsApi.submitAnswer(sessionId, { question_id: questionId, answer: value });
      setSaveState('saved');
    } catch {
      /* queued in localStorage */
      setSaveState('error');
    }
  };

  const handleAnswer = (value: string) => {
    if (!currentQuestion || phase !== 'active') return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    void persistAnswer(currentQuestion.id, value);
  };

  const toggleFlag = () => {
    if (!currentQuestion) return;
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  };

  const goToQuestion = (index: number) => setCurrentQuestionIndex(index);
  const goToNext = () => {
    if (currentQuestionIndex < examQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };
  const goToPrevious = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((prev) => prev - 1);
  };

  const confirmSubmit = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const { result_id, time_exceeded } = await sessionsApi.submitExam(sessionId);
      if (time_exceeded) {
        toast.warning(
          'Waktu ujian sudah berakhir — jawaban tetap dikumpulkan dan tercatat di log pengawas.'
        );
      }
      await document.exitFullscreen().catch(() => {});
      router.push(`/student/results/${result_id}`);
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getQuestionStatus = (questionId: string) => {
    if (flaggedQuestions.has(questionId)) return 'flagged';
    if (answers[questionId]?.trim()) return 'answered';
    return 'unanswered';
  };

  const timePct = timeRemaining / (durationMin * 60 || 1);
  const timeUrgency: 'normal' | 'warn' | 'critical' =
    timePct > 0.5 ? 'normal' : timePct > 0.2 && timeRemaining > 120 ? 'warn' : 'critical';

  const flaggedCount = examQuestions.filter((q) => flaggedQuestions.has(q.id)).length;
  const unansweredIndexes = examQuestions
    .map((q, i) => (answers[q.id]?.trim() ? -1 : i))
    .filter((i) => i >= 0);
  const flaggedIndexes = examQuestions
    .map((q, i) => (flaggedQuestions.has(q.id) ? i : -1))
    .filter((i) => i >= 0);
  const isLastQuestion = currentQuestionIndex === examQuestions.length - 1;

  // Pintasan keyboard: ← / → pindah soal, A–E pilih opsi, F tandai ragu-ragu.
  useEffect(() => {
    if (phase !== 'active' || showSubmitDialog || mobileNavigatorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentQuestionIndex((i) => Math.min(i + 1, examQuestions.length - 1));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentQuestionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (!currentQuestion) return;
      const key = e.key.toLowerCase();
      if (key === 'f') {
        toggleFlag();
        return;
      }
      if (currentQuestion.type === 'multiple-choice' && currentQuestion.options) {
        const idx = key.length === 1 ? key.charCodeAt(0) - 97 : -1;
        if (idx >= 0 && idx < currentQuestion.options.length) handleAnswer(currentQuestion.options[idx]);
      } else if (currentQuestion.type === 'true-false') {
        if (key === 'b') handleAnswer('true');
        if (key === 's') handleAnswer('false');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading && phase === 'meta') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (phase === 'error' || metaError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{metaError || 'Unable to load exam.'}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/student/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  if (phase === 'preflight') {
    const preflightRules: string[] = [];
    if (security.requireFullscreen) {
      preflightRules.push('Timer dimulai setelah Anda masuk mode layar penuh (fullscreen).');
    } else {
      preflightRules.push('Timer dimulai setelah Anda menekan tombol mulai.');
    }
    if (security.enabled) {
      const limitText =
        security.maxViolations > 0
          ? `${security.maxViolations} pelanggaran → sesi berakhir`
          : 'hanya peringatan, tanpa penguncian otomatis';
      if (security.detectFocusLoss && security.requireFullscreen) {
        preflightRules.push(
          `Pindah tab, minimize, atau keluar fullscreen dihitung pelanggaran (${limitText}).`
        );
      } else if (security.detectFocusLoss) {
        preflightRules.push(`Pindah tab atau jendela dicatat (${limitText}).`);
      } else if (security.requireFullscreen) {
        preflightRules.push(`Keluar fullscreen dihitung pelanggaran (${limitText}).`);
      }
      if (security.blockCopyPaste) {
        preflightRules.push('Salin, tempel, dan klik kanan dinonaktifkan selama ujian.');
      }
    } else {
      preflightRules.push(
        'Mode keamanan nonaktif — tidak ada deteksi tab atau wajib fullscreen.'
      );
    }
    preflightRules.push(
      'Jawaban disimpan otomatis setiap 10 detik dan disinkronkan saat online.'
    );

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="max-w-lg w-full border-border shadow-sm">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold font-heading tracking-tight">{examTitle}</h1>
                <p className="text-sm text-muted-foreground">
                  {security.enabled ? 'Mode ujian terproteksi' : 'Mode ujian standar'}
                </p>
              </div>
            </div>
            <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-5">
              {preflightRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-4 text-sm border-t border-border pt-4">
              <span>
                <strong className="text-foreground">Durasi:</strong> {durationMin} menit
              </span>
              <span>
                <strong className="text-foreground">Soal:</strong> {questionCount || '—'}
              </span>
            </div>
            <Button
              className="w-full h-12 text-base"
              onClick={beginExam}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : security.requireFullscreen ? (
                'Fullscreen & mulai ujian'
              ) : (
                'Mulai ujian'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'locked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-muted-foreground">Ending exam…</p>
      </div>
    );
  }

  if (!loading && phase === 'active' && examQuestions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <Alert className="max-w-md">
          <AlertDescription>No questions in this exam.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/student/dashboard')}>
          Back
        </Button>
      </div>
    );
  }

  const difficulty = DIFFICULTY_STYLE[currentQuestion.difficulty] ?? {
    label: currentQuestion.difficulty,
    className: 'bg-muted text-muted-foreground border-border',
  };
  const isFlagged = flaggedQuestions.has(currentQuestion.id);
  const wordCount = currentAnswer.trim() ? currentAnswer.trim().split(/\s+/).length : 0;

  const jumpFromDialog = (index: number) => {
    goToQuestion(index);
    setShowSubmitDialog(false);
  };

  const renderNavigatorGrid = (opts: { compact?: boolean; onPick?: () => void }) => (
    <div className="space-y-3">
      {questionGroups.map((group, gi) => (
        <div key={group.part?.id ?? `group-${gi}`} className="space-y-1.5">
          {examParts.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.part?.title ?? 'Tanpa bagian'}
            </p>
          )}
          <div className={cn('grid grid-cols-5', opts.compact ? 'gap-1.5' : 'gap-2')}>
            {group.items.map(({ q, i: index }) => {
              const status = getQuestionStatus(q.id);
              const isCurrent = index === currentQuestionIndex;
              const answeredToo = status === 'flagged' && !!answers[q.id]?.trim();
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    goToQuestion(index);
                    opts.onPick?.();
                  }}
                  aria-label={`Soal ${index + 1}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'relative flex w-full items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition-all touch-manipulation active:scale-95',
                    opts.compact ? 'h-9' : 'h-11',
                    status === 'answered' &&
                      'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600',
                    status === 'flagged' &&
                      'bg-amber-400 text-amber-950 shadow-sm shadow-amber-500/30 hover:bg-amber-500',
                    status === 'unanswered' &&
                      'border border-dashed border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-105'
                  )}
                >
                  {index + 1}
                  {answeredToo && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const statTiles = (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-emerald-500/10 px-2 py-2 text-center">
        <p className="text-lg font-bold leading-none text-emerald-600 dark:text-emerald-400 tabular-nums">
          {answeredCount}
        </p>
        <p className="mt-1 text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80">Terjawab</p>
      </div>
      <div className="rounded-xl bg-amber-500/10 px-2 py-2 text-center">
        <p className="text-lg font-bold leading-none text-amber-600 dark:text-amber-400 tabular-nums">
          {flaggedCount}
        </p>
        <p className="mt-1 text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80">Ragu-ragu</p>
      </div>
      <div className="rounded-xl bg-muted px-2 py-2 text-center">
        <p className="text-lg font-bold leading-none text-foreground tabular-nums">
          {examQuestions.length - answeredCount}
        </p>
        <p className="mt-1 text-[10px] font-medium text-muted-foreground">Belum</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background bg-linear-to-b from-primary/[0.06] via-background to-background">
      {!online && (
        <div className="bg-amber-100 text-amber-950 text-center text-sm py-2 px-4 border-b border-amber-200 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          Koneksi terputus — jawaban disimpan di browser ini dan akan disinkronkan saat online kembali.
        </div>
      )}
      {showWarning && security.enabled && (
        <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <Alert className="max-w-md mx-auto border-amber-500 bg-amber-50 shadow-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Peringatan integritas</AlertTitle>
            <AlertDescription className="text-amber-900">
              Pelanggaran tercatat ({violationCount}
              {security.maxViolations > 0 ? `/${security.maxViolations}` : ''}).
              {security.maxViolations > 0
                ? ' Pelanggaran berikutnya dapat mengakhiri ujian.'
                : ' Ujian tidak akan diakhiri otomatis.'}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading font-semibold text-base sm:text-lg truncate leading-tight">{examTitle}</h1>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                <span
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    online ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  )}
                  aria-hidden
                />
                <span className="hidden sm:inline truncate">
                  {security.enabled ? 'Sesi terproteksi' : 'Sesi standar'}
                </span>
                <span className="hidden sm:inline" aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 shrink-0">
                  {!online || saveState === 'error' ? (
                    <>
                      <CloudOff className="h-3 w-3" /> Tersimpan lokal
                    </>
                  ) : saveState === 'saving' ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan…
                    </>
                  ) : (
                    <>
                      <Cloud className="h-3 w-3" /> {saveState === 'saved' ? 'Tersimpan' : 'Tersinkron'}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full border px-2.5 py-1 sm:px-3 sm:py-1.5 font-mono text-base sm:text-lg font-bold tabular-nums transition-colors',
                timeUrgency === 'normal' && 'border-primary/20 bg-primary/5 text-primary',
                timeUrgency === 'warn' && 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                timeUrgency === 'critical' &&
                  'border-destructive/40 bg-destructive/10 text-destructive animate-pulse'
              )}
              aria-label={`Sisa waktu ${formatCountdown(timeRemaining)}`}
            >
              <span className="relative flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center">
                <TimerRing pct={timePct} className="absolute inset-0 h-full w-full" />
                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </span>
              <span>{formatCountdown(timeRemaining)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="hidden sm:inline-flex gap-1.5 h-8"
              title={isFullscreen ? 'Keluar mode fokus' : 'Mode fokus (layar penuh)'}
            >
              {isFullscreen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">Fokus</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileNavigatorOpen(true)}
              className="lg:hidden gap-1.5 h-8 px-2.5"
              aria-label="Daftar Soal"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-xs font-medium tabular-nums">{answeredCount}/{examQuestions.length}</span>
            </Button>
            <Button size="sm" onClick={handleSubmit} className="gap-1.5 h-8 shadow-sm shadow-primary/30">
              <Send className="w-3.5 h-3.5" />
              <span className="text-xs sm:text-sm font-medium">Kirim</span>
            </Button>
          </div>
        </div>
        {/* Progress bar jawaban — seluruh lebar */}
        <div className="h-1 w-full bg-muted/70">
          <div
            className="h-full rounded-r-full bg-linear-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 flex flex-col lg:flex-row gap-6 pb-28 md:pb-10">
        <main className="flex-1 min-w-0 order-1">
          <div
            className={cn(
              'transition-[filter] duration-300',
              pageHidden && security.detectFocusLoss && 'blur-md pointer-events-none select-none'
            )}
          >
            {currentPart && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-card/70 px-4 py-3 shadow-xs backdrop-blur-sm">
                <div className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-heading text-sm font-semibold">{currentPart.title}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
                      {indexInPart} / {currentPart.questionCount}
                    </span>
                  </div>
                  {currentPart.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{currentPart.description}</p>
                  ) : null}
                </div>
              </div>
            )}

            <Card className="overflow-hidden rounded-2xl border-border/70 shadow-lg shadow-primary/5">
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/70 text-lg sm:text-xl font-bold text-primary-foreground shadow-md shadow-primary/30 tabular-nums">
                      {currentQuestionIndex + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Soal {currentQuestionIndex + 1} dari {examQuestions.length}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[11px] font-medium">
                          {QUESTION_TYPE_LABEL[currentQuestion.type] ?? currentQuestion.type}
                        </Badge>
                        <Badge variant="outline" className={cn('text-[11px] font-medium', difficulty.className)}>
                          {difficulty.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] font-semibold">
                          {currentQuestion.points} poin
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFlag}
                    aria-pressed={isFlagged}
                    className={cn(
                      'h-9 shrink-0 rounded-full px-3 text-xs sm:text-sm touch-manipulation transition-all',
                      isFlagged &&
                        'bg-amber-400/20 border-amber-500/60 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-400/30'
                    )}
                  >
                    <Flag className={cn('w-3.5 h-3.5 sm:mr-1.5', isFlagged && 'fill-amber-500 text-amber-500')} />
                    <span className="hidden sm:inline">{isFlagged ? 'Ragu-ragu' : 'Tandai ragu'}</span>
                  </Button>
                </div>

                <div
                  key={currentQuestion.id}
                  className="p-4 sm:p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="mb-6 sm:mb-8">
                    <QuestionStemWithImages
                      title={currentQuestion.title}
                      content={currentQuestion.content}
                      images={currentQuestion.images}
                      imageUrls={currentQuestion.imageUrls}
                      titleClassName="text-base sm:text-lg md:text-[19px] font-semibold leading-relaxed mb-3 font-heading"
                      contentClassName="text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed text-foreground/90"
                    />
                  </div>

                  {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                    <div className="space-y-2.5 sm:space-y-3" role="radiogroup" aria-label="Pilihan jawaban">
                      {currentQuestion.options.map((option, index) => {
                        const isSelected = currentAnswer === option;
                        const letter = String.fromCharCode(65 + index);
                        return (
                          <button
                            key={index}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => handleAnswer(option)}
                            className={cn(
                              'group relative w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 text-[14px] sm:text-[15px] md:text-[16px] transition-all duration-200 flex items-start gap-3 sm:gap-4 touch-manipulation cursor-pointer',
                              isSelected
                                ? 'border-primary bg-primary/[0.07] shadow-md shadow-primary/10 font-medium text-foreground'
                                : 'border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.03] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.99]'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-all',
                                isSelected
                                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/40 scale-110'
                                  : 'bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary'
                              )}
                            >
                              {letter}
                            </span>
                            <div className="flex-1 min-w-0 space-y-2 pt-1">
                              <MathText className="leading-relaxed">
                                {stripMediaMarkersFromText(option)}
                              </MathText>
                              <OptionImageDisplay images={currentQuestion.images} optionIndex={index} />
                            </div>
                            <span
                              className={cn(
                                'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground animate-in zoom-in-50 duration-200'
                                  : 'border-border/80 text-transparent'
                              )}
                              aria-hidden
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.type === 'true-false' && (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4" role="radiogroup" aria-label="Pilihan jawaban">
                      {(['true', 'false'] as const).map((value) => {
                        const isSelected = currentAnswer === value;
                        const isTrue = value === 'true';
                        const Icon = isTrue ? Check : X;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => handleAnswer(value)}
                            className={cn(
                              'group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-5 sm:p-7 font-semibold transition-all duration-200 touch-manipulation active:scale-[0.98]',
                              isSelected
                                ? isTrue
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-md shadow-emerald-500/15'
                                  : 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 shadow-md shadow-rose-500/15'
                                : 'border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-sm hover:border-primary/40'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                                isSelected
                                  ? isTrue
                                    ? 'bg-emerald-500 text-white scale-110'
                                    : 'bg-rose-500 text-white scale-110'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              <Icon className="h-6 w-6" strokeWidth={3} />
                            </span>
                            <span>{isTrue ? 'Benar' : 'Salah'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(currentQuestion.type === 'short-answer' ||
                    currentQuestion.type === 'essay' ||
                    currentQuestion.type === 'fill-blank') && (
                    <div className="rounded-2xl border-2 border-border/70 bg-card transition-colors focus-within:border-primary focus-within:shadow-md focus-within:shadow-primary/10">
                      <textarea
                        value={currentAnswer}
                        onChange={(e) => handleAnswer(e.target.value)}
                        placeholder="Tuliskan jawaban Anda di sini…"
                        className={cn(
                          'w-full resize-y rounded-2xl bg-transparent p-4 text-[15px] sm:text-[16px] leading-relaxed outline-none focus:ring-0! focus-visible:ring-0!',
                          currentQuestion.type === 'essay' ? 'min-h-[220px]' : 'min-h-[120px]'
                        )}
                      />
                      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{wordCount} kata</span>
                        <span className="inline-flex items-center gap-1">
                          {currentAnswer.trim() ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Tersimpan otomatis
                            </>
                          ) : (
                            <>
                              <CircleDashed className="h-3 w-3" /> Belum dijawab
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop inline bottom actions */}
                <div className="hidden md:flex items-center justify-between gap-4 border-t border-border/60 bg-muted/20 px-6 py-4">
                  <Button
                    variant="outline"
                    onClick={goToPrevious}
                    disabled={currentQuestionIndex === 0}
                    className="touch-manipulation rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Sebelumnya
                  </Button>
                  <p className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Keyboard className="h-3.5 w-3.5" />
                    <kbd className="rounded border bg-card px-1 font-mono">←</kbd>
                    <kbd className="rounded border bg-card px-1 font-mono">→</kbd> pindah
                    {currentQuestion.type === 'multiple-choice' && (
                      <>
                        <span aria-hidden>·</span> <kbd className="rounded border bg-card px-1 font-mono">A</kbd>–
                        <kbd className="rounded border bg-card px-1 font-mono">
                          {String.fromCharCode(64 + (currentQuestion.options?.length || 1))}
                        </kbd>{' '}
                        pilih
                      </>
                    )}
                    {currentQuestion.type === 'true-false' && (
                      <>
                        <span aria-hidden>·</span> <kbd className="rounded border bg-card px-1 font-mono">B</kbd>/
                        <kbd className="rounded border bg-card px-1 font-mono">S</kbd> pilih
                      </>
                    )}
                    <span aria-hidden>·</span> <kbd className="rounded border bg-card px-1 font-mono">F</kbd> ragu
                  </p>
                  {isLastQuestion ? (
                    <Button
                      onClick={handleSubmit}
                      className="touch-manipulation rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Selesai & kirim
                      <Send className="w-4 h-4 ml-1.5" />
                    </Button>
                  ) : (
                    <Button onClick={goToNext} className="touch-manipulation rounded-full">
                      Selanjutnya
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          {pageHidden && security.detectFocusLoss && (
            <p className="text-center text-sm text-amber-700 mt-4 font-medium">
              Konten disembunyikan — kembali ke tab ini untuk melanjutkan.
            </p>
          )}
        </main>

        <aside className="hidden lg:block w-64 shrink-0 order-2">
          <Card className="sticky top-24 rounded-2xl border-border/70 shadow-lg shadow-primary/5">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold">Navigator Soal</h3>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {Math.round(progress)}%
                </span>
              </div>
              {statTiles}
              <div className="max-h-[52vh] overflow-y-auto p-1 -m-1">{renderNavigatorGrid({ compact: true })}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Terjawab
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-amber-400" /> Ragu-ragu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded border border-dashed border-muted-foreground/50" /> Belum
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Floating Bottom Sticky Bar for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/90 backdrop-blur-md px-3 pt-2 safe-area-pb shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            disabled={currentQuestionIndex === 0}
            className="h-11 w-11 shrink-0 rounded-full p-0 touch-manipulation"
            aria-label="Soal sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <button
            type="button"
            onClick={() => setMobileNavigatorOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1 touch-manipulation active:bg-muted"
            aria-label="Buka navigasi soal"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              Soal {currentQuestionIndex + 1} / {examQuestions.length}
              {isFlagged && <Flag className="h-3 w-3 fill-amber-500 text-amber-500" />}
            </span>
            <span className="h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%` }}
              />
            </span>
          </button>

          {isLastQuestion ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              className="h-11 shrink-0 rounded-full px-4 touch-manipulation bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Kirim
              <Send className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={goToNext}
              className="h-11 w-11 shrink-0 rounded-full p-0 touch-manipulation shadow-md shadow-primary/30"
              aria-label="Soal selanjutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Dialog Drawer / Sheet for Mobile Navigator */}
      <Dialog open={mobileNavigatorOpen} onOpenChange={setMobileNavigatorOpen}>
        <DialogContent className="max-w-md w-[92vw] sm:max-w-lg max-h-[85vh] flex flex-col p-4 sm:p-6 rounded-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg font-heading">Navigasi Soal</DialogTitle>
            <DialogDescription className="text-xs">
              Pilih nomor soal untuk langsung berpindah.
            </DialogDescription>
          </DialogHeader>
          {statTiles}
          <div className="flex-1 overflow-y-auto py-3 px-1 -mx-1">
            {renderNavigatorGrid({ onPick: () => setMobileNavigatorOpen(false) })}
          </div>
          <DialogFooter className="pt-2 border-t border-border flex flex-row gap-2 justify-between sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setMobileNavigatorOpen(false)} className="flex-1">
              Tutup
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setMobileNavigatorOpen(false);
                handleSubmit();
              }}
              className="flex-1"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Kirim Ujian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div
              className={cn(
                'mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full',
                unansweredIndexes.length === 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
              )}
            >
              {unansweredIndexes.length === 0 ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : (
                <AlertTriangle className="h-7 w-7" />
              )}
            </div>
            <DialogTitle className="font-heading">Kirim jawaban sekarang?</DialogTitle>
            <DialogDescription>
              {timeRemaining <= 0
                ? 'Waktu ujian telah habis. Kirim jawaban Anda untuk menyelesaikan ujian.'
                : unansweredIndexes.length === 0
                  ? 'Semua soal sudah dijawab. Jawaban tidak dapat diubah setelah dikirim.'
                  : `Masih ada ${unansweredIndexes.length} soal yang belum dijawab.`}
            </DialogDescription>
          </DialogHeader>

          {statTiles}

          {(unansweredIndexes.length > 0 || flaggedIndexes.length > 0) && timeRemaining > 0 && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3">
              {unansweredIndexes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Belum dijawab
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unansweredIndexes.slice(0, 30).map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => jumpFromDialog(i)}
                        className="h-7 min-w-7 rounded-md border border-dashed border-border bg-card px-1.5 text-xs font-semibold tabular-nums hover:border-primary hover:text-primary"
                      >
                        {i + 1}
                      </button>
                    ))}
                    {unansweredIndexes.length > 30 && (
                      <span className="self-center text-xs text-muted-foreground">
                        +{unansweredIndexes.length - 30} lagi
                      </span>
                    )}
                  </div>
                </div>
              )}
              {flaggedIndexes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Ditandai ragu-ragu
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {flaggedIndexes.slice(0, 30).map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => jumpFromDialog(i)}
                        className="h-7 min-w-7 rounded-md bg-amber-400 px-1.5 text-xs font-semibold text-amber-950 tabular-nums hover:bg-amber-500"
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {timeRemaining > 0 && (
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)} className="sm:flex-1">
                Lanjut mengerjakan
              </Button>
            )}
            <Button onClick={confirmSubmit} disabled={submitting} className="sm:flex-1">
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Ya, kirim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
