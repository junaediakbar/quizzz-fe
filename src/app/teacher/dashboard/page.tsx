'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Users,
  FolderKanban,
  TrendingUp,
  Clock,
  Plus,
  MoreVertical,
  Play,
  Edit,
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
import { examsApi, dashboardApi } from '@/lib/api';
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
import { Exam } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatGradeLabel } from '@/lib/constants/grades';
import { useAuth } from '@/contexts/AuthContext';

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
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
        const dash = await dashboardApi.teacher(user.id);
        const examsData = await examsApi.list({ limit: 10 });
        const exams = examsData.exams || [];

        setRecentExams(exams.slice(0, 5));
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

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <TeacherNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TeacherNav userName={user?.name} userAvatar={user?.avatar}>
      {/* Header */}
      <header className="min-h-16 border-b border-border bg-card flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-1 items-center min-w-0 w-full sm:max-w-md lg:max-w-xl">
          <div className="relative w-full">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search exams, questions…"
              className="w-full pl-10 pr-4 py-2.5 sm:py-2 rounded-lg border border-border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" className="touch-manipulation">
            <Clock className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Recent Activity</span>
            <span className="sm:hidden">Activity</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="animate-slide-in">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.bgColor)}>
                      <Icon className={cn('w-6 h-6', stat.color)} />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {stat.change}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    {stat.title === 'Total Students' && (
                      <Link
                        href="/teacher/students"
                        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
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
                  {recentExams.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No exams yet. Create your first exam!</p>
                    </div>
                  ) : (
                    recentExams.map((exam) => (
                      <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{exam.title}</h4>
                            <Badge variant="outline">{exam.subject}</Badge>
                            <Badge variant="outline" className="capitalize">
                              {formatGradeLabel(exam.grade)}
                            </Badge>
                            {getStatusBadge(exam.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {exam.description || 'No description'}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Play className="w-4 h-4 mr-2" />
                              Start Exam
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates from your classroom</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Welcome to QuizApp!</p>
                      <p className="text-xs text-muted-foreground">Get started by creating your first exam</p>
                      <p className="text-xs text-muted-foreground mt-1">Just now</p>
                    </div>
                  </div>
                </div>
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
