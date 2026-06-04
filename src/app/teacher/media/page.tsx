'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { mediaApi } from '@/lib/api/media';
import { useAuth } from '@/contexts/AuthContext';
import { Copy, ImagePlus, Loader2, Trash2 } from 'lucide-react';

function fileFromBlob(blob: Blob, nameHint = 'clipboard') {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  return new File([blob], `${nameHint}-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
}

async function readClipboardImageFile(): Promise<File | null> {
  if (typeof navigator === 'undefined') return null;
  if (!('clipboard' in navigator)) return null;
  if (!('read' in navigator.clipboard)) return null;

  const items = await navigator.clipboard.read();
  for (const item of items) {
    for (const type of item.types) {
      if (!type.startsWith('image/')) continue;
      const blob = await item.getType(type);
      return fileFromBlob(blob, 'clipboard');
    }
  }
  return null;
}

export default function TeacherMediaUploadPage() {
  const { user, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [localFile, setLocalFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  const previewUrl = useMemo(() => {
    if (!localFile) return '';
    return URL.createObjectURL(localFile);
  }, [localFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const setFile = useCallback((file: File | null) => {
    setUploadedUrl('');
    setLocalFile(file);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Pilih gambar (JPG, PNG, WebP, …)');
        return;
      }
      setUploading(true);
      try {
        const res = await mediaApi.upload(file);
        setUploadedUrl(res.url);
        toast.success('Upload berhasil — URL siap disalin');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload gagal');
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const onChooseFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    setFile(file);
  }, [setFile]);

  const onPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((it) => it.type.startsWith('image/'));
      if (!imageItem) {
        const text = e.clipboardData?.getData('text/plain')?.trim();
        if (text?.startsWith('data:image/')) {
          try {
            const blob = await (await fetch(text)).blob();
            const file = fileFromBlob(blob, 'pasted');
            setFile(file);
            toast.success('Gambar dari clipboard terdeteksi');
          } catch {
            toast.error('Clipboard berisi Data URL, tapi gagal dibaca');
          }
        } else {
          toast.error('Clipboard tidak berisi gambar');
        }
        return;
      }
      const file = imageItem.getAsFile();
      if (!file) {
        toast.error('Gagal membaca gambar dari clipboard');
        return;
      }
      setFile(file);
      toast.success('Gambar dari clipboard terdeteksi');
    },
    [setFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0] ?? null;
      if (!file) return;
      setFile(file);
    },
    [setFile]
  );

  const copyUrl = useCallback(async () => {
    if (!uploadedUrl) return;
    try {
      await navigator.clipboard.writeText(uploadedUrl);
      toast.success('URL disalin ke clipboard');
    } catch {
      toast.error('Gagal menyalin URL');
    }
  }, [uploadedUrl]);

  const pasteFromClipboardButton = useCallback(async () => {
    try {
      const file = await readClipboardImageFile();
      if (!file) {
        toast.error('Tidak ada gambar di clipboard');
        return;
      }
      setFile(file);
      toast.success('Gambar dari clipboard terdeteksi');
    } catch {
      toast.error('Browser menolak akses clipboard');
    }
  }, [setFile]);

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
      <div className="flex flex-1 flex-col overflow-auto bg-background">
        <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Upload Gambar</h1>
              <p className="text-sm text-muted-foreground">
                Tempel dari clipboard (Ctrl/⌘+V), drag & drop, atau pilih file — lalu dapatkan link gambar.
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Sumber Gambar</CardTitle>
              <CardDescription>Klik area di bawah lalu paste, atau gunakan tombol paste/choose.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                tabIndex={0}
                onPaste={onPaste}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="rounded-xl border border-dashed border-border bg-muted/20 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">Tempel / Drop di sini</p>
                    <p className="text-sm text-muted-foreground">
                      Clipboard harus berisi gambar (hasil screenshot, copy image, dsb.)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={pasteFromClipboardButton}
                      disabled={uploading}
                    >
                      Paste dari Clipboard
                    </Button>
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      Pilih File…
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onChooseFile}
                    />
                  </div>
                </div>
              </div>

              {localFile && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">File:</span> {localFile.name} ({Math.round(localFile.size / 1024)} KB)
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setFile(null)} disabled={uploading}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Hapus
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    {previewUrl ? (
                      <div className="relative h-[22rem] w-full bg-black/5">
                        <Image src={previewUrl} alt="Preview" fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <div className="p-6 text-sm text-muted-foreground">Preview tidak tersedia</div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => void upload(localFile)} disabled={uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Mengunggah…
                        </>
                      ) : (
                        'Upload ke Cloudinary'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFile(null)}
                      disabled={uploading}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link Gambar</CardTitle>
              <CardDescription>Setelah upload, link HTTPS akan muncul di sini.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input value={uploadedUrl} readOnly placeholder="Belum ada link…" />
                <Button type="button" variant="outline" onClick={() => void copyUrl()} disabled={!uploadedUrl}>
                  <Copy className="h-4 w-4 mr-2" />
                  Salin
                </Button>
              </div>
              {uploadedUrl && (
                <a
                  className="text-sm text-primary underline underline-offset-2 break-all"
                  href={uploadedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {uploadedUrl}
                </a>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </TeacherNav>
  );
}
