'use client';

import { MathText } from '@/components/shared/math-text';
import { cn } from '@/lib/utils';

type MathPreviewProps = {
  value: string;
  label?: string;
  className?: string;
  emptyHint?: string;
};

/** Preview LaTeX di bawah field edit (parser, bank soal, dll.). */
export function MathPreview({ value, label = 'Preview', className, emptyHint }: MathPreviewProps) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    if (!emptyHint) return null;
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground',
          className
        )}
      >
        {emptyHint}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-border bg-muted/30 px-3 py-2',
        className
      )}
    >
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <MathText className="text-sm leading-relaxed">{trimmed}</MathText>
    </div>
  );
}
