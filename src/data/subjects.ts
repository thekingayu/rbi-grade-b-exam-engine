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
    questionCategories: {
      primaryMcqLabel: 'Static Banking & Financial Awareness',
      primaryMcqSubtext: 'RBI Act 1934, BR Act 1949, monetary policy tools, banking terms & Static GK',
      secondaryMcqLabel: 'Dynamic Current Affairs & Circulars',
      secondaryMcqSubtext: 'Recent 6-month national/intl affairs, Union Budget, Economic Survey & circulars',
      fullMock: { mcqStatic: 30, mcqDynamic: 50, descStatic: 0, descDynamic: 0, durationMinutes: 25 },
      sectional: { mcqStatic: 8, mcqDynamic: 12, descStatic: 0, descDynamic: 0, durationMinutes: 12 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, durationMinutes: 8 }
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
      defaultMcqCount: 20,
      defaultDescCount: 0,
    },
    questionCategories: {
      primaryMcqLabel: 'Core Logic & Analytical Reasoning',
      primaryMcqSubtext: 'Syllogisms, Input-Output, Blood Relations, Inequalities & Direction Sense',
      secondaryMcqLabel: 'Puzzles, Seating & Critical Reasoning',
      secondaryMcqSubtext: 'Floor/flat, circular/linear multi-variable puzzles & Statement-Assumption/Argument',
      fullMock: { mcqStatic: 30, mcqDynamic: 30, descStatic: 0, descDynamic: 0, durationMinutes: 45 },
      sectional: { mcqStatic: 10, mcqDynamic: 10, descStatic: 0, descDynamic: 0, durationMinutes: 20 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, durationMinutes: 12 }
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
    questionCategories: {
      primaryMcqLabel: 'Commercial Arithmetic & Algebra',
      primaryMcqSubtext: 'Profit-loss, SI/CI, time-work, probability, missing/wrong series & quadratic equations',
      secondaryMcqLabel: 'Data Interpretation & Data Sufficiency',
      secondaryMcqSubtext: 'Caselets, Tabular, Radar/Missing DI sets & Quantity I vs Quantity II comparisons',
      fullMock: { mcqStatic: 15, mcqDynamic: 15, descStatic: 0, descDynamic: 0, durationMinutes: 25 },
      sectional: { mcqStatic: 8, mcqDynamic: 7, descStatic: 0, descDynamic: 0, durationMinutes: 15 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, durationMinutes: 10 }
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
    questionCategories: {
      primaryMcqLabel: 'Grammar, Vocabulary & Cloze Mechanics',
      primaryMcqSubtext: 'Error detection, phrase replacement, sentence connectors & single/double fillers',
      secondaryMcqLabel: 'Reading Comprehension & Para Jumbles',
      secondaryMcqSubtext: 'Financial/economic editorial passage inference & discourse sentence rearrangement',
      fullMock: { mcqStatic: 15, mcqDynamic: 15, descStatic: 0, descDynamic: 0, durationMinutes: 25 },
      sectional: { mcqStatic: 8, mcqDynamic: 7, descStatic: 0, descDynamic: 0, durationMinutes: 15 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, durationMinutes: 10 }
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
      defaultMcqCount: 15,
      defaultDescCount: 2,
    },
    questionCategories: {
      primaryMcqLabel: 'Static Macroeconomic & Social Theory MCQs',
      primaryMcqSubtext: 'Growth models, poverty lines, fiscal/monetary transmission & balance of payments',
      secondaryMcqLabel: 'Dynamic Schemes, Budget & Survey MCQs',
      secondaryMcqSubtext: 'Government welfare schemes, budget allocations & economic survey findings',
      primaryDescLabel: 'Theoretical Socio-Economic Essays',
      primaryDescSubtext: '10-Mark / 400-word conceptual policy evaluation prompts',
      secondaryDescLabel: 'Applied Policy & Institutional Analysis',
      secondaryDescSubtext: '15-Mark / 600-word contemporary economic dilemma & roadmap prompts',
      fullMock: { mcqStatic: 15, mcqDynamic: 15, descStatic: 2, descDynamic: 2, durationMinutes: 120 },
      sectional: { mcqStatic: 8, mcqDynamic: 7, descStatic: 1, descDynamic: 1, durationMinutes: 45 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 1, descDynamic: 0, durationMinutes: 25 }
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
    questionCategories: {
      primaryMcqLabel: 'Analytical Structure MCQs',
      primaryMcqSubtext: 'Grammar and coherence mechanics',
      secondaryMcqLabel: 'Editorial Vocabulary MCQs',
      secondaryMcqSubtext: 'Formal central banking terminology',
      primaryDescLabel: 'Official Essay & Speech Précis',
      primaryDescSubtext: '400-word economic/tech essay + 170-word central banking précis prompt',
      secondaryDescLabel: 'Business Reading Comprehension',
      secondaryDescSubtext: 'Descriptive analytical answers based on dense editorial passage',
      fullMock: { mcqStatic: 0, mcqDynamic: 0, descStatic: 2, descDynamic: 1, durationMinutes: 90 },
      sectional: { mcqStatic: 0, mcqDynamic: 0, descStatic: 1, descDynamic: 1, durationMinutes: 45 },
      topicDrill: { mcqStatic: 0, mcqDynamic: 0, descStatic: 1, descDynamic: 0, durationMinutes: 30 }
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
      defaultMcqCount: 15,
      defaultDescCount: 2,
    },
    questionCategories: {
      primaryMcqLabel: 'Financial System, Basel III & Numericals MCQs',
      primaryMcqSubtext: 'Bond yields, financial ratios, money/capital markets & Basel III regulations',
      secondaryMcqLabel: 'Management, Leadership & Governance MCQs',
      secondaryMcqSubtext: 'Motivation theories, leadership models, business ethics & corporate governance',
      primaryDescLabel: 'Financial Regulation & FinTech Essays',
      primaryDescSubtext: '10-Mark / 400-word banking supervision & regulatory prompts',
      secondaryDescLabel: 'Organizational Leadership Case Studies',
      secondaryDescSubtext: '15-Mark / 600-word management decision dilemma & leadership prompts',
      fullMock: { mcqStatic: 15, mcqDynamic: 15, descStatic: 2, descDynamic: 2, durationMinutes: 120 },
      sectional: { mcqStatic: 8, mcqDynamic: 7, descStatic: 1, descDynamic: 1, durationMinutes: 45 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 1, descDynamic: 0, durationMinutes: 25 }
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
    questionCategories: {
      primaryMcqLabel: 'Core Curriculum Concept MCQs',
      primaryMcqSubtext: 'Fundamental syllabus theory & core rules',
      secondaryMcqLabel: 'Applied Analytical MCQs',
      secondaryMcqSubtext: 'Practical application & scenario-based problems',
      primaryDescLabel: 'Analytical Theory Essays',
      primaryDescSubtext: 'Syllabus framework prompts',
      secondaryDescLabel: 'Practical Case Studies',
      secondaryDescSubtext: 'Applied real-world scenarios',
      fullMock: { mcqStatic: 15, mcqDynamic: 15, descStatic: 1, descDynamic: 1, durationMinutes: 45 },
      sectional: { mcqStatic: 8, mcqDynamic: 7, descStatic: 1, descDynamic: 0, durationMinutes: 25 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, durationMinutes: 15 }
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
