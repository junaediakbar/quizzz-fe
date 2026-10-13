'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/shared/admin-nav';
import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/shared/data-pagination';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { usersApi } from '@/lib/api/users';
import { User, UserRole } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react';

const PAGE_SIZE = 10;

const ROLE_META: Record<UserRole, { label: string; className: string }> = {
  admin: { label: 'Admin', className: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  teacher: { label: 'Guru', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  student: { label: 'Siswa', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
};

const ROLE_OPTIONS: UserRole[] = ['student', 'teacher', 'admin'];

/** base-ui Select renders the label from `items` instead of the raw value. */
const ROLE_FILTER_ITEMS: Record<string, string> = {
  all: 'Semua peran',
  ...Object.fromEntries(ROLE_OPTIONS.map((role) => [role, ROLE_META[role].label])),
};

const ROLE_ITEMS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((role) => [role, ROLE_META[role].label]),
);

function formatDate(value: Date | string | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role] ?? ROLE_META.student;
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  /** Pagination server-side — `total` dari API, bukan panjang halaman. */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; role: UserRole }>({
    name: '',
    email: '',
    role: 'student',
  });
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list({
        role: roleFilter === 'all' ? undefined : roleFilter,
        search: debouncedSearch || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal memuat daftar pengguna';
      setError(message);
      setUsers([]);
      setTotal(0);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, debouncedSearch, page, pageSize]);

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

  const pageUsers = users;

  const openEdit = (target: User) => {
    setEditing(target);
    setEditForm({ name: target.name, email: target.email, role: target.role });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = editForm.name.trim();
    const email = editForm.email.trim();
    if (!name) {
      toast.error('Nama tidak boleh kosong');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email tidak valid');
      return;
    }

    setSaving(true);
    try {
      const updated = await usersApi.update(editing.id, { name, email, role: editForm.role });
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`Pengguna "${updated.name}" berhasil diperbarui`);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memperbarui pengguna');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (deleting.id === currentUser?.id) {
      toast.error('Anda tidak dapat menghapus akun Anda sendiri');
      setDeleteOpen(false);
      return;
    }
    setDeletingBusy(true);
    try {
      await usersApi.delete(deleting.id);
      setUsers((list) => list.filter((u) => u.id !== deleting.id));
      toast.success(`Pengguna "${deleting.name}" berhasil dihapus`);
      setDeleteOpen(false);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus pengguna');
    } finally {
      setDeletingBusy(false);
    }
  };

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
            <h1 className="text-xl font-semibold">Manajemen Pengguna</h1>
            <p className="text-sm text-muted-foreground">
              Kelola semua akun platform: ubah nama, email, peran, atau hapus akun.
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
            <CardTitle>Daftar Pengguna</CardTitle>
            <CardDescription>
              {loading
                ? 'Memuat pengguna…'
                : `${total.toLocaleString('id-ID')} pengguna terdaftar`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari nama atau email…"
                  className="h-9 pl-9"
                />
              </div>
              <Select
                items={ROLE_FILTER_ITEMS}
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter((v ?? 'all') as 'all' | UserRole);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua peran</SelectItem>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_META[role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Gagal memuat pengguna</AlertTitle>
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
            ) : !error && users.length === 0 ? (
              <div className="py-12 text-center">
                <UsersIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Belum ada pengguna terdaftar.</p>
              </div>
            ) : !error && users.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Tidak ada pengguna yang cocok dengan filter saat ini.
                </p>
              </div>
            ) : !error ? (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pengguna</TableHead>
                        <TableHead>Peran</TableHead>
                        <TableHead className="hidden sm:table-cell">Terdaftar</TableHead>
                        <TableHead className="w-[110px] text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageUsers.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-xs font-semibold text-purple-600">
                                  {u.name.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {u.name}
                                    {isSelf && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        (Anda)
                                      </span>
                                    )}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <RoleBadge role={u.role} />
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                              {formatDate(u.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEdit(u)}
                                  aria-label={`Ubah ${u.name}`}
                                  title="Ubah pengguna"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  disabled={isSelf}
                                  onClick={() => {
                                    setDeleting(u);
                                    setDeleteOpen(true);
                                  }}
                                  aria-label={`Hapus ${u.name}`}
                                  title={
                                    isSelf ? 'Tidak dapat menghapus akun sendiri' : 'Hapus pengguna'
                                  }
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
                </div>

                <DataPagination
                  className="border-t border-border pt-4"
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  itemLabel="pengguna"
                  loading={loading}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah pengguna</DialogTitle>
            <DialogDescription>
              Perubahan disimpan melalui PUT /api/v1/users/{editing?.id.slice(0, 8) ?? ''}…
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-user-name">Nama</Label>
              <Input
                id="admin-user-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama lengkap"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-email">Email</Label>
              <Input
                id="admin-user-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="nama@sekolah.id"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Peran</Label>
              <Select
                items={ROLE_ITEMS}
                value={editForm.role}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, role: (v ?? 'student') as UserRole }))
                }
              >
                <SelectTrigger className="w-full" disabled={saving}>
                  <SelectValue placeholder="Pilih peran" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_META[role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => !open && !deletingBusy && setDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun <strong>{deleting?.name}</strong> ({deleting?.email}) akan dihapus permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy ? 'Menghapus…' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminNav>
  );
}
