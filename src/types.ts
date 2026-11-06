export type TestStatus = 'setup' | 'in-progress' | 'completed';

export type ExamMode = 'Full Mock' | 'Sectional' | 'Topic Drill' | 'Quick 10-min';

export interface UserProfile {
  displayName?: string;
  photoURL?: string;
  email?: string;
  stream?: 'General' | 'DEPR' | 'DSIM';
  category?: 'General' | 'EWS' | 'OBC' | 'SC' | 'ST' | 'PwBD';
  attemptCount?: string;
  educationBackground?: string;
  dailyStudyHours?: number;
  bio?: string;
  phone?: string;
  targetExamYear?: string;
  targetExamDate?: string;
  targetScoreGoal?: number;
  updatedAt?: number;
}

export interface Subject {
  id: string;
  slug: string;
  name: string;
  phase: 'Phase 1' | 'Phase 2';
  accentColor: string;
  icon: string;
  totalMarks: number;
  durationMinutes: number;
  negativeMarking: number; // e.g. 0.25
  questionTypeMix: {
    mcq: boolean;
    descriptive: boolean;
    defaultMcqCount: number;
    defaultDescCount: number;
  };
  categories: string[]; // e.g. ['Static', 'Dynamic']
  syllabusTopics: string[];
  description: string;
}

export interface SubjectNote {
  id: string;
  userId: string;
  subjectId: string;
  subjectSlug: string;
  fileName: string;
  extractedText: string;
  size: number;
  uploadedAt: number;
}

export interface MistakeEntry {
  id: string;
  userId: string;
  testId: string;
  subjectId: string;
  subjectSlug: string;
  questionId: string;
  type: 'MCQ' | 'Descriptive';
  topic: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  text: string;
  options?: string[] | null;
  userAnswer?: string | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  leitnerBox: number; // 1 to 5
  lastReviewedAt?: number;
  nextReviewDue?: number;
  reviewCount: number;
  createdAt: number;
}

export interface TestConfig {
  mcqStatic: number;
  mcqDynamic: number;
  descStatic: number;
  descDynamic: number;
  mode?: ExamMode;
  targetTopic?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Hard';
  timerEnabled?: boolean;
  negativeMarkingEnabled?: boolean;
}

export interface Question {
  id?: string;
  type: 'MCQ' | 'Descriptive';
  sourceTag: 'Static' | 'Dynamic';
  topic?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Hard';
  subjectId?: string;
  text: string;
  options?: string[] | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  modelAnswer?: string | null;
  markingScheme?: Record<string, number> | null;
  wordLimit?: number | null;
  maxMarks: number;
  userAnswer?: string | null;
  score?: number;
  isCorrect?: boolean;
  timeSpentSeconds?: number;
  confidence?: 'sure' | 'educated_guess' | 'blind_guess';
}

export interface TestAttempt {
  id: string;
  userId: string;
  createdAt: number;
  status: TestStatus;
  subjectId: string;
  subjectSlug: string;
  subjectName?: string;
  mode?: ExamMode;
  targetTopic?: string;
  config: TestConfig;
  sourceNoteFileRefs: string[];
  extractedNotesText: string;
  durationSeconds: number;
  durationUsedSeconds?: number;
  negativeMarks?: number;
  startedAt?: number;
  submittedAt?: number;
  evaluatedAt?: number;
  isEvaluated?: boolean;
  questions: Question[];
  answers?: Record<string, string>;
  totalScore?: number;
  sectionScores?: {
    mcqStatic: number;
    mcqDynamic: number;
    descStatic: number;
    descDynamic: number;
  };
  evaluations?: Record<string, {
    totalScore: number;
    scoreBreakdown: Record<string, number>;
    feedbackPoints: string[];
    suggestions: string[];
    evaluationSummary?: string;
    keyStrengths?: string[];
    criticalGaps?: string[];
    topperInsights?: string[];
    isFailed?: boolean;
    needsReeval?: boolean;
  }>;
  overallFeedback?: {
    strengths: string[];
    weaknesses: string[];
    nextSteps: string[];
  };
}
