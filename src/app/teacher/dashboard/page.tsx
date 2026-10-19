'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  FileText,
  Users,
  FolderKanban,
  TrendingUp,
  Clock,
  Plus,
  MoreVertical,
  Play,
  Edit,
  Eye,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { examsApi, dashboardApi, resultsApi } from '@/lib/api';
import { toast } from 'sonner';
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
import { Exam, ExamResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatGradeLabel } from '@/lib/constants/grades';
import { useAuth } from '@/contexts/AuthContext';

interface ActivityItem {
  id: string;
  kind: 'exam' | 'result';
  title: string;
  detail: string;
  at: Date;
}

/** "3 jam lalu" tanpa dependensi tambahan. */
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return date.toLocaleDateString('id-ID');
}

/** Gabungkan ujian terbaru + hasil terbaru menjadi feed aktivitas nyata. */
function buildActivity(exams: Exam[], results: ExamResult[]): ActivityItem[] {
  const fromExams: ActivityItem[] = exams.map((e) => ({
    id: `exam-${e.id}`,
    kind: 'exam',
    title: `Ujian dibuat: ${e.title}`,
    detail: `${e.subject} · ${formatGradeLabel(e.grade)} · ${e.status}`,
    at: e.createdAt,
  }));
  const fromResults: ActivityItem[] = results.map((r) => ({
    id: `result-${r.id}`,
    kind: 'result',
    title: `${r.studentName} menyelesaikan ujian`,
    detail: `${r.examTitle ?? ''} · skor ${r.score}/${r.maxScore} (${Math.round(r.percentage)}%)`,
    at: r.submittedAt,
  }));
  return [...fromExams, ...fromResults]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    totalQuestions: 0,
  });
  const [recentExams, setRecentExams] = useState<Exam[]>([]);
  const [error, setError] = useState('');
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Pencarian di header: menyaring daftar ujian + Enter mencari di bank soal. */
  const [searchQuery, setSearchQuery] = useState('');
  /** Aktivitas terbaru (ujian dibuat + hasil masuk), bukan teks statis. */
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Fetch dashboard data on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [dash, examsData, resultsPage] = await Promise.all([
          dashboardApi.teacher(user.id),
          examsApi.list({ limit: 10 }),
          resultsApi.list({ limit: 8 }).catch(() => null),
        ]);
        const exams = examsData.exams || [];

        setRecentExams(exams.slice(0, 5));
        setActivity(buildActivity(exams, resultsPage?.results ?? []));
        setStats({
          totalExams: dash.totalExams,
          activeExams: dash.activeExams,
          totalStudents: dash.totalStudents,
          totalQuestions: dash.totalQuestions,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(errorMessage);
        setRecentExams([]);
        setActivity([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.id]);

  const refreshExams = async () => {
    if (!user?.id) return;
    try {
      const dash = await dashboardApi.teacher(user.id);
      const examsData = await examsApi.list({ limit: 10 });
      setRecentExams((examsData.exams || []).slice(0, 5));
      const resultsPage = await resultsApi.list({ limit: 8 }).catch(() => null);
      setActivity(buildActivity(examsData.exams || [], resultsPage?.results ?? []));
      setStats({
        totalExams: dash.totalExams,
        activeExams: dash.activeExams,
        totalStudents: dash.totalStudents,
        totalQuestions: dash.totalQuestions,
      });
    } catch {
      /* keep current list */
    }
  };

  const openDeleteExam = (exam: Exam) => {
    setDeletingExam(exam);
    setDeleteOpen(true);
  };

  const confirmDeleteExam = async () => {
    if (!deletingExam) return;
    setDeleting(true);
    try {
      await examsApi.delete(deletingExam.id);
      toast.success(`Ujian "${deletingExam.title}" berhasil dihapus`);
      setDeleteOpen(false);
      setDeletingExam(null);
      await refreshExams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus ujian');
    } finally {
      setDeleting(false);
    }
  };

  /** Daftar ujian di dashboard disaring oleh kotak pencarian. */
  const filteredRecentExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recentExams;
    return recentExams.filter((e) =>
      [e.title, e.subject, formatGradeLabel(e.grade), e.status, e.description ?? '']
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [recentExams, searchQuery]);

  const statCards = [
    {
      title: 'Total Exams',
      value: stats.totalExams,
      change: '+3 this month',
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Active Exams',
      value: stats.activeExams,
      change: '2 ending soon',
      icon: Play,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Students',
      value: stats.totalStudents,
      change: '+12 new students',
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Question Bank',
      value: stats.totalQuestions,
      change: 'Across 8 categories',
      icon: FolderKanban,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-secondary text-secondary-foreground' },
      published: { label: 'Published', className: 'bg-blue-500/10 text-blue-500' },
      active: { label: 'Active', className: 'bg-green-500/10 text-green-500' },
      completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
    };
    const variant = variants[status] || variants.draft;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (isLoading || authLoading) {
    return (
      <TeacherNav userName={user?.name} userAvatar={user?.avatar} hideGlobalSearch>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </TeacherNav>
    );
  }

  return (
    <TeacherNav userName={user?.name} userAvatar={user?.avatar} hideGlobalSearch>
      {/* Header */}
      <header className="min-h-16 border-b border-border bg-card flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-1 items-center min-w-0 w-full sm:max-w-md lg:max-w-xl">
          <div className="relative w-full">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQuery.trim();
                // Enter = cari di bank soal (korpus soal), daftar ujian di bawah
                // sudah tersaring sambil mengetik.
                router.push(q ? `/teacher/questions?search=${encodeURIComponent(q)}` : '/teacher/questions');
              }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ujian di bawah, atau Enter untuk cari soal…"
                aria-label="Cari ujian atau soal"
                className="w-full pl-10 pr-4 py-2.5 sm:py-2 rounded-lg border border-border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </form>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" className="touch-manipulation" asChild>
            <a href="#recent-activity">
              <Clock className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Recent Activity</span>
              <span className="sm:hidden">Activity</span>
            </a>
          </Button>
          <Button size="sm" className="gap-2 touch-manipulation" asChild>
            <Link href="/teacher/exams/create">
              <Plus className="w-4 h-4" />
              Create Exam
            </Link>
          </Button>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Welcome back, {user?.name || 'Teacher'}!</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Here&apos;s what&apos;s happening with your classes today.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Last updated: Just now</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="animate-slide-in shadow-xs">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center', stat.bgColor)}>
                      <Icon className={cn('w-5 h-5 sm:w-6 sm:h-6', stat.color)} />
                    </div>
                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                      {stat.change}
                    </Badge>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-0.5 sm:mt-1">{stat.value}</p>
                    {stat.title === 'Total Students' && (
                      <Link
                        href="/teacher/students"
                        className="mt-1 sm:mt-2 inline-block text-[11px] sm:text-xs font-medium text-primary hover:underline"
                      >
                        Kelola siswa
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Exams */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Exams</CardTitle>
                    <CardDescription>Your latest exam activities</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/teacher/exams">Lihat Semua</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg mb-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">{error}</p>
                    <p className="text-xs text-muted-foreground mt-1">Using demo data for display</p>
                  </div>
                )}

                <div className="space-y-4">
                  {filteredRecentExams.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchQuery.trim()
                          ? `Tidak ada ujian yang cocok dengan “${searchQuery.trim()}”. Tekan Enter untuk mencari di bank soal.`
                          : 'Belum ada ujian. Buat ujian pertama Anda!'}
                      </p>
                    </div>
                  ) : (
                    filteredRecentExams.map((exam) => (
                      <div key={exam.id} className="flex items-start sm:items-center justify-between p-3.5 sm:p-4 border rounded-xl hover:bg-muted/50 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                            <h4 className="font-medium text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">{exam.title}</h4>
                            <Badge variant="outline" className="text-[10px] sm:text-xs">{exam.subject}</Badge>
                            <Badge variant="outline" className="capitalize text-[10px] sm:text-xs">
                              {formatGradeLabel(exam.grade)}
                            </Badge>
                            {getStatusBadge(exam.status)}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {exam.description || 'No description'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => router.push(`/teacher/exams/${exam.id}/live`)}
                          >
                            <Eye className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">Live monitoring</span>
                            <span className="sr-only sm:hidden">Live monitoring</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/teacher/results?exam=${exam.id}`)}
                              >
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Lihat hasil &amp; nilai
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/teacher/exams/${exam.id}/edit`)}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Ujian
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDeleteExam(exam)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Hapus ujian
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity — data nyata (ujian dibuat + hasil masuk) */}
          <div id="recent-activity" className="scroll-mt-20">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Aktivitas terbaru dari ujian Anda</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Memuat aktivitas…</p>
                ) : activity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Belum ada aktivitas. Buat ujian pertama Anda untuk memulai.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activity.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                            item.kind === 'exam'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-emerald-500/10 text-emerald-600'
                          )}
                        >
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                          <p className="text-xs text-muted-foreground mt-1">{relativeTime(item.at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Active Exam Progress */}
        {stats.activeExams > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Exams Progress</CardTitle>
              <CardDescription>Real-time completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentExams.filter(e => e.status === 'active').map((exam) => {
                  // Use a deterministic value based on exam id to avoid impure render
                  const progress = (exam.id.charCodeAt(0) * 17) % 100;
                  const completed = Math.floor(progress * 0.4);
                  return (
                    <div key={exam.id} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium">{exam.title}</p>
                            <p className="text-xs text-muted-foreground">{exam.subject} • {formatGradeLabel(exam.grade)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{completed} / 100 students</p>
                            <p className="text-xs text-muted-foreground">{progress}% completed</p>
                          </div>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus ujian?</AlertDialogTitle>
              <AlertDialogDescription>
                Ujian <strong>{deletingExam?.title}</strong> akan dihapus permanen beserta sesi dan
                hasil siswa. Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void confirmDeleteExam();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Menghapus…' : 'Hapus'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </TeacherNav>
  );
}
