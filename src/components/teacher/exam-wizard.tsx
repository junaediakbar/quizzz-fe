'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MathText } from '@/components/shared/math-text';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Plus,
  Search,
  GripVertical,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Loader2,
  Shield,
  Layers,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { QuestionStemWithImages } from '@/components/shared/question-image-display';
import { cn } from '@/lib/utils';
import { GRADE_OPTIONS, formatGradeLabel } from '@/lib/constants/grades';
import { Question, type ExamConfig } from '@/lib/types';
import { formatMaxViolationsLabel } from '@/lib/exam-security';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { useAuth } from '@/contexts/AuthContext';
import { questionsApi } from '@/lib/api/questions';
import { examsApi, type ExamPartRequest } from '@/lib/api/exams';
import { toast } from 'sonner';

type WizardStep = 'details' | 'questions' | 'settings' | 'review';

/**
 * Bagian (part) ujian di sisi editor. Ujian selalu punya minimal satu bagian;
 * bila judulnya kosong dan hanya ada satu bagian, ujian dikirim tanpa bagian.
 */
interface WizardPart {
  id: string;
  title: string;
  description: string;
  /** > 0 = timpa poin bank soal untuk semua soal di bagian ini */
  pointsPerQuestion: number;
  questions: Question[];
}

interface ExamWizardProps {
  examId?: string;
}

function newPartId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `part-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyPart(title = ''): WizardPart {
  return {
    id: newPartId(),
    title,
    description: '',
    pointsPerQuestion: 0,
    questions: [],
  };
}

/** Poin efektif sebuah soal di ujian ini (menghormati override poin per bagian). */
function pointsFor(part: WizardPart, q: Question): number {
  return part.pointsPerQuestion > 0 ? part.pointsPerQuestion : q.points;
}

export function ExamWizard({ examId }: ExamWizardProps) {
  const router = useRouter();
  const isEdit = Boolean(examId);
  const { user, isLoading: authLoading } = useAuth();
  const [loadingExam, setLoadingExam] = useState(isEdit);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);

  const [currentStep, setCurrentStep] = useState<WizardStep>('details');
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [parts, setParts] = useState<WizardPart[]>([emptyPart()]);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  /** Bagian tujuan saat menambah soal dari dialog */
  const [targetPartId, setTargetPartId] = useState<string>('');

  const [examConfig, setExamConfig] = useState<ExamConfig>({
    duration: 60,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResults: 'immediate',
    allowReview: true,
    maxAttempts: 1,
    passingScore: 70,
    securityEnabled: false,
    maxViolations: 3,
    requireFullscreen: false,
    blockCopyPaste: false,
    detectFocusLoss: false,
  });

  const steps: { id: WizardStep; label: string; description: string }[] = [
    { id: 'details', label: 'Exam Details', description: 'Basic information' },
    { id: 'questions', label: 'Add Questions', description: 'Select from bank' },
    { id: 'settings', label: 'Configure', description: 'Set preferences' },
    { id: 'review', label: 'Review', description: isEdit ? 'Konfirmasi & simpan' : 'Konfirmasi & publikasikan' },
  ];

  const stepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((stepIndex + 1) / steps.length) * 100;

  /** Base UI mencetak nilai mentah tanpa `items`; lihat catatan di select.tsx usage. */
  const partItems = useMemo(
    () =>
      Object.fromEntries(
        parts.map((p, i) => [
          p.id,
          p.title.trim() || `Bagian ${String.fromCharCode(65 + (i % 26))}`,
        ])
      ),
    [parts]
  );
  const gradeItems = useMemo(
    () => Object.fromEntries(GRADE_OPTIONS.map((g) => [g.value, g.label])),
    []
  );
  const attemptItems = useMemo(
    () => ({ '1': '1 attempt', '2': '2 attempts', '3': '3 attempts', '0': 'Unlimited' }),
    []
  );
  const showResultsItems = useMemo(
    () => ({
      immediate: 'Immediately after submission',
      'after-review': 'After teacher review',
      manual: 'Manual release',
    }),
    []
  );
  const maxViolationsItems = useMemo(
    () => ({
      '0': 'Tidak mengunci otomatis (hanya peringatan)',
      '1': '1 pelanggaran → sesi berakhir',
      '2': '2 pelanggaran → sesi berakhir',
      '3': '3 pelanggaran → sesi berakhir',
      '5': '5 pelanggaran → sesi berakhir',
      '10': '10 pelanggaran → sesi berakhir',
    }),
    []
  );

  const selectedQuestions = useMemo(
    () => parts.flatMap((p) => p.questions),
    [parts]
  );
  const totalPoints = useMemo(
    () => parts.reduce((sum, p) => sum + p.questions.reduce((s, q) => s + pointsFor(p, q), 0), 0),
    [parts]
  );

  const loadBank = useCallback(async () => {
    if (!user?.id || (user.role !== 'teacher' && user.role !== 'admin')) {
      setBankQuestions([]);
      setLoadingQuestions(false);
      return;
    }
    setLoadingQuestions(true);
    try {
      const res = await questionsApi.list({
        ...(user.role === 'teacher' ? { created_by: user.id } : {}),
      });
      setBankQuestions(res.questions);
    } catch {
      toast.error('Gagal memuat bank soal');
      setBankQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!authLoading && user?.id) loadBank();
  }, [authLoading, user?.id, loadBank]);

  // Pre-select questions passed via ?question_ids= (e.g. "Simpan & Buat Ujian"
  // from the Question Bank page jumps here with the freshly added question).
  const preselectApplied = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (preselectApplied.current || bankQuestions.length === 0) return;
    const qids = new URLSearchParams(window.location.search).get('question_ids');
    if (!qids) return;
    const ids = qids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return;
    const matched = ids
      .map((id) => bankQuestions.find((q) => q.id === id))
      .filter((q): q is Question => !!q);
    if (matched.length) {
      setParts((prev) => {
        const next = prev.length ? [...prev] : [emptyPart()];
        next[0] = { ...next[0], questions: [...next[0].questions, ...matched] };
        return next;
      });
      preselectApplied.current = true;
    }
  }, [bankQuestions]);

  useEffect(() => {
    if (!examId || authLoading) return;
    let cancelled = false;
    (async () => {
      setLoadingExam(true);
      try {
        const exam = await examsApi.get(examId);
        if (cancelled) return;
        setExamTitle(exam.title);
        setExamDescription(exam.description ?? '');
        setSubject(exam.subject);
        setGrade(exam.grade);
        setExamConfig(exam.config);

        // Kelompokkan soal ke bagiannya; ujian tanpa parts → satu bagian implisit.
        const examParts = exam.parts ?? [];
        if (examParts.length === 0) {
          setParts([{ ...emptyPart(), questions: exam.questions }]);
        } else {
          const grouped: WizardPart[] = examParts
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description ?? '',
              pointsPerQuestion: 0,
              questions: exam.questions.filter((q) => q.partId === p.id),
            }));
          const orphans = exam.questions.filter(
            (q) => !q.partId || !examParts.some((p) => p.id === q.partId)
          );
          if (orphans.length > 0) {
            grouped.push({ ...emptyPart('Tanpa bagian'), questions: orphans });
          }
          setParts(grouped.length > 0 ? grouped : [emptyPart()]);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Gagal memuat ujian');
          router.push('/teacher/exams');
        }
      } finally {
        if (!cancelled) setLoadingExam(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, authLoading, router]);

  const availableQuestions = bankQuestions.filter(
    (q) =>
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isQuestionSelected = (id: string) =>
    parts.some((p) => p.questions.some((q) => q.id === id));

  /** Bagian tujuan dialog: pilihan user, atau bagian terakhir. */
  const dialogTargetPart =
    parts.find((p) => p.id === targetPartId) ?? parts[parts.length - 1] ?? parts[0];

  const toggleQuestion = (question: Question) => {
    if (isQuestionSelected(question.id)) {
      setParts((prev) =>
        prev.map((p) => ({
          ...p,
          questions: p.questions.filter((q) => q.id !== question.id),
        }))
      );
      return;
    }
    const partId = dialogTargetPart?.id;
    setParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, questions: [...p.questions, question] } : p))
    );
  };

  const removeQuestion = (id: string) => {
    setParts((prev) =>
      prev.map((p) => ({ ...p, questions: p.questions.filter((q) => q.id !== id) }))
    );
  };

  const moveQuestion = (partId: string, id: string, dir: -1 | 1) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== partId) return p;
        const i = p.questions.findIndex((q) => q.id === id);
        if (i < 0) return p;
        const j = i + dir;
        if (j < 0 || j >= p.questions.length) return p;
        const next = [...p.questions];
        [next[i], next[j]] = [next[j], next[i]];
        return { ...p, questions: next };
      })
    );
  };

  const moveQuestionToPart = (fromPartId: string, questionId: string, toPartId: string) => {
    if (fromPartId === toPartId) return;
    setParts((prev) => {
      const src = prev.find((p) => p.id === fromPartId);
      const question = src?.questions.find((q) => q.id === questionId);
      if (!question) return prev;
      return prev.map((p) => {
        if (p.id === fromPartId) {
          return { ...p, questions: p.questions.filter((q) => q.id !== questionId) };
        }
        if (p.id === toPartId) {
          return { ...p, questions: [...p.questions, question] };
        }
        return p;
      });
    });
  };

  const reverseQuestionOrder = () => {
    setParts((prev) => prev.map((p) => ({ ...p, questions: [...p.questions].reverse() })));
  };

  const addPart = (title = '') => {
    const p = emptyPart(title);
    setParts((prev) => [...prev, p]);
    setTargetPartId(p.id);
  };

  const removePart = (partId: string) => {
    setParts((prev) => {
      if (prev.length <= 1) {
        // Jangan hapus bagian terakhir — kosongkan saja.
        return prev.map((p) => (p.id === partId ? { ...p, questions: [], title: '' } : p));
      }
      return prev.filter((p) => p.id !== partId);
    });
  };

  const updatePart = (partId: string, patch: Partial<WizardPart>) => {
    setParts((prev) => prev.map((p) => (p.id === partId ? { ...p, ...patch } : p)));
  };

  const nextStep = () => {
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id);
    }
  };

  const prevStep = () => {
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  };

  /** Bagian yang benar-benar dipakai (ada soal). */
  const usedParts = parts.filter((p) => p.questions.length > 0);
  /** Ujian dianggap "punya bagian" bila >1 bagian berisi soal atau judulnya diisi. */
  const hasNamedParts =
    usedParts.length > 1 || (usedParts.length === 1 && usedParts[0].title.trim() !== '');

  const buildPartsPayload = (): ExamPartRequest[] =>
    usedParts.map((p, i) => ({
      title: p.title.trim() || `Bagian ${i + 1}`,
      description: p.description.trim() || undefined,
      question_ids: p.questions.map((q) => q.id),
      ...(p.pointsPerQuestion > 0 ? { points_per_question: p.pointsPerQuestion } : {}),
    }));

  const handleSubmit = async () => {
    if (!examTitle.trim() || !subject.trim() || !grade.trim()) {
      toast.error('Judul, subject, dan kelas wajib diisi');
      return;
    }
    if (selectedQuestions.length === 0) {
      toast.error('Pilih minimal satu soal');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: examTitle.trim(),
        description: examDescription.trim() || undefined,
        subject: subject.trim(),
        grade: grade.trim(),
        config: examConfig,
        ...(hasNamedParts
          ? { parts: buildPartsPayload() }
          : { question_ids: selectedQuestions.map((q) => q.id) }),
      };
      if (isEdit && examId) {
        await examsApi.update(examId, payload);
        toast.success('Ujian berhasil diperbarui');
        router.push('/teacher/exams');
      } else {
        const exam = await examsApi.create(payload);
        await examsApi.publish(exam.id);
        toast.success('Ujian dibuat dan dipublikasikan');
        router.push('/teacher/dashboard');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan ujian');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      'multiple-choice': { label: 'MCQ', className: 'bg-blue-500/10 text-blue-500' },
      'true-false': { label: 'T/F', className: 'bg-green-500/10 text-green-500' },
      'short-answer': { label: 'Short', className: 'bg-purple-500/10 text-purple-500' },
      essay: { label: 'Essay', className: 'bg-orange-500/10 text-orange-500' },
      matching: { label: 'Match', className: 'bg-pink-500/10 text-pink-500' },
      'fill-blank': { label: 'Fill', className: 'bg-cyan-500/10 text-cyan-500' },
      'step-by-step': { label: 'Steps', className: 'bg-indigo-500/10 text-indigo-500' },
    };
    const variant = variants[type] || variants['multiple-choice'];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (authLoading || loadingExam) {
    return (
      <TeacherNav>
        <div className="flex flex-1 items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </TeacherNav>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <TeacherNav>
        <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
          Hanya guru atau admin yang dapat membuat ujian.
        </div>
      </TeacherNav>
    );
  }

  return (
    <TeacherNav>
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center px-6">
          <h1 className="text-xl font-semibold">
            {isEdit ? 'Edit Ujian' : 'Buat Ujian Baru'}
          </h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Step Progress */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {steps.map((step, i) => (
                      <div key={step.id} className="flex items-center">
                        <button
                          onClick={() => setCurrentStep(step.id)}
                          className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                            i <= stepIndex
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {i < stepIndex ? <Check className="w-4 h-4" /> : i + 1}
                        </button>
                        {i < steps.length - 1 && (
                          <div className={cn(
                            'w-12 h-0.5 mx-2',
                            i < stepIndex ? 'bg-primary' : 'bg-muted'
                          )} />
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Step {stepIndex + 1} of {steps.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        'text-center flex-1',
                        step.id === currentStep ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      <p className="text-xs font-medium">{step.label}</p>
                      <p className="text-xs">{step.description}</p>
                    </div>
                  ))}
                </div>

                <Progress value={progress} className="mt-4 h-2" />
              </CardContent>
            </Card>

            {/* Step Content */}
            {currentStep === 'details' && (
              <Card>
                <CardHeader>
                  <CardTitle>Exam Details</CardTitle>
                  <CardDescription>Provide basic information about your exam</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Exam Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Biology Midterm Exam"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief overview of what this exam covers..."
                      value={examDescription}
                      onChange={(e) => setExamDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                        id="subject"
                        list="exam-subject-options"
                        placeholder="Matematika / IPAS / …"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                      <datalist id="exam-subject-options">
                        <option value="Matematika" />
                        <option value="IPAS" />
                        <option value="Bahasa Indonesia" />
                        <option value="IPA" />
                        <option value="IPS" />
                        <option value="PPKn" />
                        <option value="Bahasa Inggris" />
                        <option value="Mathematics" />
                        <option value="Biology" />
                        <option value="Physics" />
                        <option value="Chemistry" />
                        <option value="History" />
                      </datalist>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="grade">Kelas *</Label>
                      <Select items={gradeItems} value={grade} onValueChange={(value) => setGrade(value ?? '')}>
                        <SelectTrigger id="grade">
                          <SelectValue placeholder="Pilih kelas (1–12)" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADE_OPTIONS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 'questions' && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Add Questions</CardTitle>
                      <CardDescription>
                        {selectedQuestions.length} soal dipilih • {totalPoints} poin •{' '}
                        {usedParts.length > 1 ? `${usedParts.length} bagian soal` : 'tanpa bagian'} (urutan bisa diubah)
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedQuestions.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={reverseQuestionOrder}
                          className="gap-2"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                          Balik urutan
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => addPart()} className="gap-2">
                        <Layers className="w-4 h-4" />
                        Tambah bagian
                      </Button>
                      <Button
                        onClick={() => {
                          setTargetPartId(parts[parts.length - 1]?.id ?? '');
                          setIsQuestionDialogOpen(true);
                        }}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Questions
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-xs text-muted-foreground">
                    Bagi ujian menjadi beberapa bagian (mis. <strong>Bagian A — Pilihan Ganda</strong>,{' '}
                    <strong>Bagian B — Uraian</strong>). Setiap bagian bisa punya instruksi sendiri dan poin
                    per soal tersendiri. Biarkan judul bagian kosong bila ujian tidak perlu dibagi.
                  </p>

                  {parts.map((part, partIndex) => (
                    <div key={part.id} className="rounded-xl border border-border p-4 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">
                            Bagian {String.fromCharCode(65 + (partIndex % 26))}
                          </span>
                          <Badge variant="outline">{part.questions.length} soal</Badge>
                          <Badge variant="outline">
                            {part.questions.reduce((s, q) => s + pointsFor(part, q), 0)} poin
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removePart(part.id)}
                          disabled={parts.length === 1 && part.questions.length === 0}
                          title="Hapus bagian"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                        <div className="space-y-1">
                          <Label className="text-xs">Judul bagian (opsional)</Label>
                          <Input
                            value={part.title}
                            placeholder={`Bagian ${String.fromCharCode(65 + (partIndex % 26))} — Pilihan Ganda`}
                            onChange={(e) => updatePart(part.id, { title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Poin per soal (opsional)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={part.pointsPerQuestion || ''}
                            placeholder="Poin bank soal"
                            onChange={(e) =>
                              updatePart(part.id, {
                                pointsPerQuestion: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Instruksi bagian (opsional)</Label>
                        <Input
                          value={part.description}
                          placeholder="Pilihlah jawaban yang paling tepat!"
                          onChange={(e) => updatePart(part.id, { description: e.target.value })}
                        />
                      </div>

                      {part.questions.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                          Belum ada soal di bagian ini.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {part.questions.map((question, index) => (
                            <div
                              key={question.id}
                              className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2 pt-0.5">
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <Badge variant="outline">Q{index + 1}</Badge>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">{question.title}</h4>
                                  {getTypeBadge(question.type)}
                                  <Badge variant="outline" className="capitalize">
                                    {question.difficulty}
                                  </Badge>
                                  <Badge variant="outline">
                                    {pointsFor(part, question)} pts
                                  </Badge>
                                </div>
                                <MathText className="text-sm text-muted-foreground truncate block">
                                  {question.content}
                                </MathText>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                {parts.length > 1 && (
                                  <Select
                                    items={partItems}
                                    value={part.id}
                                    onValueChange={(v) =>
                                      moveQuestionToPart(part.id, question.id, String(v))
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-[130px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {parts.map((p, i) => (
                                        <SelectItem key={p.id} value={p.id}>
                                          {p.title.trim() || `Bagian ${String.fromCharCode(65 + (i % 26))}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Naik"
                                  disabled={index === 0}
                                  onClick={() => moveQuestion(part.id, question.id, -1)}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Turun"
                                  disabled={index === part.questions.length - 1}
                                  onClick={() => moveQuestion(part.id, question.id, 1)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeQuestion(question.id)}
                                  title="Hapus dari ujian"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {selectedQuestions.length === 0 && (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Belum ada soal di ujian ini</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 'settings' && (
              <Card>
                <CardHeader>
                  <CardTitle>Exam Settings</CardTitle>
                  <CardDescription>Configure how the exam will be administered</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes) *</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={examConfig.duration}
                        onChange={(e) => setExamConfig({ ...examConfig, duration: parseInt(e.target.value) || 60 })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="attempts">Max Attempts</Label>
                      <Select
                        items={attemptItems}
                        value={String(examConfig.maxAttempts)}
                        onValueChange={(v) =>
                          setExamConfig({ ...examConfig, maxAttempts: Number(v ?? '1') || 0 })
                        }
                      >
                        <SelectTrigger id="attempts">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 attempt</SelectItem>
                          <SelectItem value="2">2 attempts</SelectItem>
                          <SelectItem value="3">3 attempts</SelectItem>
                          <SelectItem value="0">Unlimited</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        &ldquo;Unlimited&rdquo; = murid boleh mengulang ujian tanpa batas.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passing">Passing Score (%) *</Label>
                      <Input
                        id="passing"
                        type="number"
                        min="0"
                        max="100"
                        value={examConfig.passingScore}
                        onChange={(e) => setExamConfig({ ...examConfig, passingScore: parseInt(e.target.value) || 70 })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="showResults">Show Results</Label>
                      <Select
                        items={showResultsItems}
                        value={examConfig.showResults}
                        onValueChange={(v) => setExamConfig({ ...examConfig, showResults: (v ?? 'after-review') as 'immediate' | 'after-review' | 'manual' })}
                      >
                        <SelectTrigger id="showResults">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediately after submission</SelectItem>
                          <SelectItem value="after-review">After teacher review</SelectItem>
                          <SelectItem value="manual">Manual release</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium">Question Options</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Shuffle Questions</p>
                          <p className="text-sm text-muted-foreground">
                            Randomize question order (soal diacak di dalam bagiannya)
                          </p>
                        </div>
                        <Checkbox
                          checked={examConfig.shuffleQuestions}
                          onCheckedChange={(v) => setExamConfig({ ...examConfig, shuffleQuestions: !!v })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Shuffle Options</p>
                          <p className="text-sm text-muted-foreground">Randomize answer choices for each student</p>
                        </div>
                        <Checkbox
                          checked={examConfig.shuffleOptions}
                          onCheckedChange={(v) => setExamConfig({ ...examConfig, shuffleOptions: !!v })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Allow Review</p>
                          <p className="text-sm text-muted-foreground">Students can review their submitted answers</p>
                        </div>
                        <Checkbox
                          checked={examConfig.allowReview}
                          onCheckedChange={(v) => setExamConfig({ ...examConfig, allowReview: !!v })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <h3 className="font-medium">Keamanan & Proctoring</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Atur mode ketat saat siswa mengerjakan ujian, atau nonaktifkan untuk ujian latihan.
                    </p>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Aktifkan keamanan</p>
                        <p className="text-sm text-muted-foreground">
                          Nonaktifkan untuk ujian tanpa fullscreen, tanpa deteksi tab, dll.
                        </p>
                      </div>
                      <Switch
                        checked={examConfig.securityEnabled}
                        onCheckedChange={(v) =>
                          setExamConfig({
                            ...examConfig,
                            securityEnabled: v,
                            ...(v && examConfig.maxViolations === 0
                              ? { maxViolations: 3 }
                              : {}),
                          })
                        }
                      />
                    </div>

                    {examConfig.securityEnabled && (
                      <div className="space-y-3 rounded-lg border border-dashed p-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxViolations">Toleransi pelanggaran</Label>
                          <Select
                            items={maxViolationsItems}
                            value={String(examConfig.maxViolations)}
                            onValueChange={(v) =>
                              setExamConfig({
                                ...examConfig,
                                maxViolations: parseInt(v ?? '3', 10),
                              })
                            }
                          >
                            <SelectTrigger id="maxViolations">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Tidak mengunci otomatis (hanya peringatan)</SelectItem>
                              <SelectItem value="1">1 pelanggaran → sesi berakhir</SelectItem>
                              <SelectItem value="2">2 pelanggaran → sesi berakhir</SelectItem>
                              <SelectItem value="3">3 pelanggaran → sesi berakhir</SelectItem>
                              <SelectItem value="5">5 pelanggaran → sesi berakhir</SelectItem>
                              <SelectItem value="10">10 pelanggaran → sesi berakhir</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Pindah tab, keluar fullscreen, dll. dihitung sebagai pelanggaran.
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Wajib fullscreen</p>
                            <p className="text-sm text-muted-foreground">
                              Siswa harus fullscreen sebelum mulai
                            </p>
                          </div>
                          <Switch
                            checked={examConfig.requireFullscreen}
                            onCheckedChange={(v) =>
                              setExamConfig({ ...examConfig, requireFullscreen: v })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Deteksi pindah tab / jendela</p>
                            <p className="text-sm text-muted-foreground">
                              Mencatat saat siswa meninggalkan halaman ujian
                            </p>
                          </div>
                          <Switch
                            checked={examConfig.detectFocusLoss}
                            onCheckedChange={(v) =>
                              setExamConfig({ ...examConfig, detectFocusLoss: v })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Blokir salin / tempel</p>
                            <p className="text-sm text-muted-foreground">
                              Menonaktifkan copy, paste, dan klik kanan
                            </p>
                          </div>
                          <Switch
                            checked={examConfig.blockCopyPaste}
                            onCheckedChange={(v) =>
                              setExamConfig({ ...examConfig, blockCopyPaste: v })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 'review' && (
              <Card>
                <CardHeader>
                  <CardTitle>{isEdit ? 'Review & Simpan' : 'Review & Publish'}</CardTitle>
                  <CardDescription>
                    {isEdit ? 'Periksa perubahan sebelum menyimpan' : 'Review your exam before publishing'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium mb-3">Exam Details</h3>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Title:</dt>
                          <dd className="font-medium">{examTitle || 'Untitled Exam'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Subject:</dt>
                          <dd className="font-medium">{subject || 'Not set'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Kelas:</dt>
                          <dd className="font-medium">{formatGradeLabel(grade) || 'Belum dipilih'}</dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <h3 className="font-medium mb-3">Settings</h3>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Duration:</dt>
                          <dd className="font-medium">{examConfig.duration} minutes</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Questions:</dt>
                          <dd className="font-medium">{selectedQuestions.length}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Total Points:</dt>
                          <dd className="font-medium">{totalPoints}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Passing Score:</dt>
                          <dd className="font-medium">{examConfig.passingScore}%</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Max Attempts:</dt>
                          <dd className="font-medium">
                            {examConfig.maxAttempts > 0 ? examConfig.maxAttempts : 'Unlimited'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Keamanan:</dt>
                          <dd className="font-medium text-right">
                            {examConfig.securityEnabled
                              ? formatMaxViolationsLabel(examConfig.maxViolations)
                              : 'Nonaktif'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-3">Questions Preview</h3>
                    <div className="space-y-4 max-h-72 overflow-y-auto">
                      {usedParts.map((part, pi) => (
                        <div key={part.id} className="space-y-3">
                          {usedParts.length > 1 || part.title.trim() ? (
                            <div className="rounded-lg bg-primary/5 px-3 py-2">
                              <p className="text-sm font-semibold">
                                {part.title.trim() || `Bagian ${pi + 1}`}
                              </p>
                              {part.description.trim() ? (
                                <p className="text-xs text-muted-foreground">{part.description}</p>
                              ) : null}
                            </div>
                          ) : null}
                          {part.questions.map((q, i) => (
                            <div key={q.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline">Q{i + 1}</Badge>
                                <MathText className="font-medium">{q.title}</MathText>
                                <Badge variant="secondary" className="ml-auto">
                                  {pointsFor(part, q)} pts
                                </Badge>
                              </div>
                              <QuestionStemWithImages
                                content={q.content}
                                images={q.images}
                                imageUrls={q.imageUrls}
                                contentClassName="text-muted-foreground mb-2"
                              />
                              {q.type === 'multiple-choice' && q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-2 gap-1 ml-1">
                                  {q.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2 text-xs">
                                      <span className="text-muted-foreground shrink-0">
                                        {String.fromCharCode(65 + optIdx)}.
                                      </span>
                                      <MathText className="min-w-0">{opt}</MathText>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={stepIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {stepIndex < steps.length - 1 ? (
                <Button onClick={nextStep}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button size="lg" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  {isEdit ? 'Simpan Perubahan' : 'Publish Exam'}
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add Questions Dialog */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Questions from Bank</DialogTitle>
            <DialogDescription>Select questions to add to your exam</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Tambah ke:</span>
                <Select
                  items={partItems}
                  value={dialogTargetPart?.id ?? ''}
                  onValueChange={(v) => setTargetPartId(String(v))}
                >
                  <SelectTrigger className="w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parts.map((p, i) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title.trim() || `Bagian ${String.fromCharCode(65 + (i % 26))}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingQuestions ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {availableQuestions.map((question) => {
                    const isSelected = isQuestionSelected(question.id);
                    return (
                      <div
                        key={question.id}
                        onClick={() => toggleQuestion(question)}
                        className={cn(
                          'flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors',
                          isSelected && 'bg-primary/10 border-primary'
                        )}
                      >
                        <Checkbox checked={isSelected} readOnly />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{question.title}</h4>
                            {getTypeBadge(question.type)}
                            <Badge variant="outline" className="capitalize">
                              {question.difficulty}
                            </Badge>
                          </div>
                          <MathText className="text-sm text-muted-foreground truncate block">
                            {question.content}
                          </MathText>
                        </div>
                        <Badge variant="outline">{question.points} pts</Badge>
                      </div>
                    );
                  })}
                  {availableQuestions.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Belum ada soal di bank. Tambahkan di Question Bank.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsQuestionDialogOpen(false)}>
              Add Selected ({selectedQuestions.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeacherNav>
  );
}
