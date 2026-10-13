'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Dimensi default; harus konsisten dengan default di API (`limit` kosong = semua). */
export const DEFAULT_PAGE_SIZE = 20;

export interface DataPaginationProps {
  /** Halaman saat ini, 1-based. */
  page: number;
  pageSize: number;
  /** Total baris di server (bukan panjang halaman). */
  total: number;
  /** Kata benda untuk label, mis. "soal", "pengguna". */
  itemLabel?: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

/**
 * Pagination server-side yang dipakai semua tabel/list besar.
 * `total` berasal dari field `total` API (bukan `count`, yang berarti panjang halaman).
 */
export function DataPagination({
  page,
  pageSize,
  total,
  itemLabel = 'data',
  loading = false,
  onPageChange,
  onPageSizeChange,
  className,
}: DataPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  // Jendela nomor halaman di sekitar halaman aktif (maks 5 tombol).
  const windowSize = 5;
  let start = Math.max(1, safePage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? `Tidak ada ${itemLabel}`
          : `Menampilkan ${from}–${to} dari ${total.toLocaleString('id-ID')} ${itemLabel}`}
        {loading ? ' · memuat…' : ''}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Per halaman</span>
            <Select
              items={Object.fromEntries(PAGE_SIZE_OPTIONS.map((n) => [String(n), String(n)]))}
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v) || DEFAULT_PAGE_SIZE)}
            >
              <SelectTrigger className="h-8 w-[70px] text-xs" aria-label="Jumlah baris per halaman">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage <= 1 || loading}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pages.map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === safePage ? 'default' : 'outline'}
              size="sm"
              className="h-8 min-w-8 px-2 text-xs"
              disabled={loading}
              onClick={() => onPageChange(p)}
              aria-current={p === safePage ? 'page' : undefined}
            >
              {p}
            </Button>
          ))}

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= totalPages || loading}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
