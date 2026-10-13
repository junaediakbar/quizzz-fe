'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bell,
  Loader2,
  Lock,
  Globe,
  Save,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';

// Preferences the backend does not model are stored on this device only.
const SETTINGS_KEY = 'quizapp_settings_student';

type StudentSettings = {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    examReminders: boolean;
    resultNotifications: boolean;
  };
};

const DEFAULT_SETTINGS: StudentSettings = {
  language: 'en',
  timezone: 'asia-jakarta',
  notifications: { email: true, examReminders: true, resultNotifications: true },
};

const NOTIFICATION_ITEMS = [
  {
    key: 'email',
    title: 'Email Notifications',
    desc: 'Receive email updates about your exams',
  },
  {
    key: 'examReminders',
    title: 'Exam Reminders',
    desc: 'Get reminded before exams start',
  },
  {
    key: 'resultNotifications',
    title: 'Result Notifications',
    desc: 'Notify when exam results are available',
  },
] as const;

const readSettings = (): StudentSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StudentSettings>;
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

export default function StudentSettingsPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<StudentSettings>(DEFAULT_SETTINGS);
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
      toast.error('Current password and new password are required');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password confirmation does not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      <div className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/student/dashboard')}>
            ← Kembali
          </Button>
          <h1 className="truncate text-xl font-bold">Pengaturan</h1>
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {/* Account Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <CardTitle>Account Settings</CardTitle>
            </div>
            <CardDescription>Manage your account preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <select
                  id="language"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.language}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, language: e.target.value }))
                  }
                >
                  <option value="en">English</option>
                  <option value="id">Indonesian</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                >
                  <option value="asia-jakarta">UTC+7 (Jakarta)</option>
                  <option value="asia-singapore">UTC+8 (Singapore)</option>
                </select>
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
            <CardDescription>Choose how you want to be notified</CardDescription>
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

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage your password and security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
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
              className="w-full"
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={handleLogout}>
            Logout
          </Button>
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
    </>
  );
}
