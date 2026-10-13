'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Loader2,
  Lock,
  Globe,
  Database,
  Save,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Platform preferences are not modelled by the backend; they live on this device.
const SETTINGS_KEY = 'quizapp_settings_admin';

type AdminSettings = {
  siteName: string;
  siteUrl: string;
  siteDescription: string;
  sessionTimeout: string;
  maxLoginAttempts: string;
  passwordMinLength: string;
  passwordExpiry: string;
  backupFrequency: string;
  retentionPeriod: string;
  notifications: {
    email: boolean;
    newUserRegistration: boolean;
    examCompletion: boolean;
  };
};

const DEFAULT_SETTINGS: AdminSettings = {
  siteName: 'QuizApp',
  siteUrl: 'https://quizzz.com',
  siteDescription: 'Online Examination Platform for educational institutions',
  sessionTimeout: '60',
  maxLoginAttempts: '5',
  passwordMinLength: '8',
  passwordExpiry: '90',
  backupFrequency: '24',
  retentionPeriod: '365',
  notifications: { email: true, newUserRegistration: true, examCompletion: true },
};

const NOTIFICATION_ITEMS = [
  {
    key: 'email',
    title: 'Email Notifications',
    desc: 'Send email notifications for important events',
  },
  {
    key: 'newUserRegistration',
    title: 'New User Registration',
    desc: 'Notify when new users register',
  },
  {
    key: 'examCompletion',
    title: 'Exam Completion Alerts',
    desc: 'Notify when exams are completed',
  },
] as const;

const readSettings = (): AdminSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...(parsed.notifications ?? {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  /** Status API diambil dari endpoint /health (bukan teks statis). */
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

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

  // Cek kesehatan API sungguhan; database tidak diekspos oleh endpoint publik.
  useEffect(() => {
    let active = true;
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace(/\/api\/v1\/?$/, '');
    fetch(`${base}/health`)
      .then((r) => (active ? setApiStatus(r.ok ? 'online' : 'offline') : undefined))
      .catch(() => {
        if (active) setApiStatus('offline');
      });
    return () => {
      active = false;
    };
  }, []);

  const setField = (field: keyof AdminSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

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

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      toast.message('Pengaturan dikembalikan ke bawaan (disimpan di perangkat ini)');
    } catch {
      toast.error('Gagal mengembalikan pengaturan bawaan');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin/dashboard')}>
                ← Back
              </Button>
              <h1 className="text-xl font-bold">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <CardTitle>General Settings</CardTitle>
            </div>
            <CardDescription>Configure platform-wide settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">Site Name</Label>
                <Input
                  id="site-name"
                  value={settings.siteName}
                  onChange={(e) => setField('siteName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-url">Site URL</Label>
                <Input
                  id="site-url"
                  value={settings.siteUrl}
                  onChange={(e) => setField('siteUrl', e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="site-description">Site Description</Label>
                <Input
                  id="site-description"
                  value={settings.siteDescription}
                  onChange={(e) => setField('siteDescription', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <CardTitle>Security Settings</CardTitle>
            </div>
            <CardDescription>Manage security policies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) => setField('sessionTimeout', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
                <Input
                  id="max-login-attempts"
                  type="number"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => setField('maxLoginAttempts', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-min-length">Min Password Length</Label>
                <Input
                  id="password-min-length"
                  type="number"
                  value={settings.passwordMinLength}
                  onChange={(e) => setField('passwordMinLength', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-expiry">Password Expiry (days)</Label>
                <Input
                  id="password-expiry"
                  type="number"
                  value={settings.passwordExpiry}
                  onChange={(e) => setField('passwordExpiry', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle>Notification Settings</CardTitle>
            </div>
            <CardDescription>Configure system notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {NOTIFICATION_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 border rounded-lg"
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
            </div>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              <CardTitle>Database Settings</CardTitle>
            </div>
            <CardDescription>Manage database configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Status API Backend</p>
                <p className="text-sm text-muted-foreground">
                  {apiStatus === 'checking'
                    ? 'Memeriksa…'
                    : apiStatus === 'online'
                      ? 'Endpoint /health merespons'
                      : 'Tidak dapat menghubungi backend'}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  apiStatus === 'online'
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : apiStatus === 'offline'
                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : 'bg-muted text-muted-foreground'
                }
              >
                {apiStatus === 'checking' ? 'Memeriksa…' : apiStatus === 'online' ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Status database tidak diekspos melalui API publik; pantau lewat dashboard Neon.
              Pengaturan di halaman ini hanya tersimpan di perangkat ini (localStorage).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="backup-frequency">Backup Frequency (hours)</Label>
                <Input
                  id="backup-frequency"
                  type="number"
                  value={settings.backupFrequency}
                  onChange={(e) => setField('backupFrequency', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention-period">Data Retention (days)</Label>
                <Input
                  id="retention-period"
                  type="number"
                  value={settings.retentionPeriod}
                  onChange={(e) => setField('retentionPeriod', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleReset}>Reset to Defaults</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
