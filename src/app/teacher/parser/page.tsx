'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  Save,
  Loader2,
  ChevronUp,
  ChevronDown,
  Copy,
  ImageIcon,
  FileText,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { parseQuestions } from '@/lib/api/parser';
import { questionsApi, type CreateQuestionRequest } from '@/lib/api/questions';
import {
  attachImagesFromParserTemplate,
  attachUploadedPageImagesByQuestionMap,
} from '@/lib/parser-image-attachments';
import { buildParserInputFromPdf } from '@/lib/pdf-parser-input';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { toast } from 'sonner';
import type { DifficultyLevel, ParseResult, ParsedQuestion, QuestionType } from '@/lib/types';

/** Soal hasil parse + id stabil untuk key, seleksi, dan reorder */
type WorkingQuestion = ParsedQuestion & { id: string };

function newEmptyWorkingQuestion(): WorkingQuestion {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    type: 'multiple-choice',
    title: 'Soal baru',
    content: '',
    options: ['Opsi A', 'Opsi B'],
    correctAnswer: 'Opsi A',
    difficulty: 'medium',
    points: 5,
    tags: [],
  };
}

function toParsedQuestion(w: WorkingQuestion): ParsedQuestion {
  const { id: _unused, ...rest } = w;
  void _unused;
  return rest;
}

function parsedToCreate(q: ParsedQuestion): CreateQuestionRequest {
  const ans = q.correctAnswer;
  let correct_answer = Array.isArray(ans) ? ans.join('; ') : String(ans ?? '');
  correct_answer = correct_answer.trim();
  // Map letter key (b / B) to full option text for MCQ grading & DB consistency
  if (
    q.type === 'multiple-choice' &&
    q.options &&
    q.options.length >= 2 &&
    /^[a-d]$/i.test(correct_answer)
  ) {
    const idx = correct_answer.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    if (idx >= 0 && idx < q.options.length) {
      correct_answer = q.options[idx];
    }
  }
  const imgs = [...(q.imageUrls ?? [])].map((s) => s.trim()).filter(Boolean);
  const image_urls = imgs.length > 0 ? [...new Set(imgs)] : undefined;
  return {
    type: q.type as QuestionType,
    title: q.title,
    content: q.content,
    options: q.options,
    correct_answer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    points: q.points,
    tags: q.tags ?? [],
    ...(image_urls ? { image_urls } : {}),
  };
}

export default function AIQuestionParserPage() {
  const [inputText, setInputText] = useState('');
  /** data URL untuk parse vision (max 8, backend max 4MB/gambar) */
  const [parseImages, setParseImages] = useState<string[]>([]);
  /** Untuk PDF: qIndex -> pageIndex agar gambar halaman bisa ditempel ke soal hasil parse */
  const [pdfQuestionPageMap, setPdfQuestionPageMap] = useState<number[]>([]);
  const [inputMethod, setInputMethod] = useState<'text' | 'file' | 'json'>('text');
  const [jsonImportText, setJsonImportText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isJsonImporting, setIsJsonImporting] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  /** Daftar soal yang bisa diedit; diisi ulang setiap parse sukses */
  const [workingQuestions, setWorkingQuestions] = useState<WorkingQuestion[]>([]);
  /** Kosong = anggap semua terpilih (sama perilaku checkbox sebelumnya) */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const questionTypes: { value: QuestionType; label: string }[] = [
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'true-false', label: 'True/False' },
    { value: 'short-answer', label: 'Short Answer' },
    { value: 'essay', label: 'Essay' },
    { value: 'matching', label: 'Matching' },
    { value: 'fill-blank', label: 'Fill in the Blank' },
  ];
  const difficulties: DifficultyLevel[] = ['easy', 'medium', 'hard'];

  const sampleText = `1. What is the process by which plants convert sunlight into energy?
a) Respiration
b) Photosynthesis
c) Transpiration
d) Germination
Correct answer: b

2. The chemical formula for water is H2O. True or False?
Correct answer: True

3. Solve: 2x + 5 = 15
a) x = 5
b) x = 10
c) x = 7
d) x = 3
Correct answer: a`;

  /** Contoh: teks + penanda gambar; unggah 1 foto (diagram di soal no.1) lalu Parse. */
  const sampleTextWithImagePlaceholder = `1. 5² dibaca ....
a) Lima akar dua
b) Dua pangkat lima
c) Lima kuadrat
d) Dua kuadrat
Correct answer: c
 
[!Link Image]
2. 25² sama dengan ....
a) 25 + 25
b) 25 x 25
c) 25 : 25
d) 25 – 25
Correct answer: b`;

  const readFileAsDataURL = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ''));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }, []);

  const addParseImagesFromFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setPdfQuestionPageMap([]);
      const additions: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) {
          toast.error(`${f.name}: hanya berkas gambar (JPEG, PNG, WebP, GIF).`);
          continue;
        }
        try {
          additions.push(await readFileAsDataURL(f));
        } catch {
          toast.error(`Gagal membaca ${f.name}`);
        }
      }
      if (!additions.length) return;
      setParseImages((prev) => {
        const cap = 8;
        const room = Math.max(0, cap - prev.length);
        const take = additions.slice(0, room);
        if (additions.length > room) {
          toast.warning(`Maksimal ${cap} gambar; sisanya tidak ditambahkan.`);
        }
        return [...prev, ...take];
      });
    },
    [readFileAsDataURL]
  );

  const removeParseImageAt = useCallback((index: number) => {
    setPdfQuestionPageMap([]);
    setParseImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePdfUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      toast.error('Pilih file PDF.');
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await buildParserInputFromPdf(file);
      setInputText(parsed.text);
      setParseImages(parsed.pageImages);
      setPdfQuestionPageMap(parsed.questionPageMap);
      parsed.warnings.forEach((w) => toast.warning(w));
      toast.success(
        `PDF diproses: ${parsed.pageImages.length} halaman gambar + teks ${parsed.text.trim() ? 'siap' : 'kosong'}.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membaca PDF');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const sampleJsonImport = `[
  {
    "type": "multiple-choice",
    "title": "Sample MCQ",
    "content": "What is 2 + 2?",
    "options": ["3", "4", "5", "6"],
    "correct_answer": "4",
    "explanation": "Basic arithmetic.",
    "difficulty": "easy",
    "points": 5,
    "tags": ["math"]
  }
]`;

  const handleParse = async () => {
    if (!inputText.trim() && parseImages.length === 0) return;

    const templateSnapshot = inputText;
    setIsParsing(true);
    try {
      const result = await parseQuestions(
        inputText.trim(),
        parseImages.length > 0 ? parseImages : undefined
      );
      setParseResult(result);

      if (result.success && result.questions.length > 0) {
        let withIds: WorkingQuestion[] = result.questions.map((q) => ({
          ...q,
          tags: q.tags ?? [],
          imageUrls: [...(q.imageUrls ?? [])],
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }));
        try {
          const { questions: merged, warnings: attachWarn } =
            await attachImagesFromParserTemplate(templateSnapshot, parseImages, withIds);
          withIds = merged as WorkingQuestion[];
          attachWarn.forEach((w) => toast.warning(w));

          // PDF fallback: bila tidak ada marker [!Link Image], tempel gambar halaman PDF ke soal via map q->page.
          if (pdfQuestionPageMap.length > 0) {
            const { questions: pageMapped, warnings: mapWarn } =
              await attachUploadedPageImagesByQuestionMap(withIds, parseImages, pdfQuestionPageMap);
            withIds = pageMapped as WorkingQuestion[];
            mapWarn.forEach((w) => toast.warning(w));
          }
        } catch (attErr) {
          console.error(attErr);
          toast.error(attErr instanceof Error ? attErr.message : 'Lampiran gambar gagal diproses');
        }
        setWorkingQuestions(withIds);
        setSelectedIds(new Set());
        setEditingId(null);
        setParseImages([]);
        setPdfQuestionPageMap([]);
        toast.success(`Berhasil mem-parsing ${result.questions.length} soal.`);
      } else {
        setWorkingQuestions([]);
        setSelectedIds(new Set());
        setEditingId(null);
        setPdfQuestionPageMap([]);
      }

      if (!result.success) {
        const msg = result.errors?.join('; ') ?? 'Parse gagal';
        toast.error(msg);
        console.error('Parse errors:', result.errors);
      }
    } catch (error) {
      console.error('Parse error:', error);
      setParseResult({
        success: false,
        questions: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
      setWorkingQuestions([]);
      setSelectedIds(new Set());
      setEditingId(null);
      setPdfQuestionPageMap([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveAll = async () => {
    if (!workingQuestions.length) return;

    const rows = workingQuestions.filter(
      (q) => selectedIds.has(q.id) || selectedIds.size === 0
    );
    if (!rows.length) {
      toast.error('Pilih minimal satu soal untuk disimpan.');
      return;
    }

    const payload = rows.map((w) => parsedToCreate(toParsedQuestion(w)));
    setIsSaving(true);
    try {
      const res = await questionsApi.import(payload);
      if (res.failed?.length) {
        const detail = res.failed.map((f) => `#${f.index}: ${f.error}`).join(' · ');
        toast.warning(`Tersimpan ${res.imported} soal; ${res.failed.length} gagal. ${detail}`);
      } else {
        toast.success(`${res.imported} soal ditambahkan ke bank.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan ke bank soal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleJsonImportToBank = async () => {
    const raw = jsonImportText.trim();
    if (!raw) {
      toast.error('Tempel JSON array atau objek dengan field questions.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast.error('JSON tidak valid.');
      return;
    }

    let items: CreateQuestionRequest[];
    if (Array.isArray(parsed)) {
      // Direct array format: [{...}, {...}]
      items = parsed as CreateQuestionRequest[];
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      'questions' in parsed &&
      Array.isArray((parsed as { questions: unknown }).questions)
    ) {
      // Object with questions field: {"questions": [...]} or AI Parser output: {"success": true, "questions": [...]}
      items = (parsed as { questions: CreateQuestionRequest[] }).questions;
    } else {
      toast.error('Gunakan array [...] atau {"questions":[...]}.');
      return;
    }

    if (!items.length) {
      toast.error('Tidak ada soal di JSON.');
      return;
    }

    setIsJsonImporting(true);
    try {
      const res = await questionsApi.import(items);
      if (res.failed?.length) {
        const detail = res.failed.map((f) => `#${f.index}: ${f.error}`).join(' · ');
        toast.warning(`Diimpor ${res.imported} soal; ${res.failed.length} baris gagal. ${detail}`);
      } else {
        toast.success(`${res.imported} soal diimpor ke bank.`);
      }
      setJsonImportText('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import gagal');
    } finally {
      setIsJsonImporting(false);
    }
  };

  const updateQuestion = (id: string, patch: Partial<ParsedQuestion>) => {
    setWorkingQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
  };

  const removeQuestion = (id: string) => {
    setWorkingQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setEditingId((e) => (e === id ? null : e));
  };

  const addQuestion = () => {
    const q = newEmptyWorkingQuestion();
    setWorkingQuestions((prev) => [...prev, q]);
    setEditingId(q.id);
  };

  const duplicateQuestion = (id: string) => {
    const src = workingQuestions.find((x) => x.id === id);
    if (!src) return;
    const copy: WorkingQuestion = {
      ...src,
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: `${src.title} (salinan)`,
    };
    setWorkingQuestions((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setEditingId(copy.id);
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    setWorkingQuestions((prev) => {
      const i = prev.findIndex((q) => q.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const toggleQuestionSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllParsed = () => {
    setSelectedIds(new Set(workingQuestions.map((q) => q.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      'multiple-choice': { label: 'MCQ', className: 'bg-blue-500/10 text-blue-500' },
      'true-false': { label: 'T/F', className: 'bg-green-500/10 text-green-500' },
      'short-answer': { label: 'Short', className: 'bg-purple-500/10 text-purple-500' },
      essay: { label: 'Essay', className: 'bg-orange-500/10 text-orange-500' },
      matching: { label: 'Match', className: 'bg-pink-500/10 text-pink-500' },
      'fill-blank': { label: 'Fill', className: 'bg-cyan-500/10 text-cyan-500' },
    };
    const variant = variants[type] || variants['multiple-choice'];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <TeacherNav>
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI Question Parser</h1>
              <p className="text-xs text-muted-foreground">Teks + gambar → soal terstruktur (AI vision bila ada gambar)</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Input Your Questions
                </CardTitle>
                <CardDescription>
                  Tempel teks soal dan/atau lampirkan gambar (foto/screenshot/halaman cetak). Mode gambar memakai AI vision —
                  aktifkan <code className="text-xs rounded bg-muted px-1">GEMINI_API_KEY</code> atau{' '}
                  <code className="text-xs rounded bg-muted px-1">ZAI_API_KEY</code> di backend. Teks tetap bisa tanpa API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={inputMethod}
                  onValueChange={(v) => setInputMethod((v ?? 'text') as 'text' | 'file' | 'json')}
                >
                  <TabsList className="grid w-full max-w-2xl grid-cols-3">
                    <TabsTrigger value="text">Paste Text</TabsTrigger>
                    <TabsTrigger value="file">Upload File</TabsTrigger>
                    <TabsTrigger value="json">Import JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-4">
                    <div>
                      <Label htmlFor="question-input">Questions Text</Label>
                      <Textarea
                        id="question-input"
                        placeholder="Paste your questions here...&#10;&#10;Example:&#10;1. What is the capital of France?&#10;a) London&#10;b) Berlin&#10;c) Paris&#10;d) Madrid&#10;Correct answer: c"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        rows={12}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="flex items-center gap-2 text-base">
                          <ImageIcon className="h-4 w-4" />
                          Gambar soal (opsional)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            className="hidden"
                            id="parser-parse-images"
                            onChange={(e) => {
                              void addParseImagesFromFiles(e.target.files);
                              e.target.value = '';
                            }}
                          />
                          <Button type="button" variant="outline" size="sm" asChild>
                            <label htmlFor="parser-parse-images" className="cursor-pointer">
                              <Upload className="mr-2 h-4 w-4" />
                              Unggah gambar
                            </label>
                          </Button>
                          {parseImages.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setParseImages([]);
                                setPdfQuestionPageMap([]);
                              }}
                            >
                              Hapus semua gambar
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground space-y-1">
                        <span className="block">
                          Baris <code className="rounded bg-muted px-1 text-[11px]">[!Link Image]</code> menandai foto yang
                          diunggah ke soal tepat di atasnya; setelah <strong>Simpan ke bank</strong> URL akan tersimpan di{' '}
                          <code className="text-[11px]">image_urls</code> dan <strong>tampil saat murid mengerjakan ujian</strong>.
                          Bisa juga tautan langsung satu baris (https …png/jpg…) atau{' '}
                          <code className="text-[11px]">{`![.](url)`}</code>.
                        </span>
                        <span className="block">
                          JPEG/PNG/WebP/GIF • maks. 8 gambar • ±4&nbsp;MB/gambar. Mode gambar butuh{' '}
                          <code className="rounded bg-muted px-1 text-[11px]">GEMINI_API_KEY</code>/<code className="rounded bg-muted px-1 text-[11px]">ZAI_API_KEY</code>.
                        </span>
                      </p>
                      {parseImages.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parseImages.map((src, idx) => (
                            <div
                              key={`${idx}-${src.slice(0, 48)}`}
                              className="relative h-20 w-20 overflow-hidden rounded-md border bg-background"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeParseImageAt(idx)}
                                className="absolute right-0.5 top-0.5 rounded bg-background/90 p-0.5 shadow hover:bg-destructive hover:text-destructive-foreground"
                                aria-label="Hapus gambar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setInputText(sampleText)}
                      >
                        Contoh teks English
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setInputText(sampleTextWithImagePlaceholder);
                          toast.message('Contoh Indo + [!Link Image] dimuat', {
                            description:
                              'Unggah foto diagram untuk soal no. 1 di kotak Gambar — lalu Parse (butuh AI vision di backend).',
                          });
                        }}
                      >
                        {"Contoh teks Indo + [!Link Image]"}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    <Alert className="border-primary/30 bg-primary/5">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Upload <strong>PDF soal</strong> untuk ekstrak teks + gambar halaman secara otomatis, lalu AI parse.
                        Tetap bisa tambah gambar manual atau .txt seperti sebelumnya.
                      </AlertDescription>
                    </Alert>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      id="parser-file-pdf"
                      onChange={(e) => {
                        void handlePdfUpload(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" asChild variant="secondary">
                        <label htmlFor="parser-file-pdf" className="cursor-pointer">
                          <FileText className="mr-2 h-4 w-4" />
                          Pilih PDF soal
                        </label>
                      </Button>
                      {pdfQuestionPageMap.length > 0 && (
                        <Badge variant="secondary">
                          {pdfQuestionPageMap.length} pertanyaan terdeteksi (map halaman siap)
                        </Badge>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      id="parser-file-images"
                      onChange={(e) => {
                        void addParseImagesFromFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" asChild>
                        <label htmlFor="parser-file-images" className="cursor-pointer">
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Tambahkan gambar ke antrian parse
                        </label>
                      </Button>
                      {parseImages.length > 0 && (
                        <Badge variant="secondary">{parseImages.length} gambar siap diparse</Badge>
                      )}
                    </div>
                    <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium mb-2">Upload dokumen teks (.txt) tambahan</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Isi berkas akan dimasukkan ke kolom teks di tab Paste Text secara otomatis.
                      </p>
                      <input
                        type="file"
                        accept=".txt,text/plain"
                        className="hidden"
                        id="parser-file"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setPdfQuestionPageMap([]);
                          const reader = new FileReader();
                          reader.onload = () => setInputText(String(reader.result || ''));
                          reader.readAsText(f);
                        }}
                      />
                      <Button type="button" asChild>
                        <label htmlFor="parser-file" className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          Choose .txt file
                        </label>
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="json" className="space-y-4">
                    <Alert className="border-border bg-muted/40">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Kirim array soal (field sama dengan API{' '}
                        <code className="text-xs rounded px-1 bg-muted">POST /questions/import</code>
                        ):{' '}
                        <code className="text-xs rounded px-1 bg-muted">type</code>,{' '}
                        <code className="text-xs rounded px-1 bg-muted">title</code>,{' '}
                        <code className="text-xs rounded px-1 bg-muted">content</code>,{' '}
                        <code className="text-xs rounded px-1 bg-muted">correct_answer</code>, dll.
                      </AlertDescription>
                    </Alert>
                    <div>
                      <Label htmlFor="json-import">JSON array atau {'{ "questions": [...] }'}</Label>
                      <Textarea
                        id="json-import"
                        placeholder={`[\n  {\n    "type": "multiple-choice",\n    "title": "...",\n    "content": "...",\n    "correct_answer": "...",\n    "difficulty": "medium",\n    "points": 5\n  }\n]`}
                        value={jsonImportText}
                        onChange={(e) => setJsonImportText(e.target.value)}
                        rows={14}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" type="button" onClick={() => setJsonImportText(sampleJsonImport)}>
                        Load sample JSON
                      </Button>
                      <Button type="button" onClick={handleJsonImportToBank} disabled={isJsonImporting || !jsonImportText.trim()} className="gap-2">
                        {isJsonImporting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importing…
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Import ke bank soal
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {inputMethod !== 'json' && (inputText.length > 0 || parseImages.length > 0) && (
                      <span>
                        {inputText.length > 0 && (
                          <>
                            {inputText.length} karakter • ~{Math.ceil(inputText.split('\n').filter(Boolean).length / 5)}{' '}
                            baris bermakna
                          </>
                        )}
                        {inputText.length > 0 && parseImages.length > 0 ? ' · ' : ''}
                        {parseImages.length > 0 && <>{parseImages.length} gambar lampiran</>}
                      </span>
                    )}
                    {inputMethod === 'json' && jsonImportText.length > 0 && (
                      <span>{jsonImportText.length} characters JSON</span>
                    )}
                  </div>
                  <Button
                    onClick={handleParse}
                    disabled={
                      inputMethod === 'json' ||
                      (!inputText.trim() && parseImages.length === 0) ||
                      isParsing
                    }
                    className="gap-2"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Parse Questions
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Parsing Progress */}
            {isParsing && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <div>
                        <p className="font-medium">AI is analyzing your questions...</p>
                        <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
                      </div>
                    </div>
                    <Progress value={66} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Parsed Results — state lokal: edit / hapus / tambah / urut */}
            {parseResult && !isParsing && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Parsed Questions
                      </CardTitle>
                      <CardDescription>
                        {workingQuestions.length} soal dalam daftar kerja — centang yang akan disimpan, edit lalu simpan ke
                        bank. Gambar/unggahan disimpan sebagai URL HTTPS; murid melihatnya di halaman ujian jika Cloudinary aktif.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="gap-1">
                        <Plus className="w-4 h-4" />
                        Tambah soal
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={selectAllParsed}>
                        Pilih semua
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                        Kosongkan pilihan
                      </Button>
                      <Button
                        onClick={handleSaveAll}
                        disabled={isSaving || workingQuestions.length === 0}
                        className="gap-2"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Simpan ke bank
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workingQuestions.length === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>Belum ada soal di daftar. Parse ulang atau tambah soal secara manual.</span>
                        <Button type="button" size="sm" variant="secondary" onClick={addQuestion} className="shrink-0 gap-1">
                          <Plus className="w-4 h-4" />
                          Tambah soal
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  {parseResult.warnings && parseResult.warnings.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <p className="font-medium">Warnings:</p>
                          <ul className="list-disc list-inside text-sm">
                            {parseResult.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    {workingQuestions.map((q, index) => {
                      const correctStr = Array.isArray(q.correctAnswer)
                        ? q.correctAnswer.join('; ')
                        : String(q.correctAnswer ?? '');
                      const isSelected = selectedIds.has(q.id) || selectedIds.size === 0;
                      const isEditing = editingId === q.id;

                      return (
                        <Card
                          key={q.id}
                          className={cn('transition-all', isSelected && 'ring-2 ring-primary/60')}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleQuestionSelection(q.id)}
                                className="mt-1.5 shrink-0"
                                aria-label={`Pilih soal ${index + 1}`}
                              />

                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">Q{index + 1}</Badge>
                                    {getTypeBadge(q.type)}
                                    <Badge variant="outline" className="capitalize">
                                      {q.difficulty}
                                    </Badge>
                                    <Badge variant="outline">{q.points} pts</Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => moveQuestion(q.id, -1)}
                                      disabled={index === 0}
                                      title="Naik"
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => moveQuestion(q.id, 1)}
                                      disabled={index === workingQuestions.length - 1}
                                      title="Turun"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => duplicateQuestion(q.id)}
                                      title="Duplikat"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setEditingId(isEditing ? null : q.id)}
                                      title={isEditing ? 'Tutup editor' : 'Edit'}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => removeQuestion(q.id)}
                                      title="Hapus dari daftar"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {isEditing ? (
                                  <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <Label>Tipe</Label>
                                        <Select
                                          value={q.type}
                                          onValueChange={(v) => {
                                            const t = v as QuestionType;
                                            const patch: Partial<ParsedQuestion> = { type: t };
                                            if (t === 'multiple-choice' && (!q.options || q.options.length < 2)) {
                                              patch.options = ['Opsi A', 'Opsi B'];
                                            }
                                            if (t !== 'multiple-choice') {
                                              patch.options = undefined;
                                            }
                                            updateQuestion(q.id, patch);
                                          }}
                                        >
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
                                        <Label>Poin</Label>
                                        <Input
                                          type="number"
                                          min={1}
                                          className="mt-1"
                                          value={q.points}
                                          onChange={(e) =>
                                            updateQuestion(q.id, {
                                              points: Number(e.target.value) || 5,
                                            })
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <Label>Judul</Label>
                                      <Input
                                        className="mt-1"
                                        value={q.title}
                                        onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label>Pertanyaan</Label>
                                      <Textarea
                                        className="mt-1"
                                        rows={3}
                                        value={q.content}
                                        onChange={(e) => updateQuestion(q.id, { content: e.target.value })}
                                      />
                                    </div>
                                    {q.type === 'multiple-choice' && (
                                      <div>
                                        <Label>Opsi (satu baris per opsi)</Label>
                                        <Textarea
                                          className="mt-1 font-mono text-sm"
                                          rows={4}
                                          value={(q.options ?? []).join('\n')}
                                          onChange={(e) => {
                                            const opts = e.target.value
                                              .split('\n')
                                              .map((s) => s.trim())
                                              .filter(Boolean);
                                            updateQuestion(q.id, { options: opts.length ? opts : ['', ''] });
                                          }}
                                        />
                                      </div>
                                    )}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <Label>Jawaban benar</Label>
                                        <Input
                                          className="mt-1"
                                          placeholder={q.type === 'true-false' ? 'true / false' : 'Teks atau huruf opsi'}
                                          value={correctStr}
                                          onChange={(e) =>
                                            updateQuestion(q.id, { correctAnswer: e.target.value })
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label>Difficulty</Label>
                                        <Select
                                          value={q.difficulty}
                                          onValueChange={(v) =>
                                            updateQuestion(q.id, { difficulty: v as DifficultyLevel })
                                          }
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
                                    </div>
                                    <div>
                                      <Label>Penjelasan (opsional)</Label>
                                      <Textarea
                                        className="mt-1"
                                        rows={2}
                                        value={q.explanation ?? ''}
                                        onChange={(e) =>
                                          updateQuestion(q.id, {
                                            explanation: e.target.value || undefined,
                                          })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label>Tags (koma)</Label>
                                      <Input
                                        className="mt-1"
                                        value={(q.tags ?? []).join(', ')}
                                        onChange={(e) => {
                                          const tags = e.target.value
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean);
                                          updateQuestion(q.id, { tags });
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label>Gambar (URL HTTPS, satu per baris)</Label>
                                      <Textarea
                                        className="mt-1 font-mono text-xs"
                                        rows={2}
                                        placeholder="https://..."
                                        value={(q.imageUrls ?? []).join('\n')}
                                        onChange={(e) => {
                                          const imageUrls = e.target.value
                                            .split('\n')
                                            .map((s) => s.trim())
                                            .filter(Boolean);
                                          updateQuestion(q.id, {
                                            imageUrls: imageUrls.length ? imageUrls : undefined,
                                          });
                                        }}
                                      />
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        URL ini yang ditampilkan ke murid saat mengerjakan soal.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingId(null)}
                                    >
                                      Selesai mengedit
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <h4 className="font-semibold">{q.title}</h4>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.content}</p>
                                    </div>

                                    {q.imageUrls && q.imageUrls.length > 0 && (
                                      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/20 p-2">
                                        {q.imageUrls.map((src) => (
                                          <div key={src} className="relative max-w-full">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={src}
                                              alt=""
                                              className="max-h-48 max-w-full rounded-md border object-contain bg-background"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {q.options && q.options.length > 0 && (
                                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {q.options.map((option, i) => {
                                          const isCorrect =
                                            option === correctStr ||
                                            (Array.isArray(q.correctAnswer) &&
                                              q.correctAnswer.some((a) => a === option));
                                          return (
                                            <div
                                              key={i}
                                              className={cn(
                                                'flex items-center gap-2 rounded-lg border p-2 text-sm',
                                                isCorrect
                                                  ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
                                                  : 'bg-muted/50'
                                              )}
                                            >
                                              <span className="font-medium">{String.fromCharCode(97 + i)})</span>
                                              <span className="min-w-0 flex-1">{option}</span>
                                              {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {q.explanation && (
                                      <div className="rounded-lg bg-blue-500/10 p-3">
                                        <p className="text-sm">
                                          <span className="font-medium">Penjelasan: </span>
                                          {q.explanation}
                                        </p>
                                      </div>
                                    )}

                                    {(q.tags ?? []).length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {(q.tags ?? []).map((tag) => (
                                          <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </TeacherNav>
  );
}
