'use client';

import { useEffect, useState } from 'react';
import { TeacherNav } from '@/components/shared/teacher-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Loader2, Lock, Globe, Save, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';

// Preferences the backend does not model are stored on this device only.
const SETTINGS_KEY = 'quizapp_settings_teacher';

type TeacherSettings = {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    examReminder: boolean;
    examResults: boolean;
  };
};

const DEFAULT_SETTINGS: TeacherSettings = {
  language: 'id',
  timezone: 'asia-jakarta',
  notifications: { email: true, examReminder: true, examResults: true },
};

const NOTIFICATION_ITEMS = [
  {
    key: 'email',
    title: 'Email',
    desc: 'Pemberitahuan ujian baru dan hasil siswa',
  },
  {
    key: 'examReminder',
    title: 'Pengingat ujian',
    desc: 'Ingatkan sebelum ujian dimulai',
  },
  {
    key: 'examResults',
    title: 'Hasil ujian',
    desc: 'Beri tahu saat siswa menyelesaikan ujian',
  },
] as const;

const readSettings = (): TeacherSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TeacherSettings>;
    return {
      language: parsed.language ?? DEFAULT_SETTINGS.language,
      timezone: parsed.timezone ?? DEFAULT_SETTINGS.timezone,
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...(parsed.notifications ?? {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export default function TeacherSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<TeacherSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Re-read device preferences on mount so they survive a reload. Deferred one
  // microtask so the server HTML and the hydration pass agree on the defaults.
  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (active) setSettings(readSettings());
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      // Yield one frame so the saving indicator is actually visible.
      await new Promise((resolve) => setTimeout(resolve, 200));
      toast.success('Pengaturan disimpan di perangkat ini');
    } catch {
      toast.error('Gagal menyimpan pengaturan di perangkat ini');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Kata sandi saat ini dan kata sandi baru wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Kata sandi baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi baru tidak cocok');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Kata sandi berhasil diperbarui');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui kata sandi');
    } finally {
      setIsChangingPassword(false);
    }
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
                    value={settings.language}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, language: e.target.value }))
                    }
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
                    value={settings.timezone}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, timezone: e.target.value }))
                    }
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
              {NOTIFICATION_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={settings.notifications[item.key]}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          [item.key]: e.target.checked,
                        },
                      }))
                    }
                  />
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
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Kata sandi baru</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Konfirmasi kata sandi baru</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memperbarui…
                  </>
                ) : (
                  'Perbarui kata sandi'
                )}
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
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan…
                </>
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
