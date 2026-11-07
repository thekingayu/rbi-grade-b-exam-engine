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
      primaryMcqLabel: 'Static Banking, Acts & Monetary Frameworks (PYQ Archetypes)',
      primaryMcqSubtext: 'RBI Act 1934, BR Act 1949, FEMA, monetary policy tools & banking structures based on RBI Grade B PYQs',
      secondaryMcqLabel: 'Dynamic Current Affairs, Circulars & Budget (Recent 2024–2026 Events)',
      secondaryMcqSubtext: 'Recent 6-8 month national/intl affairs, Union Budget, Economic Survey, summits & RBI circulars',
      fullMock: { mcqStatic: 30, mcqDynamic: 45, descStatic: 0, descDynamic: 0, pyqCount: 5, durationMinutes: 25 },
      sectional: { mcqStatic: 8, mcqDynamic: 10, descStatic: 0, descDynamic: 0, pyqCount: 2, durationMinutes: 12 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, pyqCount: 0, durationMinutes: 8 }
    },
    categories: ['Current Affairs', 'Banking & Financial Awareness', 'Economy & Budget', 'Government Schemes', 'Reports & Indices', 'Static GK'],
    syllabusTopics: [
      'Current Affairs (Last 6-8 months: National, International & Banking)',
      'Banking & Financial Awareness (Monetary Policy, Basel, NPAs, PCA)',
      'Economy & Budget (Economic Survey, Union Budget, Fiscal Policies)',
      'Government Schemes (PM-JAY, SVAMITVA, Digital India, Social Welfare)',
      'Reports & Indices (GDP, Inflation, HDI, Global Financial Stability)',
      'Static GK (Institutions, Headquarters, Capitals, Currencies & Reserves)'
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
      fullMock: { mcqStatic: 28, mcqDynamic: 28, descStatic: 0, descDynamic: 0, pyqCount: 4, durationMinutes: 45 },
      sectional: { mcqStatic: 9, mcqDynamic: 9, descStatic: 0, descDynamic: 0, pyqCount: 2, durationMinutes: 20 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, pyqCount: 0, durationMinutes: 12 }
    },
    categories: ['Puzzles & Seating', 'Syllogism', 'Input-Output', 'Inequality', 'Logical Reasoning'],
    syllabusTopics: [
      'Puzzles & Seating Arrangement (Floor, Flat, Circular, Square, Box)',
      'Syllogism & Reverse Syllogism (Only a few, Definite conclusions)',
      'Coding-Decoding (Pattern-based word & number transformations)',
      'Inequality (Direct & Coded symbolic chains)',
      'Blood Relations (Multi-generation family tree & coded relations)',
      'Input-Output (Machine-based alphanumeric step arrangement)',
      'Direction & Distance (Movement tracking, angles & shadow angles)',
      'Order & Ranking & Alphanumeric Series',
      'Data Sufficiency (2 & 3 statement evaluations)',
      'Logical & Critical Reasoning (Assumptions, Inferences, Course of Action)',
      'Cause & Effect (Relationship between institutional events)'
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
      fullMock: { mcqStatic: 14, mcqDynamic: 14, descStatic: 0, descDynamic: 0, pyqCount: 2, durationMinutes: 25 },
      sectional: { mcqStatic: 7, mcqDynamic: 6, descStatic: 0, descDynamic: 0, pyqCount: 2, durationMinutes: 15 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, pyqCount: 0, durationMinutes: 10 }
    },
    categories: ['Data Interpretation', 'Commercial Arithmetic', 'Quadratic Equations', 'Number Series'],
    syllabusTopics: [
      'Data Interpretation & Caselets (Tables, Bar, Line, Pie, Radar & Missing DI)',
      'Number Series (Missing number & wrong number pattern finding)',
      'Quadratic Equations & Quantity Comparison (Q1 vs Q2)',
      'Simple & Compound Interest (Half-yearly/annual growth differences)',
      'Profit, Loss & Discount (Cost price, selling price, successive markups)',
      'Time & Work (Pipes, cisterns & alternate-day efficiency)',
      'Time, Speed & Distance (Relative speed, trains, boats & circular motion)',
      'Percentage, Average & Partnership (Weighted averages & ratio variation)',
      'Mixture & Allegation (Replacement & ratio blending)',
      'Mensuration & Probability (Permutations, combinations & geometry)'
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
      fullMock: { mcqStatic: 14, mcqDynamic: 14, descStatic: 0, descDynamic: 0, pyqCount: 2, durationMinutes: 25 },
      sectional: { mcqStatic: 7, mcqDynamic: 6, descStatic: 0, descDynamic: 0, pyqCount: 2, durationMinutes: 15 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, pyqCount: 0, durationMinutes: 10 }
    },
    categories: ['Reading Comprehension', 'Cloze Test', 'Error Detection', 'Para Jumbles', 'Vocabulary'],
    syllabusTopics: [
      'Reading Comprehension (Financial/editorial passages, tone & inferences)',
      'Cloze Test (Contextual grammar & technical vocabulary)',
      'Error Detection & Sentence Correction (Subjunctive, parallelism, inversion)',
      'Para Jumbles (Arranging sentences in coherent editorial order)',
      'Vocabulary, Synonyms & Antonyms in Context',
      'Sentence Improvement & Connectors (Clause linkers & starters)',
      'Fill in the Blanks (Single and double contextual fillers)',
      'Phrase Replacement & Word Swap in Economic Context',
      'Idioms, Phrasal Verbs & Paragraph Completion'
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
      primaryMcqLabel: 'Static Macroeconomics & Social Theory (PYQ Archetypes)',
      primaryMcqSubtext: 'Growth models, poverty lines, monetary/fiscal transmission & BoP based on RBI Grade B PYQs',
      secondaryMcqLabel: 'Dynamic Schemes, Budget & Survey (Recent 2024–2026 Events)',
      secondaryMcqSubtext: 'Recent Union Budget, Economic Survey findings, government flagship schemes & NITI Aayog indices',
      primaryDescLabel: 'Static Conceptual Socio-Economic Essays',
      primaryDescSubtext: '10-Mark / 400-word economic theory & institutional framework prompts',
      secondaryDescLabel: 'Dynamic Policy & Contemporary Dilemmas',
      secondaryDescSubtext: '15-Mark / 600-word contemporary economic dilemma & forward roadmap prompts',
      fullMock: { mcqStatic: 14, mcqDynamic: 14, descStatic: 2, descDynamic: 2, pyqCount: 2, durationMinutes: 120 },
      sectional: { mcqStatic: 7, mcqDynamic: 6, descStatic: 1, descDynamic: 1, pyqCount: 2, durationMinutes: 45 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 1, descDynamic: 0, pyqCount: 0, durationMinutes: 25 }
    },
    categories: ['Growth & Development', 'Poverty & Employment', 'Sustainable Development', 'Economic Reforms', 'Money & Banking'],
    syllabusTopics: [
      'Growth & Development (National income, per capita, sector shares in GDP)',
      'Poverty & Employment (Measurement, alleviation programmes, job creation)',
      'Sustainable Development (Environmental issues, climate change, green finance)',
      'Economic Reforms (LPG, public/private sector roles, recent structural reforms)',
      'Money, Banking & Public Finance (Monetary/fiscal policy, inflation, Union Budget)',
      'Globalisation (BOP, EXIM policy, IMF, World Bank, WTO, regional trade)',
      'Social Structure in India (Demographics, urbanisation, gender, social justice)',
      'Indian Political System (Governance structure, public policy formulation)',
      'Human Development & Social Sector (Health, education, welfare indices)',
      'Priority Focus Areas (Agriculture, MSME, labour reforms, digital economy)'
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
      fullMock: { mcqStatic: 0, mcqDynamic: 0, descStatic: 2, descDynamic: 1, pyqCount: 0, durationMinutes: 90 },
      sectional: { mcqStatic: 0, mcqDynamic: 0, descStatic: 1, descDynamic: 1, pyqCount: 0, durationMinutes: 45 },
      topicDrill: { mcqStatic: 0, mcqDynamic: 0, descStatic: 1, descDynamic: 0, pyqCount: 0, durationMinutes: 30 }
    },
    categories: ['Essay Writing', 'Precis Writing', 'Reading Comprehension', 'Business Correspondence'],
    syllabusTopics: [
      'Essay Writing (400 words on economic, social, technological or current themes)',
      'Precis Writing (170 words summarising official banking speech or policy report)',
      'Reading Comprehension (Descriptive analysis & inferences on dense passages)',
      'Business & Office Correspondence (Formal central banking letters & policy memos)'
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
      primaryMcqLabel: 'Static Finance, Basel III & Numericals (PYQ Archetypes)',
      primaryMcqSubtext: 'Bond yields, WACC, DuPont ratios, capital markets & Basel III formulas based on RBI Grade B PYQs',
      secondaryMcqLabel: 'Dynamic Financial Updates & Recent Circulars (2024–2026)',
      secondaryMcqSubtext: 'Recent 2024-2026 RBI Master Directions, FinTech, CBDC, dynamic risk weights & market reforms',
      primaryDescLabel: 'Static Financial & Leadership Framework Essays',
      primaryDescSubtext: '10-Mark / 400-word banking supervision, Basel & classical management models',
      secondaryDescLabel: 'Dynamic Governance & Contemporary Case Dilemmas',
      secondaryDescSubtext: '15-Mark / 600-word contemporary corporate governance & institutional dilemmas',
      fullMock: { mcqStatic: 14, mcqDynamic: 14, descStatic: 2, descDynamic: 2, pyqCount: 2, durationMinutes: 120 },
      sectional: { mcqStatic: 7, mcqDynamic: 6, descStatic: 1, descDynamic: 1, pyqCount: 2, durationMinutes: 45 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 1, descDynamic: 0, pyqCount: 0, durationMinutes: 25 }
    },
    categories: ['Financial System', 'Financial Markets', 'Risk Management', 'General Management', 'Leadership', 'Ethics'],
    syllabusTopics: [
      'Financial System & Intermediaries (Structure, regulators & instruments)',
      'Functions of RBI & Specialized Institutions (NABARD, SIDBI, EXIM, NHB)',
      'Financial Markets (Money, capital, forex, bond and equity markets)',
      'Risk Management & Basel Norms (Credit, market, operational risk & NPAs)',
      'Derivatives (Forwards, futures, options, swaps & hedging)',
      'Banking Sector Trends & Reforms (Digital transformation, UPI, CBDC)',
      'Financial Inclusion & Technology in Banking',
      'Public Finance, Union Budget & Fiscal Policy (FRBM Act, GST, taxes)',
      'Inflation (CPI, WPI trends, causes & monetary control measures)',
      'Corporate Governance in Banking & Financial Sector',
      'PPP & Portfolio Investments',
      'Management Basics & Process (Planning, organising, staffing, directing, controlling)',
      'Leadership Styles & Theories (Transformational, situational, Blake-Mouton)',
      'Human Resource Development (HRD, performance appraisal, training)',
      'Motivation & Morale (Maslow, Herzberg, McGregor, Vroom theories)',
      'Communication (Processes, barriers & role of IT in communication)',
      'Organisational Behaviour (Team dynamics, conflict & decision making)',
      'Corporate Governance & Business Ethics'
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
      fullMock: { mcqStatic: 14, mcqDynamic: 14, descStatic: 1, descDynamic: 1, pyqCount: 2, durationMinutes: 45 },
      sectional: { mcqStatic: 7, mcqDynamic: 6, descStatic: 1, descDynamic: 0, pyqCount: 2, durationMinutes: 25 },
      topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, pyqCount: 0, durationMinutes: 15 }
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
