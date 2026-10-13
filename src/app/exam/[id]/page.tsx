'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  Wifi,
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
    try {
      await sessionsApi.submitAnswer(sessionId, { question_id: questionId, answer: value });
    } catch {
      /* queued in localStorage */
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

  const getTimeColor = () => {
    const total = durationMin * 60 || 1;
    const pct = (timeRemaining / total) * 100;
    if (pct > 50) return 'text-foreground';
    if (pct > 20) return 'text-amber-600';
    return 'text-destructive';
  };

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

  return (
    <div className="min-h-screen bg-background">
      {!online && (
        <div className="bg-amber-100 text-amber-950 text-center text-sm py-2 px-4 border-b border-amber-200 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Connection lost — answers are saved in this browser. They will sync when you are back online.
        </div>
      )}
      {online && phase === 'active' && (
        <div className="bg-muted/50 text-center text-xs py-1 text-muted-foreground flex items-center justify-center gap-1">
          <Wifi className="w-3 h-3" /> Connected
        </div>
      )}

      {showWarning && security.enabled && (
        <div className="fixed top-0 left-0 right-0 z-50 p-4">
          <Alert className="max-w-md mx-auto border-amber-500 bg-amber-50">
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

      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading font-semibold text-base sm:text-lg truncate">{examTitle}</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              {security.enabled ? 'Sesi terproteksi' : 'Sesi standar'} · Soal {currentQuestionIndex + 1}/{examQuestions.length}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className={cn('flex items-center gap-1.5 font-mono text-base sm:text-lg font-semibold px-2 py-1 rounded-md bg-muted/40', getTimeColor())}>
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>{formatCountdown(timeRemaining)}</span>
            </div>
            <div className="hidden md:block w-36 lg:w-40">
              <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                <span>Progress</span>
                <span>
                  {answeredCount}/{examQuestions.length}
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
            <Button variant="outline" size="sm" onClick={toggleFullscreen} className="hidden sm:inline-flex gap-1.5 h-8">
              {isFullscreen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Focus</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileNavigatorOpen(true)}
              className="lg:hidden gap-1.5 h-8 px-2.5"
              aria-label="Daftar Soal"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-xs font-medium">{answeredCount}/{examQuestions.length}</span>
            </Button>
            <Button size="sm" onClick={handleSubmit} className="gap-1.5 h-8">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs sm:text-sm font-medium">Kirim</span>
            </Button>
          </div>
        </div>
        {/* Mobile top thin progress indicator */}
        <div className="h-1 w-full bg-muted md:hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6 flex flex-col lg:flex-row gap-6 pb-24 md:pb-6">
        <aside className="hidden lg:block w-56 shrink-0 space-y-4">
          <Card className="border-border sticky top-20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm font-semibold">Navigator Soal</h3>
                <span className="text-xs text-muted-foreground">{answeredCount}/{examQuestions.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 max-h-[60vh] overflow-y-auto p-0.5">
                {questionGroups.map((group, gi) => (
                  <div key={group.part?.id ?? `group-${gi}`} className="col-span-5 space-y-1.5">
                    {examParts.length > 0 && (
                      <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.part?.title ?? 'Tanpa bagian'}
                      </p>
                    )}
                    <div className="grid grid-cols-5 gap-1.5">
                      {group.items.map(({ q, i: index }) => {
                        const status = getQuestionStatus(q.id);
                        const isCurrent = index === currentQuestionIndex;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => goToQuestion(index)}
                            className={cn(
                              'h-9 w-full rounded-md text-xs font-medium transition-all touch-manipulation flex items-center justify-center',
                              isCurrent && 'ring-2 ring-primary ring-offset-2 font-bold shadow-sm',
                              status === 'answered' && 'bg-emerald-600 text-white hover:bg-emerald-700',
                              status === 'flagged' && 'bg-amber-500 text-white hover:bg-amber-600',
                              status === 'unanswered' && 'bg-muted hover:bg-muted/80 text-foreground'
                            )}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-600 shrink-0" />
                  <span>Terjawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
                  <span>Ragu-ragu (Flag)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-muted border shrink-0" />
                  <span>Belum dijawab</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="flex-1 min-w-0">
          <div
            className={cn(
              'transition-[filter] duration-300',
              pageHidden && security.detectFocusLoss && 'blur-md pointer-events-none select-none'
            )}
          >
            <Card className="border-border border-t-[3px] border-t-primary shadow-sm">
              <CardContent className="p-4 sm:p-6 md:p-8">
                {currentPart && (
                  <div className="mb-4 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 sm:mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-heading text-sm font-semibold">{currentPart.title}</p>
                      <span className="text-[11px] text-muted-foreground">
                        Soal {indexInPart} dari {currentPart.questionCount} di bagian ini
                      </span>
                    </div>
                    {currentPart.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{currentPart.description}</p>
                    ) : null}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <Badge variant="outline" className="text-sm sm:text-base px-2 sm:px-2.5 py-0.5 font-heading">
                      Soal #{currentQuestionIndex + 1}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">{currentQuestion.points} poin</Badge>
                    <Badge variant="outline" className="capitalize text-xs">
                      {currentQuestion.difficulty}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFlag}
                    className={cn(
                      'h-8 px-2.5 text-xs sm:text-sm touch-manipulation',
                      flaggedQuestions.has(currentQuestion.id) &&
                        'bg-amber-500/15 border-amber-500/60 text-amber-700 dark:text-amber-300 font-medium'
                    )}
                  >
                    <Flag className={cn("w-3.5 h-3.5 mr-1.5", flaggedQuestions.has(currentQuestion.id) && "fill-amber-500 text-amber-500")} />
                    <span>{flaggedQuestions.has(currentQuestion.id) ? 'Ragu-ragu' : 'Tandai'}</span>
                  </Button>
                </div>

                <div className="mb-6 sm:mb-8">
                  <QuestionStemWithImages
                    title={currentQuestion.title}
                    content={currentQuestion.content}
                    images={currentQuestion.images}
                    imageUrls={currentQuestion.imageUrls}
                    titleClassName="text-base sm:text-lg md:text-[18px] font-medium leading-relaxed mb-3 font-heading"
                    contentClassName="text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed text-foreground/90"
                  />
                </div>

                <div className="space-y-3">
                  {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((option, index) => {
                        const isSelected = currentAnswer === option;
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleAnswer(option)}
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
                                images={currentQuestion.images}
                                optionIndex={index}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.type === 'true-false' && (
                    <div className="grid grid-cols-2 gap-3">
                      {['True', 'False'].map((option) => {
                        const isSelected = currentAnswer === option.toLowerCase();
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleAnswer(option.toLowerCase())}
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

                  {(currentQuestion.type === 'short-answer' ||
                    currentQuestion.type === 'essay' ||
                    currentQuestion.type === 'fill-blank') && (
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => handleAnswer(e.target.value)}
                      placeholder="Tuliskan jawaban Anda di sini…"
                      className="w-full p-3.5 sm:p-4 rounded-xl border border-input min-h-[140px] text-[15px] sm:text-[16px] leading-relaxed focus-visible:ring-2 focus-visible:ring-ring bg-card"
                    />
                  )}
                </div>

                {/* Desktop inline bottom actions */}
                <div className="hidden md:flex items-center justify-between mt-8 pt-5 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={goToPrevious}
                    disabled={currentQuestionIndex === 0}
                    className="touch-manipulation"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Sebelumnya
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {currentQuestionIndex + 1} dari {examQuestions.length}
                  </div>
                  <Button
                    onClick={goToNext}
                    disabled={currentQuestionIndex === examQuestions.length - 1}
                    className="touch-manipulation"
                  >
                    Selanjutnya
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
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
      </div>

      {/* Floating Bottom Sticky Bar for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-3 py-2 safe-area-pb shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            disabled={currentQuestionIndex === 0}
            className="flex-1 h-10 touch-manipulation text-xs font-medium"
          >
            <ChevronLeft className="w-4 h-4 mr-1 shrink-0" />
            Prev
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMobileNavigatorOpen(true)}
            className="h-10 px-3 touch-manipulation flex items-center gap-1.5"
            aria-label="Buka navigasi soal"
          >
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">
              {currentQuestionIndex + 1}/{examQuestions.length}
            </span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={goToNext}
            disabled={currentQuestionIndex === examQuestions.length - 1}
            className="flex-1 h-10 touch-manipulation text-xs font-medium"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1 shrink-0" />
          </Button>
        </div>
      </div>

      {/* Dialog Drawer / Sheet for Mobile Navigator */}
      <Dialog open={mobileNavigatorOpen} onOpenChange={setMobileNavigatorOpen}>
        <DialogContent className="max-w-md w-[92vw] sm:max-w-lg max-h-[85vh] flex flex-col p-4 sm:p-6 rounded-2xl">
          <DialogHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base sm:text-lg font-heading">Navigasi Semua Soal</DialogTitle>
              <Badge variant="outline" className="text-xs">
                {answeredCount}/{examQuestions.length} Terjawab
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Pilih nomor soal untuk langsung berpindah halaman.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            {questionGroups.map((group, gi) => (
              <div key={group.part?.id ?? `m-group-${gi}`} className="space-y-2">
                {examParts.length > 0 && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.part?.title ?? 'Tanpa bagian'}
                  </p>
                )}
                <div className="grid grid-cols-5 gap-2">
                  {group.items.map(({ q, i: index }) => {
                    const status = getQuestionStatus(q.id);
                    const isCurrent = index === currentQuestionIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          goToQuestion(index);
                          setMobileNavigatorOpen(false);
                        }}
                        className={cn(
                          'h-11 rounded-lg text-xs font-medium transition-all touch-manipulation flex flex-col items-center justify-center relative active:scale-95',
                          isCurrent && 'ring-2 ring-primary ring-offset-2 font-bold shadow-sm',
                          status === 'answered' && 'bg-emerald-600 text-white',
                          status === 'flagged' && 'bg-amber-500 text-white',
                          status === 'unanswered' && 'bg-muted text-foreground'
                        )}
                      >
                        <span>{index + 1}</span>
                        {flaggedQuestions.has(q.id) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white absolute top-1 right-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 shrink-0" />
                <span>Terjawab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0" />
                <span>Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-muted border shrink-0" />
                <span>Belum</span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border flex flex-row gap-2 justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileNavigatorOpen(false)}
              className="flex-1"
            >
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
              Kirim Ujian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit exam?</DialogTitle>
            <DialogDescription>
              You answered {answeredCount} of {examQuestions.length} questions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Continue
            </Button>
            <Button onClick={confirmSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
