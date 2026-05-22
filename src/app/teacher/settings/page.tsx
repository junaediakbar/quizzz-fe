'use client';

import { useState } from 'react';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Lock, Globe, Save, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function TeacherSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Pengaturan disimpan');
    }, 500);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!user) {
    return (
      <TeacherNav>
        <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
          Memuat…
        </div>
      </TeacherNav>
    );
  }

  return (
    <TeacherNav userName={user.name} userAvatar={user.avatar}>
      <div className="flex flex-1 flex-col overflow-auto bg-background">
        <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Pengaturan</h1>
              <p className="text-sm text-muted-foreground">
                Preferensi akun dan keamanan portal instruktur
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <CardTitle>Akun</CardTitle>
              </div>
              <CardDescription>Preferensi tampilan dan bahasa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="language">Bahasa</Label>
                  <select
                    id="language"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="id"
                  >
                    <option value="id">Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona waktu</Label>
                  <select
                    id="timezone"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="asia-jakarta"
                  >
                    <option value="asia-jakarta">UTC+7 (Jakarta)</option>
                    <option value="asia-singapore">UTC+8 (Singapura)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Notifikasi</CardTitle>
              </div>
              <CardDescription>Pilih cara Anda ingin diberi tahu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  title: 'Email',
                  desc: 'Pemberitahuan ujian baru dan hasil siswa',
                },
                {
                  title: 'Pengingat ujian',
                  desc: 'Ingatkan sebelum ujian dimulai',
                },
                {
                  title: 'Hasil ujian',
                  desc: 'Beri tahu saat siswa menyelesaikan ujian',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                <CardTitle>Keamanan</CardTitle>
              </div>
              <CardDescription>Ubah kata sandi akun Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Kata sandi saat ini</Label>
                <Input id="current-password" type="password" autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Kata sandi baru</Label>
                <Input id="new-password" type="password" autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Konfirmasi kata sandi baru</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" />
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => toast.message('Fitur ubah kata sandi akan segera tersedia')}
              >
                Perbarui kata sandi
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              Keluar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                'Menyimpan…'
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan pengaturan
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    </TeacherNav>
  );
}
