import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Angka tampilan: maksimal 2 digit di belakang koma (locale id-ID). */
export function formatNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, maxFractionDigits = 2): string {
  return `${formatNumber(value, maxFractionDigits)}%`;
}

/** Detik aman untuk tampilan (tidak negatif / NaN). */
export function clampSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.floor(seconds));
}

/** Timer ujian MM:SS */
export function formatCountdown(seconds: number): string {
  const s = clampSeconds(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Durasi pengerjaan untuk hasil (mis. "12 menit"). */
export function formatDurationMinutes(seconds: number): string {
  const s = clampSeconds(seconds);
  if (s < 60) return `${s} detik`;
  const mins = Math.max(1, Math.round(s / 60));
  return `${mins} menit`;
}
