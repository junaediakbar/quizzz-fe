'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/shared/admin-nav';
import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/shared/data-pagination';
import { MathText } from '@/components/shared/math-text';
import {
  OptionImageDisplay,
  QuestionStemWithImages,
  isTitleRedundant,
} from '@/components/shared/question-image-display';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { questionsApi } from '@/lib/api/questions';
import { Question, QuestionType, DifficultyLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FolderKanban,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';


const TYPE_META: Record<string, { label: string; className: string }> = {
  'multiple-choice': { label: 'Pilihan Ganda', className: 'bg-blue-500/10 text-blue-600' },
  'true-false': { label: 'Benar/Salah', className: 'bg-purple-500/10 text-purple-600' },
  'short-answer': { label: 'Jawaban Singkat', className: 'bg-amber-500/10 text-amber-600' },
  essay: { label: 'Esai', className: 'bg-orange-500/10 text-orange-600' },
  matching: { label: 'Menjodohkan', className: 'bg-teal-500/10 text-teal-600' },
  'fill-blank': { label: 'Isian Rumpang', className: 'bg-cyan-500/10 text-cyan-600' },
};

const DIFFICULTY_META: Record<string, { label: string; className: string }> = {
  easy: { label: 'Mudah', className: 'bg-green-500/10 text-green-600' },
  medium: { label: 'Sedang', className: 'bg-amber-500/10 text-amber-600' },
  hard: { label: 'Sulit', className: 'bg-red-500/10 text-red-600' },
};

const TYPE_OPTIONS: QuestionType[] = [
  'multiple-choice',
  'true-false',
  'short-answer',
  'essay',
  'matching',
  'fill-blank',
];

const DIFFICULTY_OPTIONS: DifficultyLevel[] = ['easy', 'medium', 'hard'];

/** base-ui Select renders the label from `items` instead of the raw value. */
const TYPE_FILTER_ITEMS: Record<string, string> = {
  all: 'Semua tipe',
  ...Object.fromEntries(TYPE_OPTIONS.map((type) => [type, TYPE_META[type]?.label ?? type])),
};

const DIFFICULTY_FILTER_ITEMS: Record<string, string> = {
  all: 'Semua kesulitan',
  ...Object.fromEntries(
    DIFFICULTY_OPTIONS.map((level) => [level, DIFFICULTY_META[level].label]),
  ),
};

function formatDate(value: Date | string | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function answerText(answer: Question['correctAnswer']): string {
  if (Array.isArray(answer)) return answer.join('; ');
  return String(answer ?? '');
}

function isCorrectOption(question: Question, option: string): boolean {
  const answer = question.correctAnswer;
  if (Array.isArray(answer)) return answer.includes(option);
  return String(answer ?? '') === option;
}

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, className: 'bg-muted text-muted-foreground' };
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const meta = DIFFICULTY_META[difficulty] ?? {
    label: difficulty,
    className: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

export default function AdminQuestionsPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  /** Pagination server-side — `total` dari API, bukan panjang halaman. */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [previewing, setPreviewing] = useState<Question | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Filter + pagination dikerjakan server: hanya satu halaman yang diambil,
      // dan `total` memberi jumlah seluruh soal yang cocok.
      const res = await questionsApi.list({
        search: debouncedSearch || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setQuestions(res.questions);
      setTotal(res.total);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal memuat daftar soal';
      setError(message);
      setQuestions([]);
      setTotal(0);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, difficultyFilter, page, pageSize]);

  useEffect(() => {
    if (authLoading) return;
    if (currentUser && currentUser.role !== 'admin') {
      router.push('/login');
      return;
    }
    if (!currentUser?.id) return;
    // Deferred so the effect body does not call setState synchronously
    // (matches the existing teacher pages and keeps react-hooks lint clean).
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [authLoading, currentUser, router, load]);

  const pageQuestions = questions;

  if (authLoading) {
    return (
      <AdminNav>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminNav>
    );
  }

  return (
    <AdminNav>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Semua Soal</h1>
            <p className="text-sm text-muted-foreground">
              Telusuri seluruh bank soal platform dan pratinjau isi soal (hanya baca).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Muat ulang
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Soal</CardTitle>
            <CardDescription>
              {loading
                ? 'Memuat soal…'
                : `${total.toLocaleString('id-ID')} soal di bank soal semua guru`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari judul atau isi soal…"
                  className="h-9 pl-9"
                />
              </div>
              <Select
                items={TYPE_FILTER_ITEMS}
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v ?? 'all');
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="Filter tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua tipe</SelectItem>
                  {TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_META[type]?.label ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={DIFFICULTY_FILTER_ITEMS}
                value={difficultyFilter}
                onValueChange={(v) => {
                  setDifficultyFilter(v ?? 'all');
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Filter kesulitan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua kesulitan</SelectItem>
                  {DIFFICULTY_OPTIONS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {DIFFICULTY_META[level].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Gagal memuat soal</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>{error}</span>
                  <Button variant="outline" size="sm" onClick={() => void load()}>
                    Coba lagi
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !error && questions.length === 0 ? (
              <div className="py-12 text-center">
                <FolderKanban className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Belum ada soal di platform.</p>
              </div>
            ) : !error && questions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Tidak ada soal yang cocok dengan filter saat ini.
                </p>
              </div>
            ) : !error ? (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[280px] max-w-[280px]">Soal</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="hidden md:table-cell">Kesulitan</TableHead>
                        <TableHead className="hidden sm:table-cell">Poin</TableHead>
                        <TableHead className="hidden lg:table-cell">Dibuat</TableHead>
                        <TableHead className="sticky right-0 z-20 w-[90px] border-l border-border bg-card text-right">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageQuestions.map((question) => (
                        <TableRow key={question.id}>
                          <TableCell className="min-w-0 max-w-[280px]">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0">
                                {!isTitleRedundant(question.title, question.content) && (
                                  <p className="truncate font-medium" title={question.title}>
                                    {question.title || '(tanpa judul)'}
                                  </p>
                                )}
                                <p
                                  className="mt-0.5 line-clamp-2 whitespace-normal text-xs text-muted-foreground"
                                  title={question.content}
                                >
                                  {question.content}
                                </p>
                              </div>
                              {((question.images?.length ?? 0) > 0 ||
                                (question.imageUrls?.length ?? 0) > 0) && (
                                <ImageIcon
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                  aria-label="Soal memiliki gambar"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <TypeBadge type={question.type} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <DifficultyBadge difficulty={question.difficulty} />
                          </TableCell>
                          <TableCell className="hidden text-sm sm:table-cell">
                            {question.points}
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                            {formatDate(question.createdAt)}
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 border-l border-border bg-card text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewing(question)}
                              aria-label={`Pratinjau ${question.title}`}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden xl:inline">Lihat</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DataPagination
                  className="border-t border-border pt-4"
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  itemLabel="soal"
                  loading={loading}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Read-only preview */}
      <Dialog open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 text-lg">
              {previewing?.title || 'Pratinjau soal'}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {previewing && <TypeBadge type={previewing.type} />}
              {previewing && <DifficultyBadge difficulty={previewing.difficulty} />}
              {previewing && <Badge variant="outline">{previewing.points} poin</Badge>}
            </DialogDescription>
          </DialogHeader>

          {previewing && (
            <div className="space-y-4">
              <Card className="border-primary/20">
                <CardContent className="space-y-4 p-4">
                  <QuestionStemWithImages
                    content={previewing.content}
                    images={previewing.images}
                    imageUrls={previewing.imageUrls}
                    contentClassName="text-base leading-relaxed"
                  />

                  {previewing.type === 'multiple-choice' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Pilihan jawaban:</p>
                      {previewing.options && previewing.options.length > 0 ? (
                        <div className="space-y-2">
                          {previewing.options.map((option, idx) => {
                            const correct = isCorrectOption(previewing, option);
                            return (
                              <div
                                key={`${idx}-${option}`}
                                className={cn(
                                  'flex items-start gap-3 rounded-lg border p-3',
                                  correct
                                    ? 'border-green-500/50 bg-green-500/10'
                                    : 'border-border bg-muted/30',
                                )}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <MathText
                                    className={cn(
                                      'flex-1',
                                      correct && 'font-medium text-green-700 dark:text-green-400',
                                    )}
                                  >
                                    {option}
                                  </MathText>
                                  <OptionImageDisplay
                                    images={previewing.images}
                                    optionIndex={idx}
                                  />
                                </div>
                                {correct && (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-orange-500/50 bg-orange-500/5 p-4">
                          <p className="text-center text-sm text-muted-foreground">
                            Soal ini belum memiliki opsi jawaban.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {previewing.type === 'true-false' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Pernyataan:</p>
                      <div className="flex gap-3">
                        {['true', 'false'].map((value) => {
                          const correct =
                            value.toLowerCase() === answerText(previewing.correctAnswer).toLowerCase();
                          return (
                            <div
                              key={value}
                              className={cn(
                                'flex-1 rounded-lg border p-3 text-center font-medium',
                                correct
                                  ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
                                  : 'border-border bg-muted/30',
                              )}
                            >
                              {value === 'true' ? 'Benar' : 'Salah'}
                              {correct && (
                                <CheckCircle2 className="ml-2 inline h-4 w-4 text-green-600" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(previewing.type === 'short-answer' || previewing.type === 'essay') && (
                    <p className="text-sm text-muted-foreground">
                      {previewing.type === 'essay'
                        ? 'Siswa mengetik jawaban esai panjang; jawaban ini dinilai manual.'
                        : 'Siswa mengetik jawaban singkat yang dicocokkan dengan kunci.'}
                    </p>
                  )}

                  {previewing.type === 'matching' && (
                    <p className="text-sm text-muted-foreground">
                      Siswa mencocokkan pasangan item pada soal menjodohkan.
                    </p>
                  )}

                  {previewing.type === 'fill-blank' && (
                    <p className="text-sm text-muted-foreground">
                      Siswa mengisi bagian rumpang pada soal isian.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-sm font-medium">Jawaban benar:</span>
                    <MathText className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {answerText(previewing.correctAnswer) || '-'}
                    </MathText>
                  </div>

                  {previewing.type === 'multiple-choice' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Jumlah opsi:</span>
                      <span className="font-medium">{previewing.options?.length ?? 0} opsi</span>
                    </div>
                  )}

                  {previewing.explanation && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Penjelasan:</p>
                      <MathText as="p" className="text-sm text-muted-foreground">
                        {previewing.explanation}
                      </MathText>
                    </div>
                  )}

                  {previewing.tags && previewing.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Tag:</span>
                      {previewing.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 border-t pt-2 text-xs text-muted-foreground">
                    <span>ID: {previewing.id.slice(0, 8)}…</span>
                    <span>Dibuat: {formatDate(previewing.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setPreviewing(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminNav>
  );
}
