'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FolderKanban,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  FolderOpen,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Question, QuestionBank, QuestionType } from '@/lib/types';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { useAuth } from '@/contexts/AuthContext';
import { questionsApi, CreateQuestionRequest } from '@/lib/api/questions';
import { mediaApi } from '@/lib/api/media';
import { questionBanksApi } from '@/lib/api/question-banks';
import { downloadBlobGet } from '@/lib/api/client';
import { toast } from 'sonner';

export default function QuestionBankPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedBank, setSelectedBank] = useState<string>('all');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [bankCounts, setBankCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newQ, setNewQ] = useState<{
    type: QuestionType;
    title: string;
    content: string;
    correct_answer: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: number;
    optionsText: string;
    imageUrlsText: string;
  }>({
    type: 'multiple-choice',
    title: '',
    content: '',
    correct_answer: '',
    difficulty: 'medium',
    points: 5,
    optionsText: '',
    imageUrlsText: '',
  });

  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);

  const [viewQ, setViewQ] = useState<Question | null>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [moveBankId, setMoveBankId] = useState<string>('');

  // Questions that need fixing (MCQ without options)
  const [questionsNeedingFix, setQuestionsNeedingFix] = useState<Question[]>([]);
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixingQuestions, setFixingQuestions] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadQuestionsNeedingFix = useCallback(async () => {
    try {
      const res = await questionsApi.getMissingOptions();
      setQuestionsNeedingFix(res.questions);
    } catch (e) {
      // Silently fail - this is optional info
      console.error('Failed to load questions needing fix:', e);
    }
  }, []);

  const loadBanks = useCallback(async () => {
    const res = await questionBanksApi.list();
    setBanks(res.banks);
    const counts: Record<string, number> = {};
    await Promise.all(
      res.banks.map(async (b) => {
        try {
          const g = await questionBanksApi.get(b.id);
          counts[b.id] = g.questions.length;
        } catch {
          counts[b.id] = 0;
        }
      })
    );
    setBankCounts(counts);
  }, []);

  const loadQuestions = useCallback(async () => {
    if (!user?.id || (user.role !== 'teacher' && user.role !== 'admin')) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (selectedBank === 'all') {
        const res = await questionsApi.list({
          ...(user.role === 'teacher' ? { created_by: user.id } : {}),
          search: debouncedSearch.trim() || undefined,
          type: selectedType === 'all' ? undefined : selectedType,
          difficulty: selectedDifficulty === 'all' ? undefined : selectedDifficulty,
        });
        setQuestions(res.questions);
      } else {
        const g = await questionBanksApi.get(selectedBank);
        let qs = g.questions;
        const q = debouncedSearch.trim().toLowerCase();
        if (q) {
          qs = qs.filter(
            (x) =>
              x.title.toLowerCase().includes(q) || x.content.toLowerCase().includes(q)
          );
        }
        if (selectedType !== 'all') qs = qs.filter((x) => x.type === selectedType);
        if (selectedDifficulty !== 'all') qs = qs.filter((x) => x.difficulty === selectedDifficulty);
        setQuestions(qs);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat soal');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [
    user?.id,
    user?.role,
    selectedBank,
    debouncedSearch,
    selectedType,
    selectedDifficulty,
  ]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    (async () => {
      try {
        await loadBanks();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal memuat bank soal');
      }
    })();
  }, [authLoading, user?.id, loadBanks]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    // Load questions needing fix in background
    loadQuestionsNeedingFix();
  }, [authLoading, user?.id, loadQuestionsNeedingFix]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    loadQuestions();
  }, [authLoading, user?.id, loadQuestions]);

  const filteredQuestions = questions;

  const questionTypes: { value: QuestionType; label: string }[] = [
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'true-false', label: 'True/False' },
    { value: 'short-answer', label: 'Short Answer' },
    { value: 'essay', label: 'Essay' },
    { value: 'matching', label: 'Matching' },
    { value: 'fill-blank', label: 'Fill in the Blank' },
  ];

  const difficulties = ['easy', 'medium', 'hard'];

  const getTypeBadge = (type: QuestionType) => {
    const variants: Record<QuestionType, { label: string; className: string }> = {
      'multiple-choice': { label: 'MCQ', className: 'bg-blue-500/10 text-blue-500' },
      'true-false': { label: 'T/F', className: 'bg-green-500/10 text-green-500' },
      'short-answer': { label: 'Short', className: 'bg-purple-500/10 text-purple-500' },
      essay: { label: 'Essay', className: 'bg-orange-500/10 text-orange-500' },
      matching: { label: 'Match', className: 'bg-pink-500/10 text-pink-500' },
      'fill-blank': { label: 'Fill', className: 'bg-cyan-500/10 text-cyan-500' },
    };
    const variant = variants[type];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getDifficultyBadge = (difficulty: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      easy: { label: 'Easy', className: 'bg-green-500/10 text-green-500' },
      medium: { label: 'Medium', className: 'bg-yellow-500/10 text-yellow-500' },
      hard: { label: 'Hard', className: 'bg-red-500/10 text-red-500' },
    };
    const variant = variants[difficulty];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const toggleQuestionSelection = (id: string) => {
    const next = new Set(selectedQuestions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedQuestions(next);
  };

  const toggleAllSelection = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map((q) => q.id)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return;
    try {
      await questionsApi.delete(id);
      toast.success('Soal dihapus');
      await loadQuestions();
      await loadBanks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  };

  const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Pilih file gambar (JPG, PNG, …)');
      return;
    }
    setImageUploading(true);
    try {
      const r = await mediaApi.upload(file);
      setUploadedImageUrls((prev) => [...prev, r.url]);
      toast.success('Gambar diunggah — URL ditambahkan ke daftar');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload gagal (pastikan Cloudinary dikonfigurasi di server)');
    } finally {
      setImageUploading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedQuestions.size) return;
    if (!confirm(`Hapus ${selectedQuestions.size} soal?`)) return;
    try {
      await Promise.all([...selectedQuestions].map((id) => questionsApi.delete(id)));
      toast.success('Soal terpilih dihapus');
      setSelectedQuestions(new Set());
      await loadQuestions();
      await loadBanks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  };

  const handleDuplicate = async (q: Question) => {
    try {
      const payload: CreateQuestionRequest = {
        type: q.type,
        title: `${q.title} (copy)`,
        content: q.content,
        correct_answer: Array.isArray(q.correctAnswer)
          ? q.correctAnswer.join('; ')
          : String(q.correctAnswer ?? ''),
        difficulty: q.difficulty,
        points: q.points,
        tags: q.tags,
        options: q.options,
        explanation: q.explanation,
        ...(q.imageUrls?.length ? { image_urls: q.imageUrls } : {}),
      };
      await questionsApi.create(payload);
      toast.success('Soal diduplikasi');
      await loadQuestions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menduplikasi');
    }
  };

  const submitNewQuestion = async () => {
    if (!newQ.title.trim() || !newQ.content.trim() || !newQ.correct_answer.trim()) {
      toast.error('Judul, isi, dan jawaban benar wajib diisi');
      return;
    }
    let options: string[] | undefined;
    if (newQ.type === 'multiple-choice') {
      options = newQ.optionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (options.length < 2) {
        toast.error('MCQ: isi minimal 2 opsi (satu baris per opsi)');
        return;
      }
    }
    const fromText = newQ.imageUrlsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const image_urls = [...new Set([...fromText, ...uploadedImageUrls])];

    setSaving(true);
    try {
      await questionsApi.create({
        type: newQ.type,
        title: newQ.title.trim(),
        content: newQ.content.trim(),
        correct_answer: newQ.correct_answer.trim(),
        difficulty: newQ.difficulty,
        points: newQ.points,
        options,
        ...(image_urls.length > 0 ? { image_urls } : {}),
      });
      toast.success('Soal ditambahkan');
      setAddOpen(false);
      setUploadedImageUrls([]);
      setNewQ({
        type: 'multiple-choice',
        title: '',
        content: '',
        correct_answer: '',
        difficulty: 'medium',
        points: 5,
        optionsText: '',
        imageUrlsText: '',
      });
      await loadQuestions();
      await loadBanks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!user?.id) return;
    try {
      await downloadBlobGet(
        '/questions/export',
        user.role === 'teacher' ? { created_by: user.id } : undefined,
        `questions-${user.id.slice(0, 8)}.json`
      );
      toast.success('Export dimulai');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export gagal');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text) as unknown;
        let arr: CreateQuestionRequest[];
        if (Array.isArray(parsed)) {
          arr = parsed as CreateQuestionRequest[];
        } else if (
          parsed &&
          typeof parsed === 'object' &&
          'questions' in parsed &&
          Array.isArray((parsed as { questions: unknown }).questions)
        ) {
          arr = (parsed as { questions: CreateQuestionRequest[] }).questions;
        } else {
          toast.error('Format JSON tidak dikenali');
          return;
        }
        const res = await questionsApi.import(arr);
        toast.success(`Diimpor ${res.imported} soal`);
        if (res.failed?.length) toast.warning(`${res.failed.length} baris gagal`);
        await loadQuestions();
        await loadBanks();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Import gagal');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const createBank = async () => {
    if (!newBankName.trim()) return;
    try {
      await questionBanksApi.create({ name: newBankName.trim(), is_public: false });
      toast.success('Bank soal dibuat');
      setNewBankName('');
      setBankDialogOpen(false);
      await loadBanks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat bank');
    }
  };

  const handleDeleteBank = async (bankId: string, bankName: string) => {
    if (!confirm(`Hapus bank soal "${bankName}"?\n\nSoal-soal di dalam bank tidak akan dihapus.`)) return;
    try {
      await questionBanksApi.delete(bankId);
      toast.success('Bank soal dihapus');
      if (selectedBank === bankId) {
        setSelectedBank('all');
      }
      await loadBanks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus bank');
    }
  };

  const moveToBank = async () => {
    if (!moveBankId || !selectedQuestions.size) return;
    try {
      let order = 0;
      for (const qid of selectedQuestions) {
        await questionBanksApi.addQuestion(moveBankId, qid, order++);
      }
      toast.success('Soal dipindahkan ke bank');
      setSelectedQuestions(new Set());
      setMoveBankId('');
      await loadBanks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memindahkan');
    }
  };

  const openFixDialog = async () => {
    await loadQuestionsNeedingFix();
    setFixDialogOpen(true);
  };

  const handleBulkFixOptions = async (questionId: string, options: string[]) => {
    setFixingQuestions(true);
    try {
      const res = await questionsApi.bulkFixOptions([{ question_id: questionId, options }]);
      if (res.updated > 0) {
        toast.success('Opsi diperbarui');
        await loadQuestions();
        await loadQuestionsNeedingFix();
      } else {
        toast.error('Gagal memperbarui opsi');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memperbarui opsi');
    } finally {
      setFixingQuestions(false);
    }
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
          Akun guru atau admin diperlukan untuk halaman ini.
        </div>
      </TeacherNav>
    );
  }

  return (
    <TeacherNav>
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="min-h-16 border-b border-border bg-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 sm:py-0 shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold truncate">Question Bank</h1>
            <Badge variant="outline" className="shrink-0">
              {loading ? '…' : `${filteredQuestions.length} ditampilkan`}
            </Badge>
            {questionsNeedingFix.length > 0 && (
              <Badge variant="outline" className="shrink-0 bg-orange-500/10 text-orange-500">
                ⚠️ {questionsNeedingFix.length} perlu opsi
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <input type="file" accept="application/json,.json" className="hidden" id="q-import" onChange={handleImportFile} />
            <Button variant="outline" size="sm" asChild>
              <label htmlFor="q-import" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </label>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={openFixDialog}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Fix Options
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Question
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex flex-1 min-h-0 flex-col md:flex-row">
            <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border p-3 md:p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:space-y-2 shrink-0">
              <div className="hidden md:flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm">Question Banks</h2>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBankDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex md:hidden items-center justify-between shrink-0 min-w-[140px]">
                <h2 className="font-semibold text-sm">Banks</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBankDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBank('all')}
                className={cn(
                  'w-full md:w-full shrink-0 min-w-[140px] md:min-w-0 flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                  selectedBank === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span>All Questions</span>
              </button>

              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className={cn(
                    'group flex items-center gap-0.5',
                    selectedBank === bank.id ? 'bg-primary rounded-lg' : ''
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBank(bank.id)}
                    className={cn(
                      'flex-1 min-w-0 flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                      selectedBank === bank.id
                        ? 'text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <FolderKanban className="w-4 h-4 shrink-0" />
                    <span className="truncate">{bank.name}</span>
                    <Badge
                      variant={selectedBank === bank.id ? 'secondary' : 'outline'}
                      className="ml-auto shrink-0"
                    >
                      {bankCounts[bank.id] ?? '—'}
                    </Badge>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-8 w-8 shrink-0',
                          selectedBank === bank.id && 'hover:bg-primary-foreground/20 text-primary-foreground',
                        )}
                        aria-label="Aksi bank soal"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteBank(bank.id, bank.name)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Hapus bank
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </aside>

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto min-h-0">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search questions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <Select value={selectedType} onValueChange={(v) => setSelectedType(v ?? 'all')}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Question Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {questionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedDifficulty} onValueChange={(v) => setSelectedDifficulty(v ?? 'all')}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        {difficulties.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {selectedQuestions.size > 0 && (
                <Card className="border-primary">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">
                      <span className="font-medium">{selectedQuestions.size}</span> selected
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={moveBankId || '__'} onValueChange={(v) => setMoveBankId(v === '__' ? '' : v ?? '')}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Pilih bank…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__">Pilih bank…</SelectItem>
                          {banks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" disabled={!moveBankId} onClick={moveToBank}>
                        <FolderKanban className="w-4 h-4 mr-2" />
                        Move to bank
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="overflow-hidden">
                {loading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-px">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={
                              filteredQuestions.length > 0 &&
                              selectedQuestions.size === filteredQuestions.length
                            }
                            onCheckedChange={toggleAllSelection}
                          />
                        </TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead className="w-[140px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuestions.map((question) => (
                        <TableRow key={question.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedQuestions.has(question.id)}
                              onCheckedChange={() => toggleQuestionSelection(question.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">{question.title}</p>
                                  {question.type === 'multiple-choice' && (!question.options || question.options.length === 0) && (
                                    <Badge variant="outline" className="bg-orange-500/10 text-orange-500 text-xs shrink-0">
                                      <span className="mr-1">⚠️</span>Tanpa Opsi
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-1">{question.content}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getTypeBadge(question.type)}</TableCell>
                          <TableCell>{getDifficultyBadge(question.difficulty)}</TableCell>
                          <TableCell>{question.points}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(question.tags || []).slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {(question.tags || []).length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(question.tags || []).length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewQ(question)}
                                title="View detail"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDuplicate(question)}
                                title="Duplicate"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="More options"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewQ(question)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicate(question)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDelete(question.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
                {!loading && filteredQuestions.length === 0 && (
                  <p className="text-center text-muted-foreground py-12 text-sm">Tidak ada soal.</p>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setUploadedImageUrls([]);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah soal</DialogTitle>
            <DialogDescription>Disimpan ke bank soal Anda (API POST /questions).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={newQ.type} onValueChange={(v) => setNewQ((s) => ({ ...s, type: v as QuestionType }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Judul</Label>
              <Input className="mt-1" value={newQ.title} onChange={(e) => setNewQ((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div>
              <Label>Pertanyaan</Label>
              <Textarea className="mt-1" rows={3} value={newQ.content} onChange={(e) => setNewQ((s) => ({ ...s, content: e.target.value }))} />
            </div>
            {newQ.type === 'multiple-choice' && (
              <div>
                <Label>Opsi (satu baris per opsi)</Label>
                <Textarea
                  className="mt-1 font-mono text-sm"
                  rows={4}
                  placeholder={'Opsi A\nOpsi B\nOpsi C'}
                  value={newQ.optionsText}
                  onChange={(e) => setNewQ((s) => ({ ...s, optionsText: e.target.value }))}
                />
              </div>
            )}
            <div>
              <Label>Jawaban benar</Label>
              <Input
                className="mt-1"
                placeholder={newQ.type === 'true-false' ? 'true atau false' : 'Teks jawaban'}
                value={newQ.correct_answer}
                onChange={(e) => setNewQ((s) => ({ ...s, correct_answer: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Difficulty</Label>
                <Select
                  value={newQ.difficulty}
                  onValueChange={(v) => setNewQ((s) => ({ ...s, difficulty: v as typeof s.difficulty }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {difficulties.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  className="mt-1"
                  min={1}
                  value={newQ.points}
                  onChange={(e) => setNewQ((s) => ({ ...s, points: Number(e.target.value) || 5 }))}
                />
              </div>
            </div>
            <div>
              <Label>Gambar (opsional)</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                Unggah ke Cloudinary atau tempel URL gambar, satu per baris.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="q-image-upload"
                  onChange={handleQuestionImageUpload}
                  disabled={imageUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={imageUploading}
                  className="touch-manipulation"
                  asChild
                >
                  <label htmlFor="q-image-upload" className="cursor-pointer">
                    {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                    Upload gambar
                  </label>
                </Button>
              </div>
              {(uploadedImageUrls.length > 0 || newQ.imageUrlsText.trim()) && (
                <p className="text-xs text-muted-foreground mt-2">
                  {uploadedImageUrls.length > 0 && `${uploadedImageUrls.length} dari upload · `}
                  URL tambahan di bawah.
                </p>
              )}
              <Textarea
                className="mt-2 font-mono text-xs"
                rows={3}
                placeholder="https://example.com/gambar.png"
                value={newQ.imageUrlsText}
                onChange={(e) => setNewQ((s) => ({ ...s, imageUrlsText: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                setUploadedImageUrls([]);
              }}
            >
              Batal
            </Button>
            <Button onClick={submitNewQuestion} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewQ} onOpenChange={(o) => !o && setViewQ(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">{viewQ?.title}</DialogTitle>
              <div className="flex items-center gap-2">
                {viewQ && getTypeBadge(viewQ.type)}
                {viewQ && getDifficultyBadge(viewQ.difficulty)}
                <Badge variant="outline">{viewQ?.points} pts</Badge>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {/* Warning for MCQ without options */}
            {viewQ?.type === 'multiple-choice' && (!viewQ.options || viewQ.options.length === 0) && (
              <Card className="border-orange-500/50 bg-orange-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                      <span className="text-lg">⚠️</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-orange-700 dark:text-orange-400">Soal ini belum memiliki opsi jawaban</p>
                      <p className="text-sm text-orange-600/70 dark:text-orange-400/70">
                        Soal Multiple Choice seharusnya memiliki minimal 2 opsi jawaban.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-500/50 text-orange-700 hover:bg-orange-500/20"
                      onClick={() => {
                        setViewQ(null);
                        openFixDialog();
                      }}
                    >
                      Perbaiki
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Question Content Card */}
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-4">
                {/* Question Text */}
                <div>
                  <p className="text-base leading-relaxed">{viewQ?.content}</p>
                </div>

                {/* Images */}
                {viewQ?.imageUrls && viewQ.imageUrls.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {viewQ.imageUrls.map((url, idx) => (
                      <div key={idx} className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={url}
                          alt={`Question image ${idx + 1}`}
                          className="w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Options - Enhanced display */}
                {viewQ?.type === 'multiple-choice' && (
                  <>
                    {viewQ.options && Array.isArray(viewQ.options) && viewQ.options.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Pilihan jawaban:</p>
                        <div className="space-y-2">
                          {viewQ.options.map((option, idx) => {
                            const isCorrect = option === viewQ?.correctAnswer;
                            const letter = String.fromCharCode(65 + idx); // A, B, C, ...
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                                  isCorrect
                                    ? 'bg-green-500/10 border-green-500/50'
                                    : 'bg-muted/30 border-border'
                                )}
                              >
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                  {letter}
                                </span>
                                <span className={cn(
                                  'flex-1',
                                  isCorrect && 'font-medium text-green-700 dark:text-green-400'
                                )}>
                                  {option}
                                </span>
                                {isCorrect && (
                                  <div className="flex-shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border border-dashed border-orange-500/50 bg-orange-500/5">
                        <p className="text-sm text-center text-muted-foreground">
                          Belum ada opsi jawaban. Klik tombol "Perbaiki" di atas untuk menambahkan opsi.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* True/False Type */}
                {viewQ?.type === 'true-false' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Pilih True atau False:</p>
                    <div className="flex gap-3">
                      {[
                        { value: 'true', label: 'True' },
                        { value: 'false', label: 'False' }
                      ].map((opt) => {
                        const isCorrect = opt.value.toLowerCase() === String(viewQ?.correctAnswer).toLowerCase();
                        return (
                          <div
                            key={opt.value}
                            className={cn(
                              'flex-1 p-3 rounded-lg border text-center font-medium transition-colors',
                              isCorrect
                                ? 'bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400'
                                : 'bg-muted/30 border-border'
                            )}
                          >
                            {opt.label}
                            {isCorrect && (
                              <span className="ml-2">
                                <CheckCircle2 className="w-4 h-4 inline text-green-600" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Short Answer / Essay */}
                {(viewQ?.type === 'short-answer' || viewQ?.type === 'essay') && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {viewQ?.type === 'essay' ? 'Jawaban esai:' : 'Jawaban singkat:'}
                    </p>
                    <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground italic">
                        {viewQ?.type === 'essay'
                          ? 'Siswa akan mengetik jawaban dalam bentuk esai panjang.'
                          : 'Siswa akan mengetik jawaban singkat.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Matching Type */}
                {viewQ?.type === 'matching' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Tipe: Matching</p>
                    <p className="text-sm text-muted-foreground">Siswa akan mencocokkan item dari kolom kiri dengan kolom kanan.</p>
                  </div>
                )}

                {/* Fill in the Blank Type */}
                {viewQ?.type === 'fill-blank' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Tipe: Fill in the Blank</p>
                    <p className="text-sm text-muted-foreground">Siswa akan mengisi bagian yang kosong.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Answer & Metadata */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                {/* Correct Answer */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Jawaban benar:</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {Array.isArray(viewQ?.correctAnswer)
                      ? viewQ.correctAnswer.join(', ')
                      : String(viewQ?.correctAnswer ?? '-')}
                  </span>
                </div>

                {/* Options Count */}
                {viewQ?.type === 'multiple-choice' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Jumlah opsi:</span>
                    <span className={cn(
                      'font-medium',
                      (!viewQ.options || viewQ.options.length === 0) ? 'text-orange-600' : ''
                    )}>
                      {viewQ.options?.length ?? 0} opsi
                    </span>
                  </div>
                )}

                {/* Explanation */}
                {viewQ?.explanation && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Penjelasan:</p>
                    <p className="text-sm text-muted-foreground">{viewQ.explanation}</p>
                  </div>
                )}

                {/* Tags */}
                {viewQ?.tags && viewQ.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Tags:</span>
                    {viewQ.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>ID: {viewQ?.id.slice(0, 8)}...</span>
                  <span>Dibuat: {viewQ?.createdAt ? new Date(viewQ.createdAt).toLocaleDateString('id-ID') : '-'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewQ(null)}>
                Tutup
              </Button>
              {viewQ && (
                <Button onClick={() => {
                  setViewQ(null);
                  handleDuplicate(viewQ);
                }}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplikat
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank soal baru</DialogTitle>
          </DialogHeader>
          <Input placeholder="Nama bank" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} />
          <DialogFooter>
            <Button onClick={createBank}>Buat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix Options Dialog */}
      <Dialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Perbaiki Soal Tanpa Opsi</DialogTitle>
            <DialogDescription>
              Soal tipe Multiple Choice yang belum memiliki opsi jawaban.
            </DialogDescription>
          </DialogHeader>
          {questionsNeedingFix.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>Semua soal Multiple Choice sudah memiliki opsi.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questionsNeedingFix.map((q) => (
                <FixOptionItem
                  key={q.id}
                  question={q}
                  onFix={handleBulkFixOptions}
                  fixing={fixingQuestions}
                />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeacherNav>
  );
}

// Component for fixing a single question's options
function FixOptionItem({
  question,
  onFix,
  fixing,
}: {
  question: Question;
  onFix: (id: string, options: string[]) => Promise<void>;
  fixing: boolean;
}) {
  const [options, setOptions] = useState<string[]>(question.options || ['', '']);
  const [saving, setSaving] = useState(false);

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSave = async () => {
    const validOptions = options.filter((o) => o.trim() !== '');
    if (validOptions.length < 2) {
      toast.error('Minimal 2 opsi diperlukan');
      return;
    }
    setSaving(true);
    await onFix(question.id, validOptions);
    setSaving(false);
  };

  return (
    <Card className="border-orange-200 dark:border-orange-900">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{question.title}</p>
            <p className="text-sm text-muted-foreground line-clamp-1">{question.content}</p>
          </div>
          <Badge className="shrink-0 bg-orange-500/10 text-orange-500">
            {question.type}
          </Badge>
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Opsi Jawaban:</Label>
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
              <Input
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                className="flex-1"
              />
              {options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeOption(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addOption}
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Opsi
          </Button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            Jawaban benar: <span className="font-medium text-foreground">{question.correctAnswer}</span>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || fixing}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Opsi'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
