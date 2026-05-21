'use client';

import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UserAccountMenuProps {
  profileHref: string;
  settingsHref: string;
  /** Warna fallback avatar, mis. bg-green-500/10 text-green-500 */
  avatarFallbackClassName?: string;
  /** Tampilkan nama di samping avatar (desktop) */
  showName?: boolean;
  /** Ukuran trigger: default dengan nama, icon = hanya avatar bulat */
  variant?: 'default' | 'icon';
  className?: string;
}

export function UserAccountMenu({
  profileHref,
  settingsHref,
  avatarFallbackClassName = 'bg-primary/10 text-primary font-semibold',
  showName = true,
  variant = 'default',
  className,
}: UserAccountMenuProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase() || 'U';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const trigger =
    variant === 'icon' ? (
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-10 w-10 shrink-0 touch-manipulation', className)}
        aria-label="Menu akun"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.avatar} alt={displayName} />
          <AvatarFallback className={avatarFallbackClassName}>{initial}</AvatarFallback>
        </Avatar>
      </Button>
    ) : (
      <Button
        variant="ghost"
        className={cn(
          'relative flex h-10 items-center gap-2 px-2 sm:px-3 touch-manipulation',
          className
        )}
        aria-label="Menu akun"
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={user?.avatar} alt={displayName} />
          <AvatarFallback className={avatarFallbackClassName}>{initial}</AvatarFallback>
        </Avatar>
        {showName && (
          <div className="hidden min-w-0 flex-col items-start text-sm sm:flex">
            <span className="max-w-[10rem] truncate font-medium">{displayName}</span>
            <span className="text-xs text-muted-foreground capitalize">{user?.role || 'user'}</span>
          </div>
        )}
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{displayName}</p>
            {displayEmail ? (
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(profileHref)}>
          <User className="mr-2 h-4 w-4" />
          Profil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(settingsHref)}>
          <Settings className="mr-2 h-4 w-4" />
          Pengaturan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
