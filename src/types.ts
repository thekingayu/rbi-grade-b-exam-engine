export type TestStatus = 'setup' | 'in-progress' | 'completed';

export type ExamMode =
  | 'Full Mock'
  | 'Sectional'
  | 'Topic Drill'
  | 'Quick 10-min'
  | 'Full Phase 1 Mock'
  | 'Full Phase 2 Mock';

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
  syllabusProgress?: Record<string, boolean>;
  updatedAt?: number;
}

export interface SubjectQuestionPreset {
  mcqStatic: number;
  mcqDynamic: number;
  descStatic: number;
  descDynamic: number;
  pyqCount?: number;
  durationMinutes: number;
}

export interface SubjectQuestionCategories {
  primaryMcqLabel: string;
  primaryMcqSubtext: string;
  secondaryMcqLabel: string;
  secondaryMcqSubtext: string;
  primaryDescLabel?: string;
  primaryDescSubtext?: string;
  secondaryDescLabel?: string;
  secondaryDescSubtext?: string;
  fullMock: SubjectQuestionPreset;
  sectional: SubjectQuestionPreset;
  topicDrill: SubjectQuestionPreset;
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
  questionCategories?: SubjectQuestionCategories;
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
  pyqCount?: number;
  mode?: ExamMode;
  targetTopic?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Hard';
  timerEnabled?: boolean;
  negativeMarkingEnabled?: boolean;
  primaryMcqLabel?: string;
  secondaryMcqLabel?: string;
  primaryDescLabel?: string;
  secondaryDescLabel?: string;
}

export type DiFormatType =
  | 'pie'
  | 'double_pie'
  | 'bar_vertical'
  | 'bar_horizontal'
  | 'line'
  | 'table'
  | 'caselet'
  | 'mixed';

export interface DiChartPanel {
  chartType: 'pie' | 'bar_vertical' | 'bar_horizontal' | 'line' | 'table';
  title: string;
  subtitle?: string;
  unit?: string;
  totalLabel?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  categoryKey?: string;
  seriesKeys?: string[];
  data: Array<Record<string, string | number>>;
  columns?: string[];
  rows?: Array<Record<string, string | number>>;
}

export interface DiGroupData {
  groupId: string;
  diType: DiFormatType;
  setTitle: string;
  directions: string;
  notes?: string[];
  charts: DiChartPanel[];
}

export interface Question {
  id?: string;
  type: 'MCQ' | 'Descriptive';
  sourceTag: 'Static' | 'Dynamic';
  isPyq?: boolean;
  pyqYear?: string;
  topic?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Hard';
  subjectId?: string;
  subjectSlug?: string;
  sectionId?: string;
  sectionName?: string;
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
  diGroup?: DiGroupData | null;
  diSetIndex?: number;
  diSetTotal?: number;
}

export interface ExamSectionMeta {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  accentColor: string;
  durationSeconds: number;
  questionCount: number;
  maxMarks: number;
  startIndex: number;
  endIndex: number;
}

export interface PerSubjectScoreSummary {
  sectionId: string;
  slug: string;
  name: string;
  shortName: string;
  accentColor: string;
  score: number;
  maxMarks: number;
  attempted: number;
  correct: number;
  incorrect: number;
  questionCount: number;
  mcqCount: number;
  descCount: number;
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
  isFullPhaseExam?: boolean;
  phaseExamType?: 'Phase 1' | 'Phase 2';
  sections?: ExamSectionMeta[];
  sectionalTimingEnabled?: boolean;
  perSubjectScores?: Record<string, PerSubjectScoreSummary>;
  reattemptOfTestId?: string;
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
    pyq?: number;
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

export type FlashcardConfidence = 'again' | 'hard' | 'good' | 'mastered';

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  hint?: string;
  mnemonic?: string;
  conceptTag: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  sourceExcerpt?: string;
}

export interface FlashcardCardResult {
  cardId: string;
  front: string;
  back: string;
  conceptTag: string;
  rating: FlashcardConfidence;
  timeSpentSeconds: number;
  flipsCount: number;
  attemptsInSession: number;
}

export interface FlashcardDeck {
  id: string;
  userId: string;
  subjectId: string;
  subjectSlug: string;
  subjectName: string;
  title: string;
  topic: string;
  sourceFileNames: string[];
  sourceFileTypes: string[];
  cardCount: number;
  cards: FlashcardItem[];
  createdAt: number;
  lastStudiedAt?: number;
  bestEfficiency?: number;
  totalSessions?: number;
}

export interface FlashcardSession {
  id: string;
  userId: string;
  deckId: string;
  deckTitle: string;
  subjectId: string;
  subjectSlug: string;
  subjectName: string;
  topic: string;
  mode: 'full' | 'weak-drill';
  startedAt: number;
  completedAt: number;
  durationSeconds: number;
  totalCards: number;
  masteredCount: number;
  goodCount: number;
  hardCount: number;
  againCount: number;
  efficiencyScore: number;
  retentionRatePct: number;
  avgSecondsPerCard: number;
  weakCardIds: string[];
  cardResults: FlashcardCardResult[];
}

