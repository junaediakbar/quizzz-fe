'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderKanban } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminQuestionsPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push('/admin/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5" />
              <CardTitle>Question Banks</CardTitle>
            </div>
            <CardDescription>View and manage all question banks</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Question bank management features coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
