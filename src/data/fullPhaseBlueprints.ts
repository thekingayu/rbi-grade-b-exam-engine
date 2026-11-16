export interface BatchTaskSpec {
  batchIndex: number;
  mcqStatic: number;
  mcqDynamic: number;
  descStatic: number;
  descDynamic: number;
  pyqCount: number;
  mcqOneMarkCount?: number;
  mcqTwoMarkCount?: number;
  batchFocus: string;
}

export interface FullPhaseSectionSpec {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  accentColor: string;
  totalMarks: number;
  durationMinutes: number;
  questionCount: number;
  mcqCount: number;
  descCount: number;
  negativeMarking: number;
  description: string;
  batches: BatchTaskSpec[];
}

export interface FullPhaseBlueprint {
  key: 'phase1' | 'phase2';
  id: string;
  slug: 'phase-1-full' | 'phase-2-full';
  phase: 'Phase 1' | 'Phase 2';
  title: string;
  subtitle: string;
  badge: string;
  accentColor: string;
  totalMarks: number;
  totalQuestions: number;
  totalDurationMinutes: number;
  negativeMarkingNote: string;
  sections: FullPhaseSectionSpec[];
}

export const FULL_PHASE_1_BLUEPRINT: FullPhaseBlueprint = {
  key: 'phase1',
  id: 'full_phase_1',
  slug: 'phase-1-full',
  phase: 'Phase 1',
  title: 'Full-Length RBI Grade B Phase 1 Exam',
  subtitle: 'Complete 200-question, 200-mark Preliminary CBT simulation across General Awareness, Reasoning, English & Quant.',
  badge: 'PHASE 1 PRELIMS · 200 Qs · 200 MARKS',
  accentColor: '#0D47FF',
  totalMarks: 200,
  totalQuestions: 200,
  totalDurationMinutes: 120,
  negativeMarkingNote: '-0.25 mark penalty per wrong MCQ across all 4 sections',
  sections: [
    {
      id: 'sub_ga',
      slug: 'general-awareness',
      name: 'General Awareness',
      shortName: 'GA (80 Qs)',
      accentColor: '#0D9488',
      totalMarks: 80,
      durationMinutes: 25,
      questionCount: 80,
      mcqCount: 80,
      descCount: 0,
      negativeMarking: 0.25,
      description: '80 MCQs covering RBI Acts, monetary frameworks, Union Budget, Economic Survey & 2024–2026 current affairs.',
      batches: [
        {
          batchIndex: 1,
          mcqStatic: 20,
          mcqDynamic: 0,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          batchFocus: 'Static Banking Statutes & Monetary Policy: RBI Act 1934 sections, Banking Regulation Act 1949, LAF/SDF/MSF corridor, CRR/SLR, DICGC, FEMA & PMLA'
        },
        {
          batchIndex: 2,
          mcqStatic: 17,
          mcqDynamic: 0,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 3,
          batchFocus: 'Financial Markets, Institutions & Regulatory Ratios: Money/Capital Market instruments, NBFC layers, SEBI/IFSCA/NABARD/SIDBI/EXIM, Basel III buffers, plus 3 authentic PYQs'
        },
        {
          batchIndex: 3,
          mcqStatic: 0,
          mcqDynamic: 20,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          batchFocus: 'Dynamic Union Budget 2025-26, Economic Survey Highlights, Government Flagship Schemes (PM-JAY, PLI, PMAY, PM-KISAN, MSME) & NITI Aayog Indicators'
        },
        {
          batchIndex: 4,
          mcqStatic: 0,
          mcqDynamic: 18,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 2,
          batchFocus: 'Dynamic 2024–2026 RBI Circulars, MPC Decisions, PCA NBFCs, FinTech/CBDC, Global Indices (IMF/BIS/WEF), International Summits & 2 Official Current-Pattern PYQs'
        }
      ]
    },
    {
      id: 'sub_reasoning',
      slug: 'reasoning',
      name: 'Reasoning Aptitude',
      shortName: 'Reasoning (60 Qs)',
      accentColor: '#06B6D4',
      totalMarks: 60,
      durationMinutes: 45,
      questionCount: 60,
      mcqCount: 60,
      descCount: 0,
      negativeMarking: 0.25,
      description: '60 MCQs featuring multi-variable floor/flat/seating puzzles, machine input-output, reverse syllogisms & critical reasoning.',
      batches: [
        {
          batchIndex: 1,
          mcqStatic: 20,
          mcqDynamic: 0,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          batchFocus: 'Core Analytical Logic: Reverse Syllogisms, Multi-step Alphanumeric Machine Input-Output, Coded Inequalities & 3-Generation Coded Blood Relations'
        },
        {
          batchIndex: 2,
          mcqStatic: 0,
          mcqDynamic: 20,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          batchFocus: 'Complex Multi-Variable Puzzles: Floor-with-Flat & Vacant Flat arrangements, Uncertain-Number Linear/Circular Seating facing inward/outward with designation/institution attributes'
        },
        {
          batchIndex: 3,
          mcqStatic: 8,
          mcqDynamic: 8,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 4,
          batchFocus: 'Critical Reasoning (Statement-Assumption, Inference, Course of Action, Weakening), Angular Direction-Distance, 3-Statement Data Sufficiency & 4 Official PYQ-grade Puzzles'
        }
      ]
    },
    {
      id: 'sub_english',
      slug: 'english',
      name: 'English Language',
      shortName: 'English (30 Qs)',
      accentColor: '#EC4899',
      totalMarks: 30,
      durationMinutes: 25,
      questionCount: 30,
      mcqCount: 30,
      descCount: 0,
      negativeMarking: 0.25,
      description: '30 MCQs testing macroeconomic reading comprehension, para jumbles, subjunctive error detection & cloze mechanics.',
      batches: [
        {
          batchIndex: 1,
          mcqStatic: 15,
          mcqDynamic: 0,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          batchFocus: 'Advanced Grammar & Lexical Mechanics: Inverted Conditionals & Subjunctive Error Detection, Phrase Replacement, Clause Connectors & High-Register Double/Triple Fillers'
        },
        {
          batchIndex: 2,
          mcqStatic: 0,
          mcqDynamic: 13,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 2,
          batchFocus: 'Editorial Reading Comprehension (Monetary Policy & Macroeconomics passages with tone/inference/flaw traps), 6-Sentence Para Jumbles & 2 Official PYQs'
        }
      ]
    },
    {
      id: 'sub_quant',
      slug: 'quant',
      name: 'Quantitative Aptitude',
      shortName: 'Quant (30 Qs)',
      accentColor: '#6366F1',
      totalMarks: 30,
      durationMinutes: 25,
      questionCount: 30,
      mcqCount: 30,
      descCount: 0,
      negativeMarking: 0.25,
      description: '30 MCQs featuring 3 complete Data Interpretation sets (5 Qs each: Pie, Bar/Line, Caselet & Mixed DI) plus arithmetic, quadratics, series & data sufficiency.',
      batches: [
        {
          batchIndex: 1,
          mcqStatic: 13,
          mcqDynamic: 0,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 2,
          batchFocus: 'Commercial Arithmetic, Algebra & Sufficiency (13 Static + 2 Official PYQs): Multi-concept Profit/Loss/Partnership/SI-CI/TSD/Time-Work, Wrong/Missing Number Series, Surd/Quadratic Comparisons, Quantity I vs II & 3-Statement Data Sufficiency'
        },
        {
          batchIndex: 2,
          mcqStatic: 0,
          mcqDynamic: 15,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          batchFocus: 'EXACTLY 3 COMPLETE DATA INTERPRETATION SETS (5 Linked MCQs Per Set = 15 Qs total): Set 1 (Single or Double Pie Chart with % or degree distribution), Set 2 (Vertical/Horizontal Bar Graph or Multi-Series Line Graph), Set 3 (Paragraph Caselet DI or Mixed Combination DI such as Table + Pie or Bar + Line)'
        }
      ]
    }
  ]
};

export const FULL_PHASE_2_BLUEPRINT: FullPhaseBlueprint = {
  key: 'phase2',
  id: 'full_phase_2',
  slug: 'phase-2-full',
  phase: 'Phase 2',
  title: 'Full-Length RBI Grade B Phase 2 Exam',
  subtitle: 'Complete 3-Paper, 300-mark Mains selection battery: Paper I (ESI), Paper II (English Writing) & Paper III (FM).',
  badge: 'PHASE 2 MAINS · 3 PAPERS · 300 MARKS',
  accentColor: '#8B5CF6',
  totalMarks: 300,
  totalQuestions: 67,
  totalDurationMinutes: 330,
  negativeMarkingNote: '-1/4th mark penalty on wrong Paper I & III MCQs (0.25 on 1m / 0.50 on 2m)',
  sections: [
    {
      id: 'sub_esi',
      slug: 'esi',
      name: 'Paper I · Economic & Social Issues',
      shortName: 'Paper I: ESI',
      accentColor: '#F59E0B',
      totalMarks: 100,
      durationMinutes: 120,
      questionCount: 34,
      mcqCount: 30,
      descCount: 4,
      negativeMarking: 0.25,
      description: '100 Marks (50 Objective [10×1m + 20×2m] + 50 Descriptive [2×10m + 2×15m]) covering macroeconomics, reforms & social sectors.',
      batches: [
        {
          batchIndex: 1,
          mcqStatic: 15,
          mcqDynamic: 0,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          mcqOneMarkCount: 10,
          mcqTwoMarkCount: 5,
          batchFocus: 'ESI Objective Part A (10 MCQs of 1 mark + 5 MCQs of 2 marks): Static Macroeconomics, Solow Growth, National Income Identities, Poverty Committees, Monetary/Fiscal Transmission & BoP'
        },
        {
          batchIndex: 2,
          mcqStatic: 0,
          mcqDynamic: 13,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 2,
          mcqOneMarkCount: 0,
          mcqTwoMarkCount: 15,
          batchFocus: 'ESI Objective Part B (15 Case/Multi-Statement MCQs of 2 marks each including 2 PYQs): Union Budget & Economic Survey 2024–2026, Flagship Schemes, Global Trade, IMF/WTO & SDG Reports'
        },
        {
          batchIndex: 3,
          mcqStatic: 0,
          mcqDynamic: 0,
          descStatic: 2,
          descDynamic: 2,
          pyqCount: 0,
          batchFocus: 'ESI Descriptive Paper (2 questions of 10 Marks / 400 words Static Macroeconomic Essays + 2 questions of 15 Marks / 600 words Dynamic Policy & Reform Dilemmas)'
        }
      ]
    },
    {
      id: 'sub_english_writing',
      slug: 'english-writing',
      name: 'Paper II · English Writing Skills',
      shortName: 'Paper II: English',
      accentColor: '#8B5CF6',
      totalMarks: 100,
      durationMinutes: 90,
      questionCount: 3,
      mcqCount: 0,
      descCount: 3,
      negativeMarking: 0,
      description: '100 Marks Descriptive Writing: 1 Essay (40 Marks / 400w), 1 Official Speech Précis (30 Marks / 170w) & Reading Comprehension (30 Marks).',
      batches: [
        {
          batchIndex: 1,
          mcqStatic: 0,
          mcqDynamic: 0,
          descStatic: 2,
          descDynamic: 1,
          pyqCount: 0,
          batchFocus: 'Official RBI Grade B Paper II English Writing: Exactly 1 Central-Banking/Economic Essay (maxMarks: 40, wordLimit: 400), 1 Speech/Policy Précis with complete ~450-word source text (maxMarks: 30, wordLimit: 170), and 1 Dense Economic Reading Comprehension with full passage and 5 analytical sub-questions (maxMarks: 30, wordLimit: 350)'
        }
      ]
    },
    {
      id: 'sub_fm',
      slug: 'fm',
      name: 'Paper III · Finance & Management',
      shortName: 'Paper III: FM',
      accentColor: '#10B981',
      totalMarks: 100,
      durationMinutes: 120,
      questionCount: 34,
      mcqCount: 30,
      descCount: 4,
      negativeMarking: 0.25,
      description: '100 Marks (50 Objective [10×1m + 20×2m] + 50 Descriptive [2×10m + 2×15m]) covering Basel III, corporate finance & leadership.',
      batches: [
        {
          batchIndex: 1,
          mcqStatic: 15,
          mcqDynamic: 0,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 0,
          mcqOneMarkCount: 10,
          mcqTwoMarkCount: 5,
          batchFocus: 'FM Objective Part A (10 MCQs of 1 mark + 5 MCQs of 2 marks): Corporate Finance Numericals (WACC, YTM, Duration, DuPont, DSCR, Beta), Derivatives, Basel III CET-1 & Classical Motivation Theories'
        },
        {
          batchIndex: 2,
          mcqStatic: 0,
          mcqDynamic: 13,
          descStatic: 0,
          descDynamic: 0,
          pyqCount: 2,
          mcqOneMarkCount: 0,
          mcqTwoMarkCount: 15,
          batchFocus: 'FM Objective Part B (15 Case/Multi-Statement MCQs of 2 marks each including 2 PYQs): 2024–2026 RBI Master Directions, FinTech/CBDC, Corporate Governance Committees, Ethics & Leadership Caselets'
        },
        {
          batchIndex: 3,
          mcqStatic: 0,
          mcqDynamic: 0,
          descStatic: 2,
          descDynamic: 2,
          pyqCount: 0,
          batchFocus: 'FM Descriptive Paper (2 questions of 10 Marks / 400 words Static Finance/Supervision Essays + 2 questions of 15 Marks / 600 words Leadership & Governance Case Dilemmas)'
        }
      ]
    }
  ]
};

export const FULL_PHASE_BLUEPRINTS: Record<'phase1' | 'phase2', FullPhaseBlueprint> = {
  phase1: FULL_PHASE_1_BLUEPRINT,
  phase2: FULL_PHASE_2_BLUEPRINT
};

export function getFullPhaseDisplayMeta(slug?: string, name?: string) {
  if (slug === 'phase-1-full') {
    return {
      name: name || 'Full-Length Phase 1 Mock',
      accentColor: '#0D47FF',
      icon: 'Compass',
      phase: 'Phase 1' as const
    };
  }
  if (slug === 'phase-2-full') {
    return {
      name: name || 'Full-Length Phase 2 Mock',
      accentColor: '#8B5CF6',
      icon: 'Award',
      phase: 'Phase 2' as const
    };
  }
  return null;
}
