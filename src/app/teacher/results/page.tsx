'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  TrendingUp,
  Users,
  Search,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Loader2,
} from 'lucide-react';
import { cn, formatDurationMinutes, formatPercent } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { examsApi, resultsApi } from '@/lib/api';
import { Exam, ExamResult } from '@/lib/types';
import { toast } from 'sonner';

type PassFilter = 'all' | 'passed' | 'failed';

const SCORE_BUCKETS = [
  { key: '90-100', min: 90, max: 100, label: '90–100%' },
  { key: '80-89', min: 80, max: 89.99, label: '80–89%' },
  { key: '70-79', min: 70, max: 79.99, label: '70–79%' },
  { key: '60-69', min: 60, max: 69.99, label: '60–69%' },
  { key: 'below-60', min: 0, max: 59.99, label: 'Di bawah 60%' },
] as const;

interface QuestionStatRow {
  questionId: string;
  questionTitle: string;
  correctRate: number;
  total: number;
}

export default function TeacherResultsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionStats, setQuestionStats] = useState<QuestionStatRow[]>([]);
  const [loadingQuestionStats, setLoadingQuestionStats] = useState(false);

  const [selectedExam, setSelectedExam] = useState('all');
  const [passFilter, setPassFilter] = useState<PassFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<ExamResult | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [resList, examList] = await Promise.all([
      resultsApi.list(),
      examsApi.list({ limit: 200 }),
    ]);
    setResults(resList);
    setExams(examList.exams);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat hasil ujian');
      setResults([]);
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    if (!authLoading && user?.id) void load();
  }, [authLoading, user?.id, load]);

  const openDelete = (result: ExamResult) => {
    setDeleting(result);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await resultsApi.delete(deleting.id);
      toast.success(`Hasil ${deleting.studentName} berhasil dihapus`);
      setDeleteOpen(false);
      setDeleting(null);
      await fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus hasil');
    } finally {
      setSaving(false);
    }
  };

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchesExam = selectedExam === 'all' || r.examId === selectedExam;
      const matchesPass =
        passFilter === 'all' ||
        (passFilter === 'passed' && r.passed) ||
        (passFilter === 'failed' && !r.passed);
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.studentName.toLowerCase().includes(q) ||
        (r.examTitle ?? '').toLowerCase().includes(q);
      return matchesExam && matchesPass && matchesSearch;
    });
  }, [results, selectedExam, passFilter, searchQuery]);

  const analytics = useMemo(() => {
    const n = filteredResults.length;
    if (n === 0) {
      return {
        totalSubmissions: 0,
        averageScore: 0,
        passRate: 0,
        highestScore: 0,
        lowestScore: 0,
        averageTimeMin: 0,
      };
    }
    const pcts = filteredResults.map((r) => r.percentage);
    const passed = filteredResults.filter((r) => r.passed).length;
    const totalTime = filteredResults.reduce((sum, r) => sum + r.timeSpent, 0);
    return {
      totalSubmissions: n,
      averageScore: Math.round(pcts.reduce((a, b) => a + b, 0) / n),
      passRate: Math.round((passed / n) * 100),
      highestScore: Math.round(Math.max(...pcts)),
      lowestScore: Math.round(Math.min(...pcts)),
      averageTimeMin: Math.round(totalTime / n / 60),
    };
  }, [filteredResults]);

  const scoreDistribution = useMemo(() => {
    const n = filteredResults.length;
    if (n === 0) return [];
    return SCORE_BUCKETS.map((bucket) => {
      const count = filteredResults.filter(
        (r) => r.percentage >= bucket.min && r.percentage <= bucket.max
      ).length;
      return {
        ...bucket,
        count,
        percentage: Math.round((count / n) * 100),
      };
    });
  }, [filteredResults]);

  useEffect(() => {
    if (selectedExam === 'all') {
      setQuestionStats([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingQuestionStats(true);
      try {
        const examResults = results.filter((r) => r.examId === selectedExam);
        const sample = examResults.slice(0, 40);
        const details = await Promise.all(sample.map((r) => resultsApi.get(r.id)));

        if (cancelled) return;

        const agg = new Map<
          string,
          { title: string; correct: number; total: number }
        >();

        for (const detail of details) {
          for (const ans of detail.answers) {
            const id = ans.questionId;
            const title = ans.question?.title ?? `Soal ${id.slice(0, 8)}`;
            const cur = agg.get(id) ?? { title, correct: 0, total: 0 };
            cur.total += 1;
            if (ans.isCorrect && !ans.pendingReview) cur.correct += 1;
            agg.set(id, cur);
          }
        }

        const rows: QuestionStatRow[] = [...agg.entries()].map(([questionId, v]) => ({
          questionId,
          questionTitle: v.title,
          correctRate: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
          total: v.total,
        }));
        rows.sort((a, b) => a.correctRate - b.correctRate);
        setQuestionStats(rows);
      } catch {
        if (!cancelled) setQuestionStats([]);
      } finally {
        if (!cancelled) setLoadingQuestionStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExam, results]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500/10';
    if (percentage >= 60) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
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

  return (
    <TeacherNav userName={user?.name} userAvatar={user?.avatar}>
      <header className="border-b border-border bg-card px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hasil & Analitik Ujian</h1>
          <p className="text-sm text-muted-foreground">
            Data langsung dari pengumpulan hasil siswa
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pengumpulan</p>
                  <p className="text-xl font-bold">{analytics.totalSubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rata-rata nilai</p>
                  <p className="text-xl font-bold text-green-500">
                    {formatPercent(analytics.averageScore)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Award className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tingkat lulus</p>
                  <p className="text-xl font-bold">{formatPercent(analytics.passRate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tertinggi</p>
                  <p className="text-xl font-bold">{formatPercent(analytics.highestScore)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rata-rata waktu</p>
                  <p className="text-xl font-bold">{analytics.averageTimeMin} mnt</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="results" className="space-y-4">
          <TabsList>
            <TabsTrigger value="results">Hasil Siswa</TabsTrigger>
            <TabsTrigger value="analytics">Analitik Soal</TabsTrigger>
            <TabsTrigger value="distribution">Distribusi Nilai</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Hasil Siswa</CardTitle>
                <CardDescription>
                  Semua hasil ujian dari ujian yang Anda buat
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama siswa atau ujian..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedExam} onValueChange={(v) => setSelectedExam(v ?? 'all')}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Filter ujian" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua ujian</SelectItem>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={passFilter}
                    onValueChange={(v) => setPassFilter((v ?? 'all') as PassFilter)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Kelulusan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="passed">Lulus</SelectItem>
                      <SelectItem value="failed">Tidak lulus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    {results.length === 0
                      ? 'Belum ada siswa yang menyelesaikan ujian.'
                      : 'Tidak ada hasil yang cocok dengan filter.'}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Siswa</TableHead>
                        <TableHead>Ujian</TableHead>
                        <TableHead>Nilai</TableHead>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Dikumpulkan</TableHead>
                        <TableHead>Kelulusan</TableHead>
                        <TableHead className="w-[100px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => {
                        return (
                          <TableRow key={result.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center',
                                    getScoreBgColor(result.percentage)
                                  )}
                                >
                                  {result.passed ? (
                                    <CheckCircle2
                                      className={cn('w-4 h-4', getScoreColor(result.percentage))}
                                    />
                                  ) : (
                                    <XCircle
                                      className={cn('w-4 h-4', getScoreColor(result.percentage))}
                                    />
                                  )}
                                </div>
                                <span className="font-medium">{result.studentName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{result.examTitle ?? '—'}</span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p
                                  className={cn('font-semibold', getScoreColor(result.percentage))}
                                >
                                  {result.score}/{result.maxScore}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatPercent(result.percentage)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {formatDurationMinutes(result.timeSpent)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {result.submittedAt.toLocaleString('id-ID', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={result.passed ? 'default' : 'destructive'}
                                className={result.passed ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                              >
                                {result.passed ? 'Lulus' : 'Tidak lulus'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                  <Link href={`/student/results/${result.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => openDelete(result)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analitik per Soal</CardTitle>
                <CardDescription>
                  Pilih satu ujian di filter tab Hasil Siswa untuk melihat tingkat benar per soal
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedExam === 'all' ? (
                  <p className="text-center text-muted-foreground py-10">
                    Pilih ujian tertentu pada filter untuk memuat analitik soal.
                  </p>
                ) : loadingQuestionStats ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : questionStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">
                    Belum ada data jawaban untuk ujian ini.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Soal</TableHead>
                        <TableHead>Tingkat benar</TableHead>
                        <TableHead>Respon</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questionStats.map((q) => (
                        <TableRow key={q.questionId}>
                          <TableCell className="font-medium max-w-md truncate">
                            {q.questionTitle}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={q.correctRate} className="w-24 h-2" />
                              <span className="text-sm">{formatPercent(q.correctRate)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {q.total} siswa
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribusi Nilai</CardTitle>
                <CardDescription>
                  Berdasarkan hasil yang sedang difilter ({filteredResults.length} siswa)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">Tidak ada data.</p>
                ) : (
                  <div className="space-y-4">
                    {scoreDistribution.map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">{item.count} siswa</span>
                            <span className="font-semibold">{item.percentage}%</span>
                          </div>
                        </div>
                        <Progress
                          value={item.percentage}
                          className={cn(
                            'h-3',
                            item.key === '90-100' || item.key === '80-89'
                              ? '[&>div]:bg-green-500'
                              : item.key === '70-79' || item.key === '60-69'
                                ? '[&>div]:bg-yellow-500'
                                : '[&>div]:bg-red-500'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus hasil ujian?</AlertDialogTitle>
            <AlertDialogDescription>
              Hasil <strong>{deleting?.studentName}</strong> untuk ujian{' '}
              <strong>{deleting?.examTitle}</strong> akan dihapus permanen. Siswa dapat
              mengerjakan ujian ini lagi dari awal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Menghapus…' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherNav>
  );
}
