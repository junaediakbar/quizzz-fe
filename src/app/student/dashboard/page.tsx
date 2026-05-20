'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen,
  Clock,
  Trophy,
  TrendingUp,
  Play,
  Calendar,
  Award,
  Target,
  CheckCircle2,
  XCircle,
  User,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGradeLabel } from '@/lib/constants/grades';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dashboardApi } from '@/lib/api';
import type { Exam, ExamResult } from '@/lib/types';

export default function StudentDashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);
  const [recentResults, setRecentResults] = useState<ExamResult[]>([]);
  const [averageScore, setAverageScore] = useState(0);
  const [totalTaken, setTotalTaken] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await dashboardApi.student(user.id);
        if (!cancelled) {
          setUpcomingExams(d.upcomingExams);
          setRecentResults(d.completedExams);
          setAverageScore(Math.round(d.averageScore * 10) / 10);
          setTotalTaken(d.totalExamsTaken);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500/10';
    if (percentage >= 60) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">Q</span>
            </div>
            <div>
              <h1 className="font-semibold text-lg">QuizApp</h1>
              <p className="text-xs text-muted-foreground">Student Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" className="touch-manipulation">
              <Calendar className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Schedule</span>
            </Button>

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 flex items-center gap-2 px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-green-500/10 text-green-500">
                      {user?.name?.charAt(0).toUpperCase() || 'S'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm hidden sm:flex">
                    <span className="font-medium">{user?.name || 'Student'}</span>
                    <span className="text-xs text-muted-foreground">Grade 11</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name || 'Student'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || 'student@quizzz.com'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/student/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/student/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-heading tracking-tight">
              Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
            </h2>
            <p className="text-muted-foreground mt-1">Track your progress and upcoming assessments</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="animate-slide-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                </div>
                <Badge variant="outline" className="text-xs">
                  This semester
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Exams Taken</p>
                <p className="text-3xl font-bold mt-1">{totalTaken}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-green-500" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Average
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-3xl font-bold mt-1 text-green-500">{averageScore}%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-500" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Progress
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <p className="text-3xl font-bold mt-1">87%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-500" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Scheduled
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-3xl font-bold mt-1">{upcomingExams.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Exams */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Upcoming Exams</h3>
              <Button variant="outline" size="sm">View All</Button>
            </div>

            <div className="space-y-4">
              {upcomingExams.map((exam) => (
                <Card key={exam.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{exam.subject}</Badge>
                          <Badge className="bg-blue-500/10 text-blue-500">
                            {formatGradeLabel(exam.grade)}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-lg">{exam.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{exam.description}</p>

                        <div className="flex items-center gap-4 mt-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{exam.config.duration} minutes</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <BookOpen className="w-4 h-4" />
                            <span>{exam.questionCount ?? exam.questions?.length ?? 0} questions</span>
                          </div>
                        </div>

                        {exam.scheduledStart && (
                          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                              Scheduled: {new Date(exam.scheduledStart).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        )}
                      </div>

                      <Button
                        size="lg"
                        className="gap-2"
                        onClick={() => router.push(`/exam/${exam.id}`)}
                      >
                        <Play className="w-4 h-4" />
                        Start Exam
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {upcomingExams.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No upcoming exams scheduled</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Performance Overview */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Performance Overview</h3>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentResults.slice(0, 4).map((result, i) => (
                    <div key={result.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">
                          {result.examTitle || `Ujian ${result.examId.slice(0, 8)}…`}
                        </span>
                        <span className={cn('font-semibold', getScoreColor(result.percentage))}>
                          {result.percentage}%
                        </span>
                      </div>
                      <Progress
                        value={result.percentage}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <Award className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Top Performer</p>
                      <p className="text-xs text-muted-foreground">Scored 90%+ on 3 exams</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">On Fire!</p>
                      <p className="text-xs text-muted-foreground">5 exams in a row passed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Early Bird</p>
                      <p className="text-xs text-muted-foreground">Completed before deadline</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Results */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Recent Results</h3>
            <Button variant="outline" size="sm" asChild>
              <Link href="/student/results">Lihat Semua</Link>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentResults.map((result) => (
                  <Link
                    key={result.id}
                    href={`/student/results/${result.id}`}
                    className="p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        getScoreBgColor(result.percentage)
                      )}>
                        {result.passed ? (
                          <CheckCircle2 className={cn('w-6 h-6', getScoreColor(result.percentage))} />
                        ) : (
                          <XCircle className={cn('w-6 h-6', getScoreColor(result.percentage))} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium truncate">
                          {result.examTitle || `Ujian ${result.examId.slice(0, 8)}…`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatGradeLabel(result.examGrade)}
                          {result.examGrade ? ' · ' : ''}
                          {result.submittedAt.toLocaleDateString('id-ID')} ·{' '}
                          {Math.round(result.timeSpent / 60)} menit
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={cn('text-2xl font-bold tabular-nums', getScoreColor(result.percentage))}>
                        {result.percentage.toFixed(0)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {result.score}/{result.maxScore} poin
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
