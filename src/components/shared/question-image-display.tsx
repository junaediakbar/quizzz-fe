'use client';

import { MathText } from '@/components/shared/math-text';
import {
  imagesForPosition,
  type QuestionImage,
  type QuestionImagePosition,
} from '@/lib/question-images';
import { cn } from '@/lib/utils';

function ImageRow({ urls, className }: { urls: QuestionImage[]; className?: string }) {
  if (!urls.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {urls.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${img.position}-${img.optionIndex ?? ''}-${img.url}`}
          src={img.url}
          alt=""
          className="max-h-48 max-w-full rounded-md border border-border object-contain bg-background shadow-sm"
          loading="lazy"
        />
      ))}
    </div>
  );
}

interface QuestionImageDisplayProps {
  images?: QuestionImage[];
  /** Legacy: semua URL tanpa posisi → dianggap below */
  imageUrls?: string[];
  className?: string;
}

export function QuestionImageDisplay({ images, imageUrls, className }: QuestionImageDisplayProps) {
  const resolved =
    images && images.length > 0
      ? images
      : (imageUrls ?? []).map((url) => ({ url, position: 'below' as const }));

  if (!resolved.length) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <ImageRow urls={imagesForPosition(resolved, 'above')} />
      <ImageRow urls={imagesForPosition(resolved, 'below')} />
      <ImageRow urls={imagesForPosition(resolved, 'after')} />
    </div>
  );
}

export function OptionImageDisplay({
  images,
  optionIndex,
  className,
}: {
  images?: QuestionImage[];
  optionIndex: number;
  className?: string;
}) {
  const row = imagesForPosition(images, 'option', optionIndex);
  return <ImageRow urls={row} className={cn('mt-2', className)} />;
}

/**
 * True bila judul hanya menyalin (awal) isi soal — mis. hasil AI yang mengisi
 * "title" dengan teks soal itu sendiri. Judul seperti itu tidak dirender ulang
 * supaya soal tidak terlihat ganda.
 */
export function isTitleRedundant(title?: string, content?: string): boolean {
  if (!title || !content) return false;
  const norm = (v: string) =>
    v
      .replace(/\s+/g, ' ')
      .replace(/…$/, '')
      .trim()
      .toLowerCase();
  const t = norm(title);
  const c = norm(content);
  if (!t || !c) return false;
  if (t === c) return true;
  return t.length >= 20 && c.startsWith(t);
}

export function QuestionStemWithImages({
  title,
  content,
  images,
  imageUrls,
  titleClassName,
  contentClassName,
}: {
  title?: string;
  content?: string;
  images?: QuestionImage[];
  imageUrls?: string[];
  titleClassName?: string;
  contentClassName?: string;
}) {
  const resolved =
    images && images.length > 0
      ? images
      : (imageUrls ?? []).map((url) => ({ url, position: 'below' as const }));

  const above = imagesForPosition(resolved, 'above');
  const below = imagesForPosition(resolved, 'below');
  const after = imagesForPosition(resolved, 'after');

  // Jangan tampilkan judul yang isinya sama dengan soal (penyebab "soal ganda").
  const showTitle = !!title && !isTitleRedundant(title, content);

  return (
    <>
      {showTitle ? (
        <h2 className={titleClassName}>
          <MathText as="span">{title}</MathText>
        </h2>
      ) : null}
      <ImageRow urls={above} className={showTitle ? 'mt-3' : undefined} />
      {content ? <MathText as="p" className={contentClassName}>{content}</MathText> : null}
      <ImageRow urls={below} className={content || showTitle ? 'mt-4' : undefined} />
      <ImageRow urls={after} className="mt-4" />
    </>
  );
}

export function filterImagesByPosition(
  images: QuestionImage[] | undefined,
  position: QuestionImagePosition
) {
  return imagesForPosition(images, position);
}
