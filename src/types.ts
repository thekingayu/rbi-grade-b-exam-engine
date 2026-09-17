export type TestStatus = 'setup' | 'in-progress' | 'completed';

export interface TestConfig {
  mcqStatic: number;
  mcqDynamic: number;
  descStatic: number;
  descDynamic: number;
}

export interface Question {
  id?: string;
  type: 'MCQ' | 'Descriptive';
  sourceTag: 'Static' | 'Dynamic';
  text: string;
  options?: string[] | null;
  correctAnswer?: string | null;
  modelAnswer?: string | null;
  markingScheme?: Record<string, number> | null;
  wordLimit?: number | null;
  maxMarks: number;
  userAnswer?: string | null;
}

export interface TestAttempt {
  id: string;
  userId: string;
  createdAt: number;
  status: TestStatus;
  config: TestConfig;
  sourceNoteFileRefs: string[];
  extractedNotesText: string;
  durationSeconds: number;
  startedAt?: number;
  submittedAt?: number;
  questions: Question[]; // Storing inline for simplicity
  answers?: Record<string, string>;
  totalScore?: number;
  sectionScores?: {
    mcqStatic: number;
    mcqDynamic: number;
    descStatic: number;
    descDynamic: number;
  };
  evaluations?: Record<string, { // questionId -> evaluation
    totalScore: number;
    scoreBreakdown: Record<string, number>;
    feedbackPoints: string[];
    suggestions: string[];
  }>;
  overallFeedback?: {
    strengths: string[];
    weaknesses: string[];
    nextSteps: string[];
  };
}
