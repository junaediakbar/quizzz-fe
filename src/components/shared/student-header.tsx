'use client';

import Link from 'next/link';
import { UserAccountMenu } from '@/components/shared/user-account-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

interface StudentHeaderProps {
  /** Judul di samping logo (opsional) */
  title?: string;
  subtitle?: string;
  /** Tombol kiri (mis. back) — menggantikan blok logo jika diisi */
  left?: React.ReactNode;
  /** Konten tambahan di kanan sebelum avatar */
  trailing?: React.ReactNode;
  /** Sembunyikan tombol Schedule */
  hideSchedule?: boolean;
  className?: string;
}

export function StudentHeader({
  title = 'QuizApp',
  subtitle = 'Student Portal',
  left,
  trailing,
  hideSchedule = false,
  className,
}: StudentHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm pt-[env(safe-area-inset-top)]',
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        {left ?? (
          <Link href="/student/dashboard" className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
              <span className="font-bold text-primary-foreground">Q</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </Link>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {!hideSchedule && (
            <Button variant="outline" size="sm" className="hidden touch-manipulation sm:inline-flex">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          )}
          <UserAccountMenu
            profileHref="/student/profile"
            settingsHref="/student/settings"
            avatarFallbackClassName="bg-green-500/10 text-green-500"
            variant="icon"
            showName={false}
          />
        </div>
      </div>
    </header>
  );
}
