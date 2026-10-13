'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  FileText,
  Shield,
  Activity,
  Settings,
  ChevronRight,
  LogOut,
  User,
  Loader2,
  FolderKanban,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { examsApi, questionsApi, resultsApi } from '@/lib/api';
import { usersApi } from '@/lib/api/users';
import { toast } from 'sonner';

interface AdminStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalExams: number;
  activeExams: number;
  totalQuestions: number;
  totalResults: number;
}

interface RecentExam {
  id: string;
  title: string;
  subject: string;
  status: string;
  createdAt: Date;
}

/** "3 menit lalu" tanpa dependensi tambahan. */
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

interface AdminSummary {
  stats: AdminStats;
  recent: RecentExam[];
}

/** Ringkas data mentah menjadi statistik + daftar ujian terbaru (fungsi murni). */
function summarizeAdminData(
  users: { role: string }[],
  exams: { id: string; title: string; subject: string; status: string; createdAt: Date }[],
  questionCount: number,
  resultCount: number,
): AdminSummary {
  return {
    stats: {
      totalUsers: users.length,
      totalTeachers: users.filter((u) => u.role === 'teacher').length,
      totalStudents: users.filter((u) => u.role === 'student').length,
      totalExams: exams.length,
      activeExams: exams.filter((e) => e.status === 'published' || e.status === 'active').length,
      totalQuestions: questionCount,
      totalResults: resultCount,
    },
    recent: [...exams]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.subject,
        status: e.status,
        createdAt: e.createdAt,
      })),
  };
}

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTeachers: 0,
    totalStudents: 0,
    totalExams: 0,
    activeExams: 0,
    totalQuestions: 0,
    totalResults: 0,
  });
  const [recentExams, setRecentExams] = useState<RecentExam[]>([]);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/login');
    }
  }, [user, router]);

  /** Tombol "Muat ulang" (event handler — setState sinkron tidak masalah). */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, examsRes, questionsRes, resultsRes] = await Promise.all([
        usersApi.list(),
        examsApi.list(),
        questionsApi.list(),
        resultsApi.list(),
      ]);
      const summary = summarizeAdminData(
        usersRes.users,
        examsRes.exams ?? [],
        questionsRes.questions.length,
        resultsRes.total,
      );
      setStats(summary.stats);
      setRecentExams(summary.recent);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat statistik platform');
    } finally {
      setLoading(false);
    }
  }, []);

  // Muat saat halaman dibuka: setState hanya di dalam callback .then/.catch.
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    let cancelled = false;
    Promise.all([usersApi.list(), examsApi.list(), questionsApi.list(), resultsApi.list()])
      .then(([usersRes, examsRes, questionsRes, resultsRes]) => {
        if (cancelled) return;
        const summary = summarizeAdminData(
          usersRes.users,
          examsRes.exams ?? [],
          questionsRes.questions.length,
          resultsRes.total,
        );
        setStats(summary.stats);
        setRecentExams(summary.recent);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : 'Gagal memuat statistik platform');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const statCards = [
    {
      label: 'Total Pengguna',
      value: stats.totalUsers,
      hint: `${stats.totalTeachers} guru · ${stats.totalStudents} murid`,
      icon: Users,
      className: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'Total Ujian',
      value: stats.totalExams,
      hint: 'Seluruh ujian di platform',
      icon: FileText,
      className: 'bg-green-500/10 text-green-500',
    },
    {
      label: 'Total Soal',
      value: stats.totalQuestions,
      hint: 'Bank soal semua guru',
      icon: Activity,
      className: 'bg-purple-500/10 text-purple-500',
    },
    {
      label: 'Ujian Aktif',
      value: stats.activeExams,
      hint: 'Berstatus published/active',
      icon: Shield,
      className: 'bg-orange-500/10 text-orange-500',
    },
  ];

  const quickActions = [
    {
      title: 'Kelola Pengguna',
      description: 'Lihat, ubah peran, dan hapus akun',
      href: '/admin/users',
      icon: Users,
      className: 'bg-blue-500/10 text-blue-500',
    },
    {
      title: 'Bank Soal',
      description: 'Telusuri soal dari semua guru',
      href: '/admin/questions',
      icon: FolderKanban,
      className: 'bg-purple-500/10 text-purple-500',
    },
    {
      title: 'Semua Ujian',
      description: 'Pantau status dan hasil ujian',
      href: '/admin/exams',
      icon: FileText,
      className: 'bg-green-500/10 text-green-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">Kelola platform</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Muat ulang</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Menu akun">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-purple-500/10 text-purple-500">
                        {user?.name?.charAt(0).toUpperCase() || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name || 'Admin'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email || 'admin@quizzz.com'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/admin/profile')}>
                    <User className="w-4 h-4 mr-2" />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Pengaturan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Selamat datang, {user?.name || 'Admin'}!</h2>
          <p className="text-muted-foreground mt-1">
            Ringkasan platform diambil langsung dari data saat ini.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-3xl font-bold mt-2">
                      {loading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        card.value
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{card.hint}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.className}`}>
                    <card.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Aksi Cepat</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.href}
                onClick={() => router.push(action.href)}
                className="hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.className}`}
                    >
                      <action.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent exams — data nyata dari database */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Ujian Terbaru</CardTitle>
                <CardDescription>{stats.totalResults} hasil ujian tercatat di platform</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/admin/exams')}>
                Lihat semua
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentExams.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada ujian di platform.
              </p>
            ) : (
              <div className="space-y-3">
                {recentExams.map((exam) => (
                  <div
                    key={exam.id}
                    onClick={() => router.push(`/teacher/exams/${exam.id}/edit`)}
                    className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.subject} · {relativeTime(exam.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize shrink-0">
                      {exam.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
