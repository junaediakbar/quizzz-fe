import {
  User,
  Question,
  Exam,
  ExamResult,
  TeacherDashboardStats,
  StudentDashboardStats,
  ActivityItem,
  QuestionBank,
} from './types';

const mockSecurityDefaults = {
  securityEnabled: true,
  maxViolations: 3,
  requireFullscreen: true,
  blockCopyPaste: true,
  detectFocusLoss: true,
} as const;

// Mock Users
export const mockTeacherUser: User = {
  id: 'teacher-1',
  name: 'Dr. Sarah Johnson',
  email: 'sarah.johnson@school.edu',
  role: 'teacher',
  avatar: '/avatars/teacher-1.png',
  createdAt: new Date('2024-01-15'),
};

export const mockStudentUser: User = {
  id: 'student-1',
  name: 'Ahmad Wijaya',
  email: 'ahmad.wijaya@school.edu',
  role: 'student',
  avatar: '/avatars/student-1.png',
  createdAt: new Date('2024-02-01'),
};

// Mock Questions
export const mockQuestions: Question[] = [
  {
    id: 'q-1',
    type: 'multiple-choice',
    title: 'Photosynthesis Process',
    content: 'What is the primary product of photosynthesis?',
    options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Hydrogen'],
    correctAnswer: 'Oxygen',
    explanation: 'During photosynthesis, plants use sunlight, water, and carbon dioxide to produce glucose and oxygen.',
    difficulty: 'easy',
    points: 5,
    tags: ['biology', 'plants', 'photosynthesis'],
    createdBy: 'teacher-1',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
  {
    id: 'q-2',
    type: 'multiple-choice',
    title: 'Newton\'s Laws',
    content: 'Which of Newton\'s laws states that for every action, there is an equal and opposite reaction?',
    options: ['First Law', 'Second Law', 'Third Law', 'Fourth Law'],
    correctAnswer: 'Third Law',
    explanation: 'Newton\'s Third Law of Motion states that for every action, there is an equal and opposite reaction.',
    difficulty: 'medium',
    points: 10,
    tags: ['physics', 'mechanics', 'newton'],
    createdBy: 'teacher-1',
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-03-05'),
  },
  {
    id: 'q-3',
    type: 'true-false',
    title: 'Chemical Bonding',
    content: 'Covalent bonds involve the sharing of electron pairs between atoms.',
    correctAnswer: 'true',
    explanation: 'Covalent bonds indeed involve the sharing of electron pairs between atoms.',
    difficulty: 'easy',
    points: 3,
    tags: ['chemistry', 'bonding'],
    createdBy: 'teacher-1',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-03-10'),
  },
  {
    id: 'q-4',
    type: 'multiple-choice',
    title: 'Cell Division',
    content: 'What is the process by which a cell divides into two identical daughter cells?',
    options: ['Meiosis', 'Mitosis', 'Fertilization', 'Osmosis'],
    correctAnswer: 'Mitosis',
    explanation: 'Mitosis is the process of cell division that results in two genetically identical daughter cells.',
    difficulty: 'medium',
    points: 8,
    tags: ['biology', 'cells', 'division'],
    createdBy: 'teacher-1',
    createdAt: new Date('2024-03-12'),
    updatedAt: new Date('2024-03-12'),
  },
  {
    id: 'q-5',
    type: 'short-answer',
    title: 'Mathematical Expression',
    content: 'Simplify: (2x + 3y) + (4x - 2y)',
    correctAnswer: '6x + y',
    explanation: 'Combine like terms: (2x + 4x) + (3y - 2y) = 6x + y',
    difficulty: 'medium',
    points: 10,
    tags: ['math', 'algebra'],
    createdBy: 'teacher-1',
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-03-15'),
  },
];

// Mock Exams
export const mockExams: Exam[] = [
  {
    id: 'exam-1',
    title: 'Biology Midterm Exam',
    description: 'Comprehensive midterm covering cellular biology, genetics, and ecosystems.',
    subject: 'Biology',
    grade: '10th Grade',
    questions: [mockQuestions[0], mockQuestions[3]],
    config: {
      duration: 60,
      shuffleQuestions: false,
      shuffleOptions: true,
      showResults: 'after-review',
      allowReview: true,
      maxAttempts: 1,
      passingScore: 70,
      ...mockSecurityDefaults,
    },
    status: 'published',
    createdBy: 'teacher-1',
    scheduledStart: new Date('2024-06-15T09:00:00'),
    scheduledEnd: new Date('2024-06-15T11:00:00'),
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-05-10'),
  },
  {
    id: 'exam-2',
    title: 'Physics Quiz - Newton\'s Laws',
    description: 'Quick quiz on Newton\'s three laws of motion.',
    subject: 'Physics',
    grade: '11th Grade',
    questions: [mockQuestions[1]],
    config: {
      duration: 30,
      shuffleQuestions: false,
      shuffleOptions: true,
      showResults: 'immediate',
      allowReview: true,
      maxAttempts: 2,
      passingScore: 60,
      ...mockSecurityDefaults,
    },
    status: 'active',
    createdBy: 'teacher-1',
    scheduledStart: new Date('2024-06-01T10:00:00'),
    scheduledEnd: new Date('2024-06-01T10:30:00'),
    createdAt: new Date('2024-05-20'),
    updatedAt: new Date('2024-05-20'),
  },
  {
    id: 'exam-3',
    title: 'Chemistry Fundamentals',
    description: 'Introduction to chemical bonds and reactions.',
    subject: 'Chemistry',
    grade: '9th Grade',
    questions: [mockQuestions[2]],
    config: {
      duration: 45,
      shuffleQuestions: false,
      shuffleOptions: false,
      showResults: 'manual',
      allowReview: false,
      maxAttempts: 1,
      passingScore: 75,
      securityEnabled: false,
      maxViolations: 0,
      requireFullscreen: false,
      blockCopyPaste: false,
      detectFocusLoss: false,
    },
    status: 'draft',
    createdBy: 'teacher-1',
    createdAt: new Date('2024-05-25'),
    updatedAt: new Date('2024-05-25'),
  },
];

// Mock Exam Results
export const mockExamResults: ExamResult[] = [
  {
    id: 'result-1',
    sessionId: 'session-1',
    examId: 'exam-1',
    studentId: 'student-1',
    studentName: 'Ahmad Wijaya',
    score: 85,
    maxScore: 100,
    percentage: 85,
    passed: true,
    answers: [
      {
        questionId: 'q-1',
        studentAnswer: 'Oxygen',
        correctAnswer: 'Oxygen',
        isCorrect: true,
        points: 5,
        maxPoints: 5,
      },
      {
        questionId: 'q-4',
        studentAnswer: 'Mitosis',
        correctAnswer: 'Mitosis',
        isCorrect: true,
        points: 8,
        maxPoints: 8,
      },
    ],
    timeSpent: 2400,
    submittedAt: new Date('2024-05-20T11:00:00'),
    gradedAt: new Date('2024-05-20T11:05:00'),
  },
];

// Mock Question Banks
export const mockQuestionBanks: QuestionBank[] = [
  {
    id: 'bank-1',
    name: 'Biology Questions',
    description: 'Collection of biology questions for grades 9-12',
    questions: [mockQuestions[0], mockQuestions[3]],
    createdBy: 'teacher-1',
    isPublic: false,
    createdAt: new Date('2024-03-01'),
  },
  {
    id: 'bank-2',
    name: 'Physics Questions',
    description: 'Physics problems covering mechanics and thermodynamics',
    questions: [mockQuestions[1]],
    createdBy: 'teacher-1',
    isPublic: true,
    createdAt: new Date('2024-03-05'),
  },
];

// Mock Activity
export const mockActivity: ActivityItem[] = [
  {
    id: 'act-1',
    type: 'exam-submitted',
    title: 'Exam Submitted',
    description: 'Ahmad Wijaya submitted Biology Midterm Exam',
    timestamp: new Date('2024-05-20T11:00:00'),
    userId: 'student-1',
    userName: 'Ahmad Wijaya',
  },
  {
    id: 'act-2',
    type: 'exam-created',
    title: 'New Exam Created',
    description: 'You created Physics Quiz - Newton\'s Laws',
    timestamp: new Date('2024-05-20T09:30:00'),
  },
  {
    id: 'act-3',
    type: 'question-added',
    title: 'Questions Added',
    description: 'You added 5 questions to Biology Questions bank',
    timestamp: new Date('2024-05-19T14:20:00'),
  },
];

// Teacher Dashboard Stats
export const mockTeacherStats: TeacherDashboardStats = {
  totalExams: 24,
  activeExams: 3,
  totalStudents: 156,
  totalQuestions: 342,
  recentActivity: mockActivity,
};

// Student Dashboard Stats
export const mockStudentStats: StudentDashboardStats = {
  upcomingExams: [mockExams[1]],
  completedExams: mockExamResults,
  averageScore: 82.5,
  totalExamsTaken: 8,
};
