'use client';

import { useMemo } from 'react';
import { buildMathHtml } from '@/lib/math-text';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';

type MathTextProps = {
  children: string;
  className?: string;
  as?: 'p' | 'span' | 'div';
};

export function MathText({ children, className, as: Tag = 'span' }: MathTextProps) {
  const html = useMemo(() => buildMathHtml(children), [children]);

  if (!children) return null;

  return (
    <Tag
      className={cn(
        'math-text [&_.katex]:text-[1em]',
        Tag === 'p' && 'whitespace-pre-wrap',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
