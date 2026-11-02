import { Subject } from '../types';

export const INITIAL_SUBJECTS: Subject[] = [
  // Phase 1 Subjects
  {
    id: 'sub_ga',
    slug: 'general-awareness',
    name: 'General Awareness',
    phase: 'Phase 1',
    accentColor: '#0D9488', // Teal
    icon: 'Brain',
    totalMarks: 80,
    durationMinutes: 25,
    negativeMarking: 0.25,
    questionTypeMix: {
      mcq: true,
      descriptive: false,
      defaultMcqCount: 20,
      defaultDescCount: 0,
    },
    categories: ['Static GK', 'Current Affairs', 'Banking & Financial Awareness', 'RBI Notifications', 'Union Budget & Surveys'],
    syllabusTopics: [
      'Monetary Policy & Inflation Dynamics',
      'Banking Structure & Basel III Norms',
      'RBI Circulars & Regulatory Frameworks',
      'Union Budget & Fiscal Policy',
      'International Financial Institutions (IMF, WB, BIS)',
      'Government Social Sector Schemes',
      'National & International Current Affairs'
    ],
    description: 'High-speed 80-mark section testing central banking, financial developments, and macroeconomic updates.'
  },
  {
    id: 'sub_reasoning',
    slug: 'reasoning',
    name: 'Reasoning Aptitude',
    phase: 'Phase 1',
    accentColor: '#06B6D4', // Cyan
    icon: 'Compass',
    totalMarks: 60,
    durationMinutes: 45,
    negativeMarking: 0.25,
    questionTypeMix: {
      mcq: true,
      descriptive: false,
      defaultMcqCount: 15,
      defaultDescCount: 0,
    },
    categories: ['Critical Reasoning', 'Puzzles & Seating', 'Analytical Logic', 'Data Sufficiency'],
    syllabusTopics: [
      'Complex Multi-variable Puzzles',
      'Floor & Scheduling Seating Arrangements',
      'Critical & Evaluative Reasoning',
      'Syllogisms & Reverse Syllogisms',
      'Machine Input-Output Dynamics',
      'Data Sufficiency & Statement Logic'
    ],
    description: 'Advanced logical rigor, multi-layer scheduling puzzles, and critical administrative decision logic.'
  },
  {
    id: 'sub_quant',
    slug: 'quant',
    name: 'Quantitative Aptitude',
    phase: 'Phase 1',
    accentColor: '#6366F1', // Indigo
    icon: 'Calculator',
    totalMarks: 30,
    durationMinutes: 25,
    negativeMarking: 0.25,
    questionTypeMix: {
      mcq: true,
      descriptive: false,
      defaultMcqCount: 15,
      defaultDescCount: 0,
    },
    categories: ['Data Interpretation', 'Arithmetic Systems', 'Algebraic Inequalities', 'Number Series'],
    syllabusTopics: [
      'Caselet & Radar Data Interpretation',
      'Profit, Loss & Commercial Mathematics',
      'Time, Speed, Distance & Work Equations',
      'Probability & Combinatorics',
      'Missing & Wrong Number Series',
      'Quadratic & Polynomial Comparisons'
    ],
    description: 'High-precision numerical problem solving, caselet analysis, and mathematical modeling.'
  },
  {
    id: 'sub_english',
    slug: 'english',
    name: 'English Language',
    phase: 'Phase 1',
    accentColor: '#EC4899', // Rose/Pink
    icon: 'BookOpen',
    totalMarks: 30,
    durationMinutes: 25,
    negativeMarking: 0.25,
    questionTypeMix: {
      mcq: true,
      descriptive: false,
      defaultMcqCount: 15,
      defaultDescCount: 0,
    },
    categories: ['Reading Comprehension', 'Error Detection', 'Sentence Rearrangement', 'Cloze Test'],
    syllabusTopics: [
      'Financial & Macroeconomic Passage Comprehension',
      'Parajumbles & Coherence Analysis',
      'Phrase Replacement & Contextual Usage',
      'Sentence Connector & Fillers',
      'Idiomatic & Grammatical Nuances'
    ],
    description: 'Verbal acumen, complex passage inference, and editorial syntactic comprehension.'
  },

  // Phase 2 Subjects
  {
    id: 'sub_esi',
    slug: 'esi',
    name: 'Economic & Social Issues',
    phase: 'Phase 2',
    accentColor: '#F59E0B', // Amber
    icon: 'TrendingUp',
    totalMarks: 100,
    durationMinutes: 120,
    negativeMarking: 0.25,
    questionTypeMix: {
      mcq: true,
      descriptive: true,
      defaultMcqCount: 10,
      defaultDescCount: 2,
    },
    categories: ['Static Theory', 'Dynamic Economic Policy', 'Social Infrastructure', 'Sustainable Development'],
    syllabusTopics: [
      'Growth & Development: Poverty, Unemployment & HDI',
      'Monetary & Fiscal Transmission Mechanism',
      'Balance of Payments & Foreign Trade Policy',
      'Sustainable Development & Green Finance',
      'Demographic Dividend & Social Sector Reforms',
      'Multilateral Institutions & Global Financial System'
    ],
    description: 'Comprehensive 100-mark paper: 50 Marks MCQ + 50 Marks Analytical Descriptive on India’s socio-economic landscape.'
  },
  {
    id: 'sub_english_writing',
    slug: 'english-writing',
    name: 'English Writing Skills',
    phase: 'Phase 2',
    accentColor: '#8B5CF6', // Purple
    icon: 'PenTool',
    totalMarks: 100,
    durationMinutes: 90,
    negativeMarking: 0,
    questionTypeMix: {
      mcq: false,
      descriptive: true,
      defaultMcqCount: 0,
      defaultDescCount: 3,
    },
    categories: ['Essay Writing', 'Précis Writing', 'Reading Comprehension Analysis'],
    syllabusTopics: [
      'Economic Policy Essay (400 words)',
      'Central Banking & FinTech Disruption Essay',
      'Précis Writing of Financial Speeches (170 words)',
      'Descriptive Business Reading Comprehension',
      'Drafting Official Reports & Policy Briefs'
    ],
    description: 'Phase 2 descriptive paper evaluating clarity, structural coherence, and editorial precision in written expression.'
  },
  {
    id: 'sub_fm',
    slug: 'fm',
    name: 'Finance & Management',
    phase: 'Phase 2',
    accentColor: '#10B981', // Emerald
    icon: 'DollarSign',
    totalMarks: 100,
    durationMinutes: 120,
    negativeMarking: 0.25,
    questionTypeMix: {
      mcq: true,
      descriptive: true,
      defaultMcqCount: 10,
      defaultDescCount: 2,
    },
    categories: ['Financial System', 'Financial Markets', 'General Management', 'Corporate Governance'],
    syllabusTopics: [
      'Structure of Financial & Capital Markets',
      'RBI Regulations, Risk Management & Basel III',
      'Fintech, CBDC & Digital Payment Architecture',
      'Leadership Theories & Organizational Behavior',
      'Motivation, Emotional Intelligence & Ethics',
      'Corporate Governance & Communication Channels'
    ],
    description: '50 Marks MCQ + 50 Marks Descriptive covering financial architecture, central banking regulation, and leadership theory.'
  },

  // Legacy/Fallback Subject
  {
    id: 'sub_uncategorized',
    slug: 'uncategorized',
    name: 'Uncategorised / General',
    phase: 'Phase 1',
    accentColor: '#64748B', // Slate
    icon: 'Layers',
    totalMarks: 50,
    durationMinutes: 45,
    negativeMarking: 0.25,
    questionTypeMix: {
      mcq: true,
      descriptive: true,
      defaultMcqCount: 10,
      defaultDescCount: 1,
    },
    categories: ['General', 'Mixed'],
    syllabusTopics: ['Mixed Curriculum', 'Uncategorized Practice'],
    description: 'Repository for legacy tests or general mixed-subject curriculum notes.'
  }
];

export function getSubjectBySlug(slug: string): Subject | undefined {
  return INITIAL_SUBJECTS.find(s => s.slug === slug);
}

export function getSubjectById(id: string): Subject | undefined {
  return INITIAL_SUBJECTS.find(s => s.id === id);
}
