'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  BrainCircuit,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Search,
  User,
  GraduationCap,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/students', label: 'Students', icon: GraduationCap },
  { href: '/teacher/questions', label: 'Question Bank', icon: FolderKanban },
  { href: '/teacher/parser', label: 'AI Parser', icon: BrainCircuit },
  { href: '/teacher/exams', label: 'My Exams', icon: FileText },
  { href: '/teacher/results', label: 'Results', icon: BarChart3 },
  { href: '/teacher/settings', label: 'Settings', icon: Settings },
];

interface TeacherNavProps {
  userName?: string;
  userAvatar?: string;
  children?: React.ReactNode;
}

export function TeacherNav({ userName, userAvatar, children }: TeacherNavProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const displayName = userName || user?.name || 'Teacher';
  const displayEmail = user?.email || 'teacher@quizzz.com';

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
    return label;
  };

  return (
    <div className="flex min-h-[100dvh] md:h-screen md:max-h-screen bg-background">
      {/* Sidebar — desktop only */}
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

        {/* User */}
        <div className="p-2 sm:p-4 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 sm:gap-3 px-3 sm:px-4 h-auto py-2.5 hover:bg-muted/80">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left hidden sm:block">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground">Teacher</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/teacher/profile')}>
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/teacher/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 touch-manipulation">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/teacher/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/teacher/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Mobile bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden safe-area-pb"
        aria-label="Primary"
      >
        <div className="scrollbar-none flex h-[4.25rem] items-stretch gap-0.5 overflow-x-auto px-2 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-[4.75rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium touch-manipulation',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground active:bg-muted'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="max-w-[4.5rem] truncate text-center leading-tight">
                  {shortMobileLabel(item.label)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
