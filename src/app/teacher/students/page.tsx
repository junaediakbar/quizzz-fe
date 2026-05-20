'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Search, GraduationCap, MoreVertical, Pencil, Loader2, Mail, User, Plus, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { teacherStudentsApi } from '@/lib/api/teacher-students';
import type { User as AppUser } from '@/lib/types';
import { toast } from 'sonner';

function formatJoined(d: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export default function TeacherStudentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [students, setStudents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', avatar: '', password: '' });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!user?.id || user.role !== 'teacher') {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await teacherStudentsApi.list({ search: debounced || undefined });
      setStudents(res.students);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat siswa');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, debounced]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', avatar: '', password: '' });
    setCreateOpen(true);
  };

  const openEdit = (s: AppUser) => {
    setEditing(s);
    setForm({
      name: s.name,
      email: s.email,
      avatar: s.avatar || '',
      password: '',
    });
    setEditOpen(true);
  };

  const openDelete = (s: AppUser) => {
    setDeleting(s);
    setDeleteOpen(true);
  };

  const saveCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nama dan email wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await teacherStudentsApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim() || undefined,
      });
      toast.success('Siswa berhasil ditambahkan');
      setCreateOpen(false);
      setForm({ name: '', email: '', avatar: '', password: '' });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah siswa');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nama dan email wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await teacherStudentsApi.update(editing.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        avatar: form.avatar.trim() || null,
      });
      toast.success('Data siswa diperbarui');
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await teacherStudentsApi.delete(deleting.id);
      toast.success('Siswa berhasil dihapus');
      setDeleteOpen(false);
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus');
    } finally {
      setSaving(false);
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

  if (!user || user.role !== 'teacher') {
    return (
      <TeacherNav>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-muted-foreground max-w-md">
            Manajemen siswa hanya untuk akun guru. Hubungi admin jika Anda memerlukan akses.
          </p>
          <Button variant="outline" asChild>
            <Link href="/login">Kembali</Link>
          </Button>
        </div>
      </TeacherNav>
    );
  }

  return (
    <TeacherNav userName={user.name} userAvatar={user.avatar}>
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Manajemen siswa</h1>
                <p className="text-sm text-muted-foreground">
                  Tambah, lihat, sunting, atau hapus data siswa.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit shrink-0">
                {loading ? '…' : `${students.length} siswa`}
              </Badge>
              <Button onClick={openCreate} size="sm" className="gap-1.5 touch-manipulation">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Tambah siswa</span>
                <span className="sm:hidden">Tambah</span>
              </Button>
            </div>
          </div>

          <div className="relative mt-4 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-10 text-base sm:text-sm"
              autoComplete="off"
            />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <Card className="hidden overflow-hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="hidden lg:table-cell">Terdaftar</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-muted-foreground">{s.email}</TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                              {formatJoined(s.createdAt)}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 touch-manipulation">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(s)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openDelete(s)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Hapus
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {students.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        {search ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Belum ada siswa.'}
                      </p>
                      {!search && (
                        <Button onClick={openCreate} variant="outline" size="sm" className="gap-1.5">
                          <Plus className="h-4 w-4" />
                          Tambah siswa pertama
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {students.map((s) => (
                  <Card key={s.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="font-medium leading-tight">{s.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-all">{s.email}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Bergabung {formatJoined(s.createdAt)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 touch-manipulation">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(s)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDelete(s)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {students.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {search ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Belum ada siswa.'}
                    </p>
                    {!search && (
                      <Button onClick={openCreate} variant="outline" size="sm" className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Tambah siswa
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Tambah siswa baru
            </DialogTitle>
            <DialogDescription>
              Buat akun siswa baru. Password default akan dikirim ke email jika tidak diisi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="create-name">Nama</Label>
              <Input
                id="create-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5"
                placeholder="Nama lengkap siswa"
              />
            </div>
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1.5"
                placeholder="siswa@sekolah.id"
              />
            </div>
            <div>
              <Label htmlFor="create-password">Password (opsional)</Label>
              <Input
                id="create-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1.5"
                placeholder="Default: student123"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kosongkan untuk menggunakan password default: <code>student123</code>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveCreate} disabled={saving} className="touch-manipulation">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buat akun'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Edit siswa
            </DialogTitle>
            <DialogDescription>
              Perbarui profil kontak. Peran akun tetap siswa; kata sandi tidak diubah di sini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="st-name">Nama</Label>
              <Input
                id="st-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="st-email">Email</Label>
              <Input
                id="st-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="st-avatar">URL avatar (opsional)</Label>
              <Input
                id="st-avatar"
                value={form.avatar}
                onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))}
                placeholder="https://…"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="touch-manipulation">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus siswa?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus <strong>{deleting?.name}</strong> ({deleting?.email}).
              Tindakan ini tidak dapat dibatalkan. Data ujian dan hasil siswa ini akan tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 touch-manipulation"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ya, hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherNav>
  );
}
