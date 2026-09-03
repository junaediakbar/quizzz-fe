import { StudentHeader } from '@/components/shared/student-header';
import { StudentBottomNav } from '@/components/shared/student-bottom-nav';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 pb-20 md:pb-0">
      <StudentHeader />
      {children}
      <StudentBottomNav />
    </div>
  );
}
