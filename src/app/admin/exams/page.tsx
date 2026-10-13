'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/shared/admin-nav';
import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/shared/data-pagination';
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
import { examsApi } from '@/lib/api/exams';
import { Exam } from '@/lib/types';
import { formatGradeLabel } from '@/lib/constants/grades';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-react';

const PAGE_SIZE = 10;

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draf', className: 'bg-secondary text-secondary-foreground' },
  published: { label: 'Dipublikasikan', className: 'bg-blue-500/10 text-blue-600' },
  active: { label: 'Aktif', className: 'bg-green-500/10 text-green-600' },
  completed: { label: 'Selesai', className: 'bg-muted text-muted-foreground' },
  archived: { label: 'Arsip', className: 'bg-muted text-muted-foreground' },
};

const STATUS_OPTIONS = ['draft', 'published', 'active', 'completed', 'archived'] as const;

/** base-ui Select renders the label from `items` instead of the raw value. */
const STATUS_FILTER_ITEMS: Record<string, string> = {
  all: 'Semua status',
  ...Object.fromEntries(STATUS_OPTIONS.map((status) => [status, STATUS_META[status].label])),
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

function formatDate(value: Date | string | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminExamsPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  /** Pagination server-side — `total` dari API, bukan panjang halaman. */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Filter + pagination dikerjakan server.
      const data = await examsApi.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: debouncedSearch || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setExams(data.exams);
      setTotal(data.total);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal memuat daftar ujian';
      setError(message);
      setExams([]);
      setTotal(0);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, page, pageSize]);

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

  const pageExams = exams;

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
            <h1 className="text-xl font-semibold">Semua Ujian</h1>
            <p className="text-sm text-muted-foreground">
              Daftar seluruh ujian di platform beserta status dan jumlah soalnya.
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
            <CardTitle>Daftar Ujian</CardTitle>
            <CardDescription>
              {loading
                ? 'Memuat ujian…'
                : `${total.toLocaleString('id-ID')} ujian di platform`}
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
                  placeholder="Cari judul, mapel, atau kelas…"
                  className="h-9 pl-9"
                />
              </div>
              <Select
                items={STATUS_FILTER_ITEMS}
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v ?? 'all');
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_META[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Gagal memuat ujian</AlertTitle>
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
            ) : !error && exams.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Belum ada ujian di platform.</p>
              </div>
            ) : !error && exams.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Tidak ada ujian yang cocok dengan filter saat ini.
                </p>
              </div>
            ) : !error ? (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ujian</TableHead>
                        <TableHead className="hidden md:table-cell">Mapel</TableHead>
                        <TableHead className="hidden md:table-cell">Kelas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Soal</TableHead>
                        <TableHead className="hidden lg:table-cell">Dibuat</TableHead>
                        <TableHead className="w-[150px] text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageExams.map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell className="min-w-0 max-w-[320px]">
                            <p className="truncate font-medium" title={exam.title}>
                              {exam.title}
                            </p>
                            {exam.description && (
                              <p className="truncate text-xs text-muted-foreground">
                                {exam.description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline">{exam.subject || '-'}</Badge>
                          </TableCell>
                          <TableCell className="hidden text-sm md:table-cell">
                            {formatGradeLabel(exam.grade) || '-'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={exam.status} />
                          </TableCell>
                          <TableCell className="hidden text-sm lg:table-cell">
                            {exam.questionCount ?? exam.questions?.length ?? 0}
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                            {formatDate(exam.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                title="Lihat & nilai hasil ujian ini"
                              >
                                <Link href={`/teacher/results?exam=${exam.id}`}>
                                  <BarChart3 className="h-4 w-4" />
                                  <span className="hidden xl:inline">Hasil</span>
                                </Link>
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/teacher/exams/${exam.id}/edit`}>
                                  <Pencil className="h-4 w-4" />
                                  <span className="hidden xl:inline">Edit</span>
                                </Link>
                              </Button>
                            </div>
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
                  itemLabel="ujian"
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

        <p className="text-xs text-muted-foreground">
          Catatan: halaman hasil guru belum mendukung filter per ujian melalui URL, jadi tombol
          “Hasil” membuka halaman hasil dan Anda memilih ujiannya di sana. Tombol “Edit” membuka
          editor ujian milik guru.
        </p>
      </div>
    </AdminNav>
  );
}
