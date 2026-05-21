import { StudentHeader } from '@/components/shared/student-header';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <StudentHeader />
      {children}
    </div>
  );
}
