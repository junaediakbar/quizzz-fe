'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  BrainCircuit,
  FileText,
  BarChart3,
  ImagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Bell,
  Search,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAccountMenu } from '@/components/shared/user-account-menu';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/students', label: 'Students', icon: GraduationCap },
  { href: '/teacher/questions', label: 'Question Bank', icon: FolderKanban },
  { href: '/teacher/parser', label: 'AI Parser', icon: BrainCircuit },
  { href: '/teacher/media', label: 'Upload Gambar', icon: ImagePlus },
  { href: '/teacher/exams', label: 'My Exams', icon: FileText },
  { href: '/teacher/results', label: 'Results', icon: BarChart3 },
  { href: '/teacher/settings', label: 'Settings', icon: Settings },
];

interface TeacherNavProps {
  userName?: string;
  userAvatar?: string;
  children?: React.ReactNode;
}

export function TeacherNav({ userName, children }: TeacherNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName = userName || user?.name || 'Teacher';
  void displayName;

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setSidebarHidden(window.localStorage.getItem('quizapp_teacher_sidebar_hidden') === '1');
      } catch {
        setSidebarHidden(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarHidden((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('quizapp_teacher_sidebar_hidden', next ? '1' : '0');
      }
      return next;
    });
  }, []);

  const navLinkClass = (href: string) => {
    const isActive = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
    return cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
      isActive
        ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100'
        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
    );
  };

  const shortMobileLabel = (label: string) => {
    if (label === 'Question Bank') return 'Bank';
    if (label === 'AI Parser') return 'AI';
    if (label === 'My Exams') return 'Exams';
    if (label === 'Students') return 'Siswa';
    if (label === 'Upload Gambar') return 'Upload';
    return label;
  };

  return (
    <div className="flex min-h-[100dvh] md:h-screen md:max-h-screen bg-background">
      {/* Sidebar — desktop only */}
      {!sidebarHidden && (
        <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col z-50 shrink-0">
          <div className="p-4 sm:p-6 border-b border-sidebar-border">
            <Link href="/teacher/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold ring-1 ring-border">
                EP
              </div>
              <div className="min-w-0">
                <p className="font-bold text-indigo-950 dark:text-indigo-100 text-lg leading-tight tracking-tight">
                  Instructor Portal
                </p>
                <p className="text-xs text-muted-foreground">Academic Integrity Suite</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-2 sm:p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                  <Icon className="w-5 h-5 shrink-0 opacity-90" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User — sidebar */}
          <div className="p-2 sm:p-4 border-t border-border">
            <UserAccountMenu
              profileHref="/teacher/profile"
              settingsHref="/teacher/settings"
              avatarFallbackClassName="bg-primary/10 text-primary font-semibold"
              className="w-full justify-start px-3 sm:px-4"
            />
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
        {/* Mobile header */}
        <header className="md:hidden shrink-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-sm">
          <Link href="/teacher/dashboard" className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              EP
            </div>
            <span className="truncate text-sm font-semibold">Instructor</span>
          </Link>
          <UserAccountMenu
            profileHref="/teacher/profile"
            settingsHref="/teacher/settings"
            avatarFallbackClassName="bg-primary/10 text-primary font-semibold"
            variant="icon"
          />
        </header>

        {/* Desktop — avatar kanan atas */}
        <header className="hidden md:flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-4 sm:px-6 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={toggleSidebar}
            aria-label={sidebarHidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          >
            {sidebarHidden ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
          <UserAccountMenu
            profileHref="/teacher/profile"
            settingsHref="/teacher/settings"
            avatarFallbackClassName="bg-primary/10 text-primary font-semibold"
            variant="icon"
          />
        </header>

        {children || (
          <>
            {/* Default Header */}
            <header className="h-14 sm:h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4 flex-1">
                <div className="relative w-full max-w-[200px] sm:max-w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-10 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full ring-2 ring-card" />
                </Button>
              </div>
            </header>

            {/* Default Page Content */}
            <main className="flex-1 overflow-auto p-4 sm:p-6" />
          </>
        )}
      </div>

      {/* Mobile bottom navigation (4 Primary Tabs + 1 'Lainnya' Menu Sheet) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden safe-area-pb"
        aria-label="Teacher Primary Navigation"
      >
        <div className="grid grid-cols-5 h-16 px-1">
          <Link
            href="/teacher/dashboard"
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium touch-manipulation transition-colors',
              pathname === '/teacher/dashboard' ? 'text-primary font-bold' : 'text-muted-foreground'
            )}
          >
            <div className={cn('flex h-7 w-12 items-center justify-center rounded-full', pathname === '/teacher/dashboard' && 'bg-primary/15')}>
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <span className="truncate">Beranda</span>
          </Link>

          <Link
            href="/teacher/exams"
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium touch-manipulation transition-colors',
              pathname.startsWith('/teacher/exams') ? 'text-primary font-bold' : 'text-muted-foreground'
            )}
          >
            <div className={cn('flex h-7 w-12 items-center justify-center rounded-full', pathname.startsWith('/teacher/exams') && 'bg-primary/15')}>
              <FileText className="h-5 w-5" />
            </div>
            <span className="truncate">Ujian</span>
          </Link>

          <Link
            href="/teacher/questions"
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium touch-manipulation transition-colors',
              pathname.startsWith('/teacher/questions') ? 'text-primary font-bold' : 'text-muted-foreground'
            )}
          >
            <div className={cn('flex h-7 w-12 items-center justify-center rounded-full', pathname.startsWith('/teacher/questions') && 'bg-primary/15')}>
              <FolderKanban className="h-5 w-5" />
            </div>
            <span className="truncate">Bank Soal</span>
          </Link>

          <Link
            href="/teacher/results"
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium touch-manipulation transition-colors',
              pathname.startsWith('/teacher/results') ? 'text-primary font-bold' : 'text-muted-foreground'
            )}
          >
            <div className={cn('flex h-7 w-12 items-center justify-center rounded-full', pathname.startsWith('/teacher/results') && 'bg-primary/15')}>
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="truncate">Hasil</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium touch-manipulation text-muted-foreground active:scale-95"
          >
            <div className="flex h-7 w-12 items-center justify-center rounded-full">
              <Menu className="h-5 w-5" />
            </div>
            <span className="truncate">Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile More Sheet / Dialog */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="max-w-md w-[92vw] sm:max-w-lg p-5 rounded-2xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-base font-semibold font-heading">Menu Fitur Guru</DialogTitle>
            <DialogDescription className="text-xs">
              Akses cepat ke alat AI, media, dan manajemen siswa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2.5 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all active:scale-[0.98]',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card hover:bg-muted/50 text-foreground'
                  )}
                >
                  <div className={cn('p-2 rounded-lg', isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
