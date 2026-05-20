'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data for results
const mockResultsData = [
  {
    id: 'result-1',
    studentName: 'Ahmad Wijaya',
    studentId: 'student-1',
    examName: 'Biology Midterm Exam',
    score: 85,
    maxScore: 100,
    percentage: 85,
    passed: true,
    timeSpent: 2400,
    submittedAt: new Date('2024-05-20T11:00:00'),
    status: 'graded',
  },
  {
    id: 'result-2',
    studentName: 'Siti Rahayu',
    studentId: 'student-2',
    examName: 'Biology Midterm Exam',
    score: 92,
    maxScore: 100,
    percentage: 92,
    passed: true,
    timeSpent: 2100,
    submittedAt: new Date('2024-05-20T10:45:00'),
    status: 'graded',
  },
  {
    id: 'result-3',
    studentName: 'Budi Santoso',
    studentId: 'student-3',
    examName: 'Biology Midterm Exam',
    score: 68,
    maxScore: 100,
    percentage: 68,
    passed: false,
    timeSpent: 2700,
    submittedAt: new Date('2024-05-20T11:15:00'),
    status: 'graded',
  },
  {
    id: 'result-4',
    studentName: 'Dewi Lestari',
    studentId: 'student-4',
    examName: 'Biology Midterm Exam',
    score: 78,
    maxScore: 100,
    percentage: 78,
    passed: true,
    timeSpent: 2550,
    submittedAt: new Date('2024-05-20T10:50:00'),
    status: 'graded',
  },
  {
    id: 'result-5',
    studentName: 'Rizky Pratama',
    studentId: 'student-5',
    examName: 'Physics Quiz - Newton\'s Laws',
    score: 45,
    maxScore: 50,
    percentage: 90,
    passed: true,
    timeSpent: 1200,
    submittedAt: new Date('2024-05-21T14:30:00'),
    status: 'pending',
  },
];

const mockQuestionAnalytics = [
  {
    questionId: 'q-1',
    questionTitle: 'Photosynthesis Process',
    correctRate: 85,
    averageTime: 45,
    discrimination: 0.6,
  },
  {
    questionId: 'q-2',
    questionTitle: 'Newton\'s Laws',
    correctRate: 72,
    averageTime: 60,
    discrimination: 0.4,
  },
  {
    questionId: 'q-3',
    questionTitle: 'Chemical Bonding',
    correctRate: 91,
    averageTime: 20,
    discrimination: 0.8,
  },
];

const mockScoreDistribution = [
  { range: '90-100', count: 12, percentage: 24 },
  { range: '80-89', count: 18, percentage: 36 },
  { range: '70-79', count: 10, percentage: 20 },
  { range: '60-69', count: 6, percentage: 12 },
  { range: 'Below 60', count: 4, percentage: 8 },
];

export default function ResultsPage() {
  const [selectedExam, setSelectedExam] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredResults = mockResultsData.filter((result) => {
    const matchesExam = selectedExam === 'all' || result.examName.toLowerCase().includes(selectedExam.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || result.status === selectedStatus;
    const matchesSearch = result.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesExam && matchesStatus && matchesSearch;
  });

  const analytics = {
    totalSubmissions: filteredResults.length,
    averageScore: Math.round(filteredResults.reduce((sum, r) => sum + r.percentage, 0) / filteredResults.length) || 0,
    passRate: Math.round((filteredResults.filter(r => r.passed).length / filteredResults.length) * 100) || 0,
    highestScore: Math.max(...filteredResults.map(r => r.percentage), 0),
    lowestScore: Math.min(...filteredResults.map(r => r.percentage), 0),
    averageTime: Math.round(filteredResults.reduce((sum, r) => sum + r.timeSpent, 0) / filteredResults.length / 60) || 0,
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Q</span>
            </div>
            <span className="font-semibold text-lg">QuizApp</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <a
            href="/teacher/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FileText className="w-5 h-5" />
            Dashboard
          </a>
          <a
            href="/teacher/questions"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FileText className="w-5 h-5" />
            Question Bank
          </a>
          <a
            href="/teacher/results"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground"
          >
            <BarChart3 className="w-5 h-5" />
            Results
          </a>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-medium text-sm">SJ</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Dr. Sarah Johnson</p>
              <p className="text-xs text-muted-foreground">Teacher</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold">Exam Results & Analytics</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Submissions</p>
                    <p className="text-xl font-bold">{analytics.totalSubmissions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Score</p>
                    <p className="text-xl font-bold text-green-500">{analytics.averageScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pass Rate</p>
                    <p className="text-xl font-bold">{analytics.passRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Highest</p>
                    <p className="text-xl font-bold">{analytics.highestScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Time</p>
                    <p className="text-xl font-bold">{analytics.averageTime}m</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="results" className="space-y-4">
            <TabsList>
              <TabsTrigger value="results">Student Results</TabsTrigger>
              <TabsTrigger value="analytics">Question Analytics</TabsTrigger>
              <TabsTrigger value="distribution">Score Distribution</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Student Results</CardTitle>
                      <CardDescription>View and grade individual student submissions</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by student name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={selectedExam} onValueChange={(v) => setSelectedExam(v ?? 'all')}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by exam" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Exams</SelectItem>
                        <SelectItem value="biology">Biology Midterm</SelectItem>
                        <SelectItem value="physics">Physics Quiz</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v ?? 'all')}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="graded">Graded</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Exam</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                                getScoreBgColor(result.percentage)
                              )}>
                                {result.passed ? (
                                  <CheckCircle2 className={cn('w-4 h-4', getScoreColor(result.percentage))} />
                                ) : (
                                  <XCircle className={cn('w-4 h-4', getScoreColor(result.percentage))} />
                                )}
                              </div>
                              <span className="font-medium">{result.studentName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{result.examName}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className={cn('font-semibold', getScoreColor(result.percentage))}>
                                {result.score}/{result.maxScore}
                              </p>
                              <p className="text-xs text-muted-foreground">{result.percentage}%</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatTime(result.timeSpent)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {result.submittedAt.toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={result.status === 'graded' ? 'default' : 'secondary'}
                              className="capitalize"
                            >
                              {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Question Analytics</CardTitle>
                  <CardDescription>Performance breakdown by question</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Correct Rate</TableHead>
                        <TableHead>Avg Time</TableHead>
                        <TableHead>Discrimination</TableHead>
                        <TableHead>Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockQuestionAnalytics.map((q) => (
                        <TableRow key={q.questionId}>
                          <TableCell className="font-medium">{q.questionTitle}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={q.correctRate} className="w-16 h-2" />
                              <span className="text-sm">{q.correctRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{q.averageTime}s</TableCell>
                          <TableCell>
                            <Badge
                              variant={q.discrimination > 0.5 ? 'default' : 'secondary'}
                              className="capitalize"
                            >
                              {q.discrimination > 0.5 ? 'Good' : 'Fair'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="distribution" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                  <CardDescription>How students performed across score ranges</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockScoreDistribution.map((item) => (
                      <div key={item.range} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.range}%</span>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">{item.count} students</span>
                            <span className="font-semibold">{item.percentage}%</span>
                          </div>
                        </div>
                        <Progress
                          value={item.percentage}
                          className={cn(
                            'h-3',
                            item.range === '90-100' || item.range === '80-89'
                              ? '[&>div]:bg-green-500'
                              : item.range === '70-79' || item.range === '60-69'
                              ? '[&>div]:bg-yellow-500'
                              : '[&>div]:bg-red-500'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
