'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { examsApi } from '@/lib/api';
import { Exam } from '@/lib/types';
import { formatGradeLabel } from '@/lib/constants/grades';
import { withSecurityEnabled } from '@/lib/exam-security';
import { useAuth } from '@/contexts/AuthContext';
import { Edit, FileText, Loader2, MoreVertical, Plus, Shield, ShieldOff, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

function getStatusBadge(status: string) {
  const variants: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draf', className: 'bg-secondary text-secondary-foreground' },
    published: { label: 'Dipublikasikan', className: 'bg-blue-500/10 text-blue-500' },
    active: { label: 'Aktif', className: 'bg-green-500/10 text-green-500' },
    completed: { label: 'Selesai', className: 'bg-muted text-muted-foreground' },
    archived: { label: 'Arsip', className: 'bg-muted text-muted-foreground' },
  };
  const variant = variants[status] || variants.draft;
  return <Badge className={variant.className}>{variant.label}</Badge>;
}

export default function TeacherExamsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Exam | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await examsApi.list({ limit: 200 });
      setExams(data.exams);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat daftar ujian');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.id) {
      void load();
    }
  }, [authLoading, user?.id, load]);

  const openDelete = (exam: Exam) => {
    setDeleting(exam);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await examsApi.delete(deleting.id);
      toast.success(`Ujian "${deleting.title}" berhasil dihapus`);
      setDeleteOpen(false);
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus ujian');
    } finally {
      setSaving(false);
    }
  };

  const toggleSecurity = async (exam: Exam, enabled: boolean) => {
    setTogglingId(exam.id);
    const prev = exam.config.securityEnabled;
    const nextConfig = withSecurityEnabled(exam.config, enabled);

    setExams((list) =>
      list.map((e) => (e.id === exam.id ? { ...e, config: nextConfig } : e))
    );

    try {
      const updated = await examsApi.update(exam.id, { config: nextConfig });
      setExams((list) => list.map((e) => (e.id === exam.id ? updated : e)));
      toast.success(
        enabled
          ? `Keamanan diaktifkan untuk "${exam.title}"`
          : `Keamanan dinonaktifkan untuk "${exam.title}"`
      );
    } catch (e) {
      setExams((list) =>
        list.map((item) =>
          item.id === exam.id
            ? { ...item, config: { ...item.config, securityEnabled: prev } }
            : item
        )
      );
      toast.error(e instanceof Error ? e.message : 'Gagal memperbarui pengaturan keamanan');
    } finally {
      setTogglingId(null);
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

  return (
    <TeacherNav userName={user?.name} userAvatar={user?.avatar}>
      <header className="border-b border-border bg-card px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Ujian Saya</h1>
          <p className="text-sm text-muted-foreground">Kelola, edit, dan hapus ujian yang telah dibuat</p>
        </div>
        <Button asChild>
          <Link href="/teacher/exams/create">
            <Plus className="w-4 h-4 mr-2" />
            Buat Ujian
          </Link>
        </Button>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Ujian</CardTitle>
            <CardDescription>
              Aktifkan atau nonaktifkan mode keamanan per ujian. Menghapus ujian juga menghapus
              sesi siswa dan hasil terkait.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Belum ada ujian.</p>
                <Button asChild>
                  <Link href="/teacher/exams/create">Buat ujian pertama</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="flex items-start justify-between gap-3 p-4 border rounded-lg hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{exam.title}</h3>
                        {getStatusBadge(exam.status)}
                        <Badge variant="outline">{exam.subject}</Badge>
                        <Badge variant="outline">{formatGradeLabel(exam.grade)}</Badge>
                      </div>
                      {exam.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{exam.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {exam.questionCount ?? exam.questions?.length ?? 0} soal · Dibuat{' '}
                        {exam.createdAt.toLocaleDateString('id-ID')}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {exam.config.securityEnabled ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 gap-1">
                            <Shield className="h-3 w-3" />
                            Keamanan aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <ShieldOff className="h-3 w-3" />
                            Mode standar
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        {togglingId === exam.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground hidden sm:inline">Keamanan</span>
                        <Switch
                          checked={exam.config.securityEnabled}
                          disabled={togglingId === exam.id}
                          onCheckedChange={(v) => void toggleSecurity(exam, v)}
                          aria-label={`Keamanan ${exam.title}`}
                        />
                      </div>
                      <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/teacher/exams/${exam.id}/edit`)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit ujian
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => openDelete(exam)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Hapus ujian
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus ujian?</AlertDialogTitle>
            <AlertDialogDescription>
              Ujian <strong>{deleting?.title}</strong> akan dihapus permanen, termasuk sesi pengerjaan
              dan hasil siswa. Tindakan ini tidak dapat dibatalkan.
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
