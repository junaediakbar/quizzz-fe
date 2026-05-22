// User Types
export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
}

// Question Types
export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'matching' | 'fill-blank';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type { QuestionImage, QuestionImagePosition } from '@/lib/question-images';
import type { QuestionImage } from '@/lib/question-images';

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  difficulty: DifficultyLevel;
  points: number;
  tags: string[];
  /** Gambar berposisi (atas / bawah teks / opsi) */
  images?: QuestionImage[];
  /** Semua URL (legacy / ringkasan); string[] lama = dianggap below */
  imageUrls?: string[];
  categoryId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
  createdBy: string;
  isPublic: boolean;
  createdAt: Date;
}

// Exam Types
export type ExamStatus = 'draft' | 'published' | 'active' | 'completed' | 'archived';

export interface ExamConfig {
  duration: number; // in minutes
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResults: 'immediate' | 'after-review' | 'manual';
  allowReview: boolean;
  maxAttempts: number;
  passingScore: number;
  /** Master switch: when false, all proctoring is off */
  securityEnabled: boolean;
  /** 0 = only warn, never auto-end session */
  maxViolations: number;
  requireFullscreen: boolean;
  blockCopyPaste: boolean;
  detectFocusLoss: boolean;
}

export interface Exam {
  id: string;
  title: string;
  description?: string;
  subject: string;
  grade: string;
  questions: Question[];
  config: ExamConfig;
  status: ExamStatus;
  createdBy: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
  questionCount?: number;
}

// Exam Session Types
export type SessionStatus = 'not-started' | 'in-progress' | 'submitted' | 'graded';

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, string | string[]>;
  status: SessionStatus;
  startedAt?: Date;
  submittedAt?: Date;
  timeSpent: number; // in seconds
  score?: number;
  gradedBy?: string;
  gradedAt?: Date;
}

export interface AnswerReviewQuestion {
  id: string;
  type: QuestionType;
  title: string;
  content: string;
  options?: string[];
  explanation?: string;
  points: number;
  images?: QuestionImage[];
  imageUrls?: string[];
}

export interface AnswerReview {
  questionId: string;
  studentAnswer: string | string[];
  correctAnswer?: string | string[];
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  feedback?: string;
  pendingReview?: boolean;
  question?: AnswerReviewQuestion;
}

// Result Types
export interface ExamResult {
  id: string;
  sessionId: string;
  examId: string;
  examTitle?: string;
  examGrade?: string;
  studentId: string;
  studentName: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  answers: AnswerReview[];
  timeSpent: number;
  submittedAt: Date;
  gradedAt?: Date;
  resultsVisible?: boolean;
  allowReview?: boolean;
  showResults?: ExamConfig['showResults'];
  passingScore?: number;
  message?: string;
}

export interface ResultAnalytics {
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  totalParticipants: number;
  questionAnalytics: QuestionAnalytics[];
}

export interface QuestionAnalytics {
  questionId: string;
  questionTitle: string;
  correctCount: number;
  incorrectCount: number;
  skipCount: number;
  difficulty: DifficultyLevel;
  discrimination: number; // How well the question discriminates between high and low performers
}

// Dashboard Stats
export interface TeacherDashboardStats {
  totalExams: number;
  activeExams: number;
  totalStudents: number;
  totalQuestions: number;
  recentActivity: ActivityItem[];
}

export interface StudentDashboardStats {
  upcomingExams: Exam[];
  completedExams: ExamResult[];
  averageScore: number;
  totalExamsTaken: number;
}

export interface ActivityItem {
  id: string;
  type: 'exam-created' | 'exam-submitted' | 'exam-graded' | 'question-added';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
}

// AI Parser Types
export interface ParsedQuestion {
  type: QuestionType;
  title: string;
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  difficulty: DifficultyLevel;
  points: number;
  tags: string[];
  images?: QuestionImage[];
  imageUrls?: string[];
}

export interface ParseResult {
  success: boolean;
  questions: ParsedQuestion[];
  errors?: string[];
  warnings?: string[];
}

// Category Types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  color?: string;
}
