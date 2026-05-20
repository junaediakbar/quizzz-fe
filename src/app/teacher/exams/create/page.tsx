'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Eye,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GRADE_OPTIONS, formatGradeLabel } from '@/lib/constants/grades';
import { Question } from '@/lib/types';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { useAuth } from '@/contexts/AuthContext';
import { questionsApi } from '@/lib/api/questions';
import { examsApi } from '@/lib/api/exams';
import { toast } from 'sonner';

type WizardStep = 'details' | 'questions' | 'settings' | 'review';

export default function CreateExamWizardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);

  const [currentStep, setCurrentStep] = useState<WizardStep>('details');
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [examConfig, setExamConfig] = useState<{
    duration: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: 'immediate' | 'after-review' | 'manual';
    allowReview: boolean;
    maxAttempts: number;
    passingScore: number;
  }>({
    duration: 60,
    shuffleQuestions: false,
    shuffleOptions: true,
    showResults: 'after-review',
    allowReview: true,
    maxAttempts: 1,
    passingScore: 70,
  });

  const steps: { id: WizardStep; label: string; description: string }[] = [
    { id: 'details', label: 'Exam Details', description: 'Basic information' },
    { id: 'questions', label: 'Add Questions', description: 'Select from bank' },
    { id: 'settings', label: 'Configure', description: 'Set preferences' },
    { id: 'review', label: 'Review', description: 'Confirm & publish' },
  ];

  const stepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((stepIndex + 1) / steps.length) * 100;

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

  const availableQuestions = bankQuestions.filter(
    (q) =>
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPoints = selectedQuestions.reduce((sum, q) => sum + q.points, 0);

  const toggleQuestion = (question: Question) => {
    setSelectedQuestions(prev => {
      const exists = prev.find(q => q.id === question.id);
      if (exists) {
        return prev.filter(q => q.id !== question.id);
      }
      return [...prev, question];
    });
  };

  const removeQuestion = (id: string) => {
    setSelectedQuestions(prev => prev.filter(q => q.id !== id));
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

  const handlePublish = async () => {
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
      const exam = await examsApi.create({
        title: examTitle.trim(),
        description: examDescription.trim() || undefined,
        subject: subject.trim(),
        grade: grade.trim(),
        config: examConfig,
        question_ids: selectedQuestions.map((q) => q.id),
      });
      await examsApi.publish(exam.id);
      toast.success('Ujian dibuat dan dipublikasikan');
      router.push('/teacher/dashboard');
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
    };
    const variant = variants[type] || variants['multiple-choice'];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (authLoading) {
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
          <h1 className="text-xl font-semibold">Create New Exam</h1>
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
                      <Select value={subject} onValueChange={(value) => setSubject(value ?? '')}>
                        <SelectTrigger id="subject">
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="math">Mathematics</SelectItem>
                          <SelectItem value="biology">Biology</SelectItem>
                          <SelectItem value="chemistry">Chemistry</SelectItem>
                          <SelectItem value="physics">Physics</SelectItem>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="history">History</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="grade">Kelas *</Label>
                      <Select value={grade} onValueChange={(value) => setGrade(value ?? '')}>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Add Questions</CardTitle>
                      <CardDescription>
                        {selectedQuestions.length} questions selected • {totalPoints} total points
                      </CardDescription>
                    </div>
                    <Button onClick={() => setIsQuestionDialogOpen(true)} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Add Questions
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedQuestions.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No questions added yet</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setIsQuestionDialogOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Question
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                            <Badge variant="outline">Q{index + 1}</Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{question.title}</h4>
                              {getTypeBadge(question.type)}
                              <Badge variant="outline" className="capitalize">
                                {question.difficulty}
                              </Badge>
                              <Badge variant="outline">{question.points} pts</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{question.content}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeQuestion(question.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
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
                        value={examConfig.maxAttempts.toString()}
                        onValueChange={(v) => setExamConfig({ ...examConfig, maxAttempts: parseInt(v ?? '1') })}
                      >
                        <SelectTrigger id="attempts">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 attempt</SelectItem>
                          <SelectItem value="2">2 attempts</SelectItem>
                          <SelectItem value="3">3 attempts</SelectItem>
                          <SelectItem value="unlimited">Unlimited</SelectItem>
                        </SelectContent>
                      </Select>
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
                          <p className="text-sm text-muted-foreground">Randomize question order for each student</p>
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
                </CardContent>
              </Card>
            )}

            {currentStep === 'review' && (
              <Card>
                <CardHeader>
                  <CardTitle>Review & Publish</CardTitle>
                  <CardDescription>Review your exam before publishing</CardDescription>
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
                      </dl>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-3">Questions Preview</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedQuestions.map((q, i) => (
                        <div key={q.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline">Q{i + 1}</Badge>
                            <span className="font-medium">{q.title}</span>
                            <Badge variant="secondary" className="ml-auto">{q.points} pts</Badge>
                          </div>
                          <p className="text-muted-foreground mb-2">{q.content}</p>
                          {q.type === 'multiple-choice' && q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-2 gap-1 ml-1">
                              {q.options.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">{String.fromCharCode(65 + optIdx)}.</span>
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}
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
                <Button size="lg" onClick={handlePublish} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Publish Exam
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
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
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
                    const isSelected = selectedQuestions.some((q) => q.id === question.id);
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
                          <p className="text-sm text-muted-foreground truncate">{question.content}</p>
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
