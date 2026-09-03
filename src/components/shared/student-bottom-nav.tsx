'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Award, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const studentNavItems = [
  { href: '/student/dashboard', label: 'Beranda', icon: LayoutDashboard },
  { href: '/student/results', label: 'Hasil Ujian', icon: Award },
  { href: '/student/profile', label: 'Profil', icon: User },
  { href: '/student/settings', label: 'Pengaturan', icon: Settings },
];

export function StudentBottomNav() {
  const pathname = usePathname();

  // Do not show bottom nav if in exam session (handled by /exam/[id])
  if (pathname.startsWith('/exam/')) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden safe-area-pb"
      aria-label="Student Navigation"
    >
      <div className="grid grid-cols-4 h-16 px-2">
        {studentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium touch-manipulation transition-colors',
                isActive
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  isActive && 'bg-primary/15'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <span className="truncate max-w-[70px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
