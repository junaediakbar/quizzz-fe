'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Shield,
  WifiOff,
  Wifi,
} from 'lucide-react';
import { cn, formatCountdown, clampSeconds } from '@/lib/utils';
import { Question } from '@/lib/types';
import { examsApi, sessionsApi } from '@/lib/api';
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
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      toast.error('Fullscreen is required to start this exam. Please allow fullscreen.');
      return;
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
      setDurationMin(s.duration || durationMin);
      if (s.answers && typeof s.answers === 'object') {
        setAnswers((prev) => ({ ...prev, ...s.answers }));
      }
      const startMs = new Date(s.started_at).getTime();
      const durationSec = (s.duration || 60) * 60;
      const endMs =
        Number.isFinite(startMs) ? startMs + durationSec * 1000 : Date.now() + durationSec * 1000;
      const remain = clampSeconds(Math.floor((endMs - Date.now()) / 1000));
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
      setViolationCount((c) => {
        const n = c + 1;
        void logEvent('focus_loss', { reason, count: n });
        if (n >= 3) {
          void finalizeLock(n);
        } else {
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 10000);
          toast.warning(`Integrity warning ${n}/3: ${reason}`);
        }
        return n;
      });
    },
    [logEvent, finalizeLock]
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
    if (phase !== 'active') return;
    const onVis = () => {
      const hidden = document.hidden;
      setPageHidden(hidden);
      if (hidden) void recordViolation('tab_or_window_hidden');
    };
    document.addEventListener('visibilitychange', onVis);
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && phase === 'active') void recordViolation('fullscreen_exit');
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [phase, recordViolation]);

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
    if (phase !== 'active') return;
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
  }, [phase]);

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
      const { result_id } = await sessionsApi.submitExam(sessionId);
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
                <p className="text-sm text-muted-foreground">Secure examination mode</p>
              </div>
            </div>
            <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-5">
              <li>Timer starts only after you enter fullscreen.</li>
              <li>Switching tabs, minimizing, or leaving fullscreen counts as a violation (3 = session ends).</li>
              <li>Copy, paste, and right-click are disabled during the exam.</li>
              <li>Answers are saved locally every 10s and synced when online (PRD §3.5).</li>
            </ul>
            <div className="flex flex-wrap gap-4 text-sm border-t border-border pt-4">
              <span>
                <strong className="text-foreground">Duration:</strong> {durationMin} min
              </span>
              <span>
                <strong className="text-foreground">Questions:</strong> {questionCount || '—'}
              </span>
            </div>
            <Button
              className="w-full h-12 text-base"
              onClick={beginExam}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Enter fullscreen & begin exam'}
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

      {showWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 p-4">
          <Alert className="max-w-md mx-auto border-amber-500 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Integrity warning</AlertTitle>
            <AlertDescription className="text-amber-900">
              Focus loss recorded ({violationCount}/3). Further violations may end this exam.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-semibold text-lg">{examTitle}</h1>
            <p className="text-xs text-muted-foreground">ExamPro AI · Protected session</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className={cn('flex items-center gap-2 font-mono text-lg font-semibold', getTimeColor())}>
              <Clock className="w-5 h-5" />
              {formatCountdown(timeRemaining)}
            </div>
            <div className="hidden sm:block w-40">
              <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                <span>Progress</span>
                <span>
                  {answeredCount}/{examQuestions.length}
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
            <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-2">
              {isFullscreen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Focus
            </Button>
            <Button size="sm" onClick={handleSubmit} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Submit
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        <aside className="hidden lg:block w-56 shrink-0 space-y-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <h3 className="font-heading text-sm font-semibold mb-3">Navigator</h3>
              <div className="grid grid-cols-5 gap-1.5">
                {examQuestions.map((q, index) => {
                  const status = getQuestionStatus(q.id);
                  const isCurrent = index === currentQuestionIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goToQuestion(index)}
                      className={cn(
                        'w-9 h-9 rounded text-xs font-medium transition-colors',
                        isCurrent && 'ring-2 ring-primary ring-offset-2',
                        status === 'answered' && 'bg-emerald-600 text-white',
                        status === 'flagged' && 'bg-amber-500 text-white',
                        status === 'unanswered' && 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="flex-1 min-w-0">
          <div
            className={cn(
              'transition-[filter] duration-300',
              pageHidden && 'blur-md pointer-events-none select-none'
            )}
          >
            <Card className="border-border border-t-[3px] border-t-primary shadow-sm">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-base px-2.5 py-0.5 font-heading">
                      Q{currentQuestionIndex + 1}
                    </Badge>
                    <Badge variant="secondary">{currentQuestion.points} pts</Badge>
                    <Badge variant="outline" className="capitalize">
                      {currentQuestion.difficulty}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFlag}
                    className={cn(
                      flaggedQuestions.has(currentQuestion.id) &&
                        'bg-amber-500/10 border-amber-500/50 text-amber-900'
                    )}
                  >
                    <Flag className="w-4 h-4 mr-1" />
                    Flag
                  </Button>
                </div>

                <div className="mb-8">
                  <h2 className="text-lg md:text-[18px] font-medium leading-relaxed mb-3 font-heading">
                    {currentQuestion.title}
                  </h2>
                  <p className="text-[16px] md:text-[18px] leading-relaxed text-muted-foreground">
                    {currentQuestion.content}
                  </p>
                  {currentQuestion.imageUrls && currentQuestion.imageUrls.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {currentQuestion.imageUrls.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="max-w-full h-auto rounded-lg border border-border shadow-sm"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                    <div className="space-y-2">
                      {currentQuestion.options.map((option, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleAnswer(option)}
                          className={cn(
                            'w-full text-left p-4 rounded-lg border text-[15px] md:text-[16px] transition-colors',
                            currentAnswer === option
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          )}
                        >
                          <span className="font-medium text-primary mr-2">
                            {String.fromCharCode(65 + index)}.
                          </span>
                          {option}
                        </button>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'true-false' && (
                    <div className="flex gap-3">
                      {['True', 'False'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleAnswer(option.toLowerCase())}
                          className={cn(
                            'flex-1 p-5 rounded-lg border-2 font-medium',
                            currentAnswer === option.toLowerCase()
                              ? 'border-primary bg-primary/5'
                              : 'border-border'
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}

                  {(currentQuestion.type === 'short-answer' ||
                    currentQuestion.type === 'essay' ||
                    currentQuestion.type === 'fill-blank') && (
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => handleAnswer(e.target.value)}
                      placeholder="Your answer…"
                      className="w-full p-4 rounded-lg border border-input min-h-[140px] text-[16px] leading-relaxed focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={goToPrevious}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button onClick={goToNext} disabled={currentQuestionIndex === examQuestions.length - 1}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          {pageHidden && (
            <p className="text-center text-sm text-amber-700 mt-4 font-medium">
              Content hidden — return to this tab to continue.
            </p>
          )}
        </main>
      </div>

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
