import {
  User,
  UserRole,
  Exam,
  ExamConfig,
  ExamStatus,
  Question,
  QuestionBank,
  QuestionType,
  ExamResult,
  AnswerReview,
  AnswerReviewQuestion,
  DifficultyLevel,
  ParseResult,
  ParsedQuestion,
  TeacherDashboardStats,
  StudentDashboardStats,
  ActivityItem,
} from '@/lib/types';
import { clampSeconds } from '@/lib/utils';
import { flattenImageUrls, normalizeQuestionImages } from '@/lib/question-images';

const toDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return new Date();
};

export function mapUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    email: String(raw.email ?? ''),
    role: (raw.role as UserRole) || 'student',
    avatar: raw.avatar ? String(raw.avatar) : undefined,
    createdAt: toDate(raw.created_at ?? raw.createdAt),
  };
}

function mapExamConfig(raw: Record<string, unknown> | undefined): ExamConfig {
  if (!raw) {
    return {
      duration: 60,
      shuffleQuestions: false,
      shuffleOptions: false,
      showResults: 'immediate',
      allowReview: true,
      maxAttempts: 1,
      passingScore: 60,
      securityEnabled: true,
      maxViolations: 3,
      requireFullscreen: true,
      blockCopyPaste: true,
      detectFocusLoss: true,
    };
  }
  const hasSecurityEnabled = raw.security_enabled !== undefined || raw.securityEnabled !== undefined;
  const securityEnabled = hasSecurityEnabled
    ? Boolean(raw.security_enabled ?? raw.securityEnabled)
    : true;
  const hasMaxViolations = raw.max_violations !== undefined || raw.maxViolations !== undefined;
  return {
    duration: Number(raw.duration ?? 60),
    shuffleQuestions: Boolean(raw.shuffle_questions ?? raw.shuffleQuestions),
    shuffleOptions: Boolean(raw.shuffle_options ?? raw.shuffleOptions),
    showResults: (raw.show_results ?? raw.showResults) as ExamConfig['showResults'],
    allowReview: Boolean(raw.allow_review ?? raw.allowReview),
    maxAttempts: Number(raw.max_attempts ?? raw.maxAttempts ?? 1),
    passingScore: Number(raw.passing_score ?? raw.passingScore ?? 60),
    securityEnabled,
    maxViolations: hasMaxViolations
      ? Number(raw.max_violations ?? raw.maxViolations)
      : securityEnabled
        ? 3
        : 0,
    requireFullscreen: raw.require_fullscreen !== undefined || raw.requireFullscreen !== undefined
      ? Boolean(raw.require_fullscreen ?? raw.requireFullscreen)
      : true,
    blockCopyPaste: raw.block_copy_paste !== undefined || raw.blockCopyPaste !== undefined
      ? Boolean(raw.block_copy_paste ?? raw.blockCopyPaste)
      : true,
    detectFocusLoss: raw.detect_focus_loss !== undefined || raw.detectFocusLoss !== undefined
      ? Boolean(raw.detect_focus_loss ?? raw.detectFocusLoss)
      : true,
  };
}

export function mapQuestionBank(raw: Record<string, unknown>): QuestionBank {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : undefined,
    questions: [],
    createdBy: String(raw.created_by ?? raw.createdBy ?? ''),
    isPublic: Boolean(raw.is_public ?? raw.isPublic),
    createdAt: toDate(raw.created_at ?? raw.createdAt),
  };
}

export function mapQuestion(raw: Record<string, unknown>): Question {
  let options: string[] | undefined;
  const o = raw.options;
  if (Array.isArray(o)) {
    options = o as string[];
  } else if (typeof o === 'string') {
    try {
      const p = JSON.parse(o);
      if (Array.isArray(p)) options = p;
    } catch {
      /* ignore */
    }
  }

  let tags: string[] = [];
  const t = raw.tags;
  if (Array.isArray(t)) tags = t as string[];
  else if (typeof t === 'string') {
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) tags = p;
    } catch {
      tags = [];
    }
  }

  let imagesRaw: unknown = raw.images ?? raw.image_urls ?? raw.imageUrls;
  if (typeof imagesRaw === 'string' && imagesRaw) {
    try {
      imagesRaw = JSON.parse(imagesRaw);
    } catch {
      imagesRaw = undefined;
    }
  }
  const images = normalizeQuestionImages(imagesRaw);
  const imageUrls = images.length > 0 ? flattenImageUrls(images) : undefined;

  return {
    id: String(raw.id ?? ''),
    type: (raw.type as QuestionType) || 'multiple-choice',
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    options,
    correctAnswer: String(raw.correct_answer ?? raw.correctAnswer ?? ''),
    explanation:
      raw.explanation !== undefined && raw.explanation !== null
        ? String(raw.explanation)
        : undefined,
    difficulty: (raw.difficulty as DifficultyLevel) || 'medium',
    points: Number(raw.points ?? 5),
    tags,
    images: images.length > 0 ? images : undefined,
    imageUrls,
    categoryId: raw.category_id ? String(raw.category_id) : undefined,
    createdBy: String(raw.created_by ?? raw.createdBy ?? ''),
    createdAt: toDate(raw.created_at ?? raw.createdAt),
    updatedAt: toDate(raw.updated_at ?? raw.updatedAt),
  };
}

export function mapExam(raw: Record<string, unknown>): Exam {
  const questionsRaw = raw.questions;
  const questions: Question[] = Array.isArray(questionsRaw)
    ? (questionsRaw as Record<string, unknown>[]).map((q) => mapQuestion(q))
    : [];

  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : undefined,
    subject: String(raw.subject ?? ''),
    grade: String(raw.grade ?? ''),
    questions,
    config: mapExamConfig(raw.config as Record<string, unknown>),
    status: (raw.status as ExamStatus) || 'draft',
    createdBy: String(raw.created_by ?? raw.createdBy ?? ''),
    scheduledStart: raw.scheduled_start
      ? toDate(raw.scheduled_start)
      : raw.scheduledStart
        ? toDate(raw.scheduledStart)
        : undefined,
    scheduledEnd: raw.scheduled_end
      ? toDate(raw.scheduled_end)
      : raw.scheduledEnd
        ? toDate(raw.scheduledEnd)
        : undefined,
    createdAt: toDate(raw.created_at ?? raw.createdAt),
    updatedAt: toDate(raw.updated_at ?? raw.updatedAt),
    questionCount: raw.question_count !== undefined ? Number(raw.question_count) : undefined,
  };
}

function mapAnswerReviewQuestion(raw: Record<string, unknown>): AnswerReviewQuestion {
  let imagesRaw: unknown = raw.images ?? raw.image_urls ?? raw.imageUrls;
  if (typeof imagesRaw === 'string' && imagesRaw) {
    try {
      imagesRaw = JSON.parse(imagesRaw);
    } catch {
      imagesRaw = undefined;
    }
  }
  const images = normalizeQuestionImages(imagesRaw);
  return {
    id: String(raw.id ?? ''),
    type: (raw.type as AnswerReviewQuestion['type']) || 'multiple-choice',
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    options: Array.isArray(raw.options) ? (raw.options as string[]) : undefined,
    explanation: raw.explanation ? String(raw.explanation) : undefined,
    points: Number(raw.points ?? 0),
    images: images.length > 0 ? images : undefined,
    imageUrls: images.length > 0 ? flattenImageUrls(images) : undefined,
  };
}

export function mapAnswerReview(raw: Record<string, unknown>): AnswerReview {
  const qRaw = raw.question as Record<string, unknown> | undefined;
  return {
    questionId: String(raw.question_id ?? raw.questionId ?? ''),
    studentAnswer: String(raw.student_answer ?? raw.studentAnswer ?? ''),
    correctAnswer:
      raw.correct_answer !== undefined
        ? String(raw.correct_answer)
        : raw.correctAnswer !== undefined
          ? String(raw.correctAnswer)
          : undefined,
    isCorrect: Boolean(raw.is_correct ?? raw.isCorrect),
    points: Number(raw.points ?? 0),
    maxPoints: Number(raw.max_points ?? raw.maxPoints ?? 0),
    feedback: raw.feedback ? String(raw.feedback) : undefined,
    pendingReview: Boolean(raw.pending_review ?? raw.pendingReview),
    question: qRaw ? mapAnswerReviewQuestion(qRaw) : undefined,
  };
}

export function mapExamResult(raw: Record<string, unknown>): ExamResult {
  const maxScore = Number(raw.max_score ?? raw.maxScore ?? 0);
  const score = Number(raw.score ?? 0);
  const pct =
    raw.percentage !== undefined
      ? Number(raw.percentage)
      : maxScore > 0
        ? (score / maxScore) * 100
        : 0;

  const answersRaw = raw.answers;
  const answers: AnswerReview[] = Array.isArray(answersRaw)
    ? (answersRaw as Record<string, unknown>[]).map(mapAnswerReview)
    : [];

  return {
    id: String(raw.id ?? ''),
    sessionId: String(raw.session_id ?? raw.sessionId ?? ''),
    examId: String(raw.exam_id ?? raw.examId ?? ''),
    examTitle: raw.exam_title ? String(raw.exam_title) : raw.examTitle ? String(raw.examTitle) : undefined,
    examGrade: raw.exam_grade ? String(raw.exam_grade) : raw.examGrade ? String(raw.examGrade) : undefined,
    studentId: String(raw.student_id ?? raw.studentId ?? ''),
    studentName: String(raw.student_name ?? raw.studentName ?? ''),
    score,
    maxScore,
    percentage: pct,
    passed: Boolean(raw.passed),
    answers,
    timeSpent: clampSeconds(Number(raw.time_spent ?? raw.timeSpent ?? 0)),
    submittedAt: toDate(raw.submitted_at ?? raw.submittedAt),
    gradedAt: raw.graded_at ? toDate(raw.graded_at) : raw.gradedAt ? toDate(raw.gradedAt) : undefined,
    resultsVisible:
      raw.results_visible !== undefined
        ? Boolean(raw.results_visible)
        : raw.resultsVisible !== undefined
          ? Boolean(raw.resultsVisible)
          : true,
    allowReview:
      raw.allow_review !== undefined
        ? Boolean(raw.allow_review)
        : raw.allowReview !== undefined
          ? Boolean(raw.allowReview)
          : true,
    showResults: (raw.show_results ?? raw.showResults) as ExamResult['showResults'],
    passingScore:
      raw.passing_score !== undefined
        ? Number(raw.passing_score)
        : raw.passingScore !== undefined
          ? Number(raw.passingScore)
          : undefined,
    message: raw.message ? String(raw.message) : undefined,
  };
}

export function mapTeacherDashboard(raw: Record<string, unknown>): TeacherDashboardStats {
  const act = Array.isArray(raw.recent_activity) ? raw.recent_activity : [];
  return {
    totalExams: Number(raw.total_exams ?? 0),
    activeExams: Number(raw.active_exams ?? 0),
    totalStudents: Number(raw.total_students ?? 0),
    totalQuestions: Number(raw.total_questions ?? 0),
    recentActivity: act.map((a) => {
      const x = a as Record<string, unknown>;
      return {
        id: String(x.id ?? ''),
        type: (x.type as ActivityItem['type']) || 'exam-created',
        title: String(x.title ?? ''),
        description: String(x.description ?? ''),
        timestamp: toDate(x.timestamp),
        userId: x.user_id ? String(x.user_id) : undefined,
        userName: x.user_name ? String(x.user_name) : undefined,
      };
    }),
  };
}

export function mapStudentDashboard(raw: Record<string, unknown>): StudentDashboardStats {
  const upcoming = Array.isArray(raw.upcoming_exams)
    ? (raw.upcoming_exams as Record<string, unknown>[]).map(mapExam)
    : [];
  const completed = Array.isArray(raw.completed_exams)
    ? (raw.completed_exams as Record<string, unknown>[]).map(mapExamResult)
    : [];

  return {
    upcomingExams: upcoming,
    completedExams: completed,
    averageScore: Number(raw.average_score ?? 0),
    totalExamsTaken: Number(raw.total_exams_taken ?? completed.length),
  };
}

export function mapParseResult(raw: Record<string, unknown>): ParseResult {
  const qs = Array.isArray(raw.questions)
    ? (raw.questions as Record<string, unknown>[]).map(mapParsedQuestion)
    : [];
  return {
    success: Boolean(raw.success),
    questions: qs,
    errors: Array.isArray(raw.errors) ? (raw.errors as string[]) : undefined,
    warnings: Array.isArray(raw.warnings) ? (raw.warnings as string[]) : undefined,
  };
}

function mapParsedQuestion(raw: Record<string, unknown>): ParsedQuestion {
  let imagesRaw: unknown = raw.images ?? raw.image_urls ?? raw.imageUrls;
  if (typeof imagesRaw === 'string' && imagesRaw) {
    try {
      imagesRaw = JSON.parse(imagesRaw);
    } catch {
      imagesRaw = undefined;
    }
  }
  const images = normalizeQuestionImages(imagesRaw);
  const imageUrls = images.length > 0 ? flattenImageUrls(images) : undefined;
  return {
    type: (raw.type as ParsedQuestion['type']) || 'multiple-choice',
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    options: Array.isArray(raw.options) ? (raw.options as string[]) : undefined,
    images: images.length > 0 ? images : undefined,
    imageUrls,
    correctAnswer: String(raw.correct_answer ?? ''),
    explanation: raw.explanation ? String(raw.explanation) : undefined,
    difficulty: (raw.difficulty as DifficultyLevel) || 'medium',
    points: Number(raw.points ?? 5),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
  };
}
