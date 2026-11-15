import { useState } from 'react';
import { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useSubject } from '../context/SubjectContext';
import {
  Download, CheckSquare, Square, Search,
  ArrowRight, Award, Compass, Sparkles,
  ChevronRight, BarChart2, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MotionPage,
  MotionSection,
  MotionStaggerGrid,
  MotionStaggerItem,
  AnimatedNumber,
  SPRING_SNAPPY,
  SPRING_TACTILE,
  EASE_OUT_EXPO,
} from '../components/MotionPrimitives';

interface SyllabusTopicItem {
  id: string;
  topic: string;
  whatToCover: string;
  highWeightage?: boolean;
  subjectSlug: string;
}

interface SyllabusSection {
  code: string;
  title: string;
  badge: string;
  subjectSlug: string;
  questionsOrMarks: string;
  duration: string;
  nature: string;
  topics: SyllabusTopicItem[];
  keyReports?: string[];
}

const SYLLABUS_SECTIONS: SyllabusSection[] = [
  // PART A - PHASE 1
  {
    code: 'A1',
    title: 'General Awareness',
    badge: 'Phase 1 • Prelims',
    subjectSlug: 'general-awareness',
    questionsOrMarks: '80 Questions (80 Marks)',
    duration: '25 min sectional window',
    nature: 'Objective MCQ (-0.25 penalty)',
    topics: [
      {
        id: 'ga_current_affairs',
        topic: 'Current Affairs',
        whatToCover: 'Last 6-8 months: national and international news, banking and RBI updates, policies, reports, summits, appointments, awards.',
        highWeightage: true,
        subjectSlug: 'general-awareness'
      },
      {
        id: 'ga_banking_awareness',
        topic: 'Banking & Financial Awareness',
        whatToCover: 'Basics of banking, monetary policy (Repo, Reverse Repo, CRR, SLR), financial institutions, Basel norms, NPAs, PCA framework, financial inclusion, RBI circulars and recent regulatory changes.',
        highWeightage: true,
        subjectSlug: 'general-awareness'
      },
      {
        id: 'ga_economy_budget',
        topic: 'Economy & Budget',
        whatToCover: 'Economic Survey, Union Budget, government economic policies, key economic terms and concepts.',
        highWeightage: true,
        subjectSlug: 'general-awareness'
      },
      {
        id: 'ga_govt_schemes',
        topic: 'Government Schemes',
        whatToCover: 'Major central schemes, their objectives and target beneficiaries (e.g. PM-JAY, SVAMITVA, Digital India, PM-KISAN, PMFBY).',
        highWeightage: true,
        subjectSlug: 'general-awareness'
      },
      {
        id: 'ga_reports_indices',
        topic: 'Reports & Indices',
        whatToCover: 'GDP, inflation, Human Development Index, Global Hunger Index, World Economic Outlook, Global Financial Stability Report and similar international rankings.',
        subjectSlug: 'general-awareness'
      },
      {
        id: 'ga_static_gk',
        topic: 'Static GK',
        whatToCover: "Important places, organisations, books and historical facts; banks' headquarters and taglines; countries' capitals and currencies; important days, national parks, wildlife sanctuaries and dams.",
        subjectSlug: 'general-awareness'
      }
    ]
  },
  {
    code: 'A2',
    title: 'Quantitative Aptitude',
    badge: 'Phase 1 • Prelims',
    subjectSlug: 'quant',
    questionsOrMarks: '30 Questions (30 Marks)',
    duration: '25 min sectional window',
    nature: 'Objective MCQ (-0.25 penalty)',
    topics: [
      {
        id: 'qa_di_caselets',
        topic: 'Data Interpretation & Caselets',
        whatToCover: 'Tables, bar graphs, line graphs, pie charts, caselet DI, radar DI, and mixed graphs requiring multi-step arithmetic.',
        highWeightage: true,
        subjectSlug: 'quant'
      },
      {
        id: 'qa_num_series',
        topic: 'Number Series',
        whatToCover: 'Missing number and wrong number series; advanced pattern finding with polynomial or exponential shifts.',
        highWeightage: true,
        subjectSlug: 'quant'
      },
      {
        id: 'qa_quadratics',
        topic: 'Quadratic Equations & Quantity Comparison',
        whatToCover: 'Solving for roots and comparing x and y; Quantity I vs Quantity II comparisons across commercial topics.',
        highWeightage: true,
        subjectSlug: 'quant'
      },
      {
        id: 'qa_commercial_si_ci',
        topic: 'Simple & Compound Interest',
        whatToCover: 'Interest calculations, growth patterns, semi-annual compounding, difference between SI and CI.',
        highWeightage: true,
        subjectSlug: 'quant'
      },
      {
        id: 'qa_profit_loss',
        topic: 'Profit, Loss & Discount',
        whatToCover: 'Cost price, selling price, marked price, successive discounts, false weights and dishonest dealers.',
        subjectSlug: 'quant'
      },
      {
        id: 'qa_time_work',
        topic: 'Time & Work',
        whatToCover: 'Work efficiency, pipes and cisterns, alternate-day work sequences and wages distribution.',
        subjectSlug: 'quant'
      },
      {
        id: 'qa_time_speed_dist',
        topic: 'Time, Speed & Distance',
        whatToCover: 'Relative speed, trains, boats and streams, races, circular motion.',
        subjectSlug: 'quant'
      },
      {
        id: 'qa_percentage_avg',
        topic: 'Percentage & Average',
        whatToCover: 'Percentage change, successive percentages, weighted averages, age problems.',
        subjectSlug: 'quant'
      },
      {
        id: 'qa_ratio_partnership',
        topic: 'Ratio, Proportion & Partnership',
        whatToCover: 'Ratio and proportion, variation, ages, partnership capitals and time periods.',
        subjectSlug: 'quant'
      },
      {
        id: 'qa_mixture_allegation',
        topic: 'Mixture & Allegation',
        whatToCover: 'Combining ratios and quantities, multi-step replacement problems.',
        subjectSlug: 'quant'
      },
      {
        id: 'qa_simplification',
        topic: 'Simplification & Approximation',
        whatToCover: 'Quick calculations using BODMAS, fractions, surds and indices.',
        subjectSlug: 'quant'
      },
      {
        id: 'qa_mensuration_prob',
        topic: 'Mensuration & Miscellaneous',
        whatToCover: 'Area, perimeter, volume of standard figures; permutation, combination and conditional probability basics.',
        subjectSlug: 'quant'
      }
    ]
  },
  {
    code: 'A3',
    title: 'English Language',
    badge: 'Phase 1 • Prelims',
    subjectSlug: 'english',
    questionsOrMarks: '30 Questions (30 Marks)',
    duration: '25 min sectional window',
    nature: 'Objective MCQ (-0.25 penalty)',
    topics: [
      {
        id: 'eng_rc',
        topic: 'Reading Comprehension',
        whatToCover: 'Passage-based questions testing understanding, inference, author tone and vocabulary in macroeconomic/financial context.',
        highWeightage: true,
        subjectSlug: 'english'
      },
      {
        id: 'eng_para_jumbles',
        topic: 'Para Jumbles',
        whatToCover: 'Arranging 5-6 editorial sentences in a logical, coherent sequential order.',
        highWeightage: true,
        subjectSlug: 'english'
      },
      {
        id: 'eng_error_detection',
        topic: 'Error Detection',
        whatToCover: 'Spotting grammatical mistakes in multi-part sentences (subjunctive, parallelism, inversion).',
        highWeightage: true,
        subjectSlug: 'english'
      },
      {
        id: 'eng_cloze',
        topic: 'Cloze Test',
        whatToCover: 'Fill in the blanks in a passage using context, syntax and formal central banking vocabulary.',
        highWeightage: true,
        subjectSlug: 'english'
      },
      {
        id: 'eng_sentence_improvement',
        topic: 'Sentence Improvement & Phrase Replacement',
        whatToCover: 'Correcting sentence structure and replacing incorrect phrases with standard idioms/clauses.',
        subjectSlug: 'english'
      },
      {
        id: 'eng_fillers',
        topic: 'Fill in the Blanks',
        whatToCover: 'Single and double fillers based on high-register economic vocabulary and grammatical context.',
        subjectSlug: 'english'
      },
      {
        id: 'eng_word_swap',
        topic: 'Word Swap',
        whatToCover: 'Interchanging highlighted words in complex sentences to form meaningful structures.',
        subjectSlug: 'english'
      },
      {
        id: 'eng_vocabulary',
        topic: 'Vocabulary & Idioms',
        whatToCover: 'Synonyms, antonyms, word usage, phrasal verbs and figurative meanings.',
        subjectSlug: 'english'
      },
      {
        id: 'eng_para_completion',
        topic: 'Paragraph Completion',
        whatToCover: 'Completing an incomplete editorial passage logically with the best fitting concluding statement.',
        subjectSlug: 'english'
      }
    ]
  },
  {
    code: 'A4',
    title: 'Reasoning Ability',
    badge: 'Phase 1 • Prelims',
    subjectSlug: 'reasoning',
    questionsOrMarks: '60 Questions (60 Marks)',
    duration: '45 min sectional window',
    nature: 'Objective MCQ (-0.25 penalty)',
    topics: [
      {
        id: 'reas_puzzles_seating',
        topic: 'Puzzles & Seating Arrangement',
        whatToCover: 'Linear, circular, square, floor-based, flat-based and box-based multi-variable arrangements (highest weightage: 20-40 Qs).',
        highWeightage: true,
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_logical_critical',
        topic: 'Logical & Critical Reasoning',
        whatToCover: 'Statement-based questions: assumptions, inferences, course of action, strengthening and weakening arguments.',
        highWeightage: true,
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_machine_input_output',
        topic: 'Input-Output (Machine Rearrangement)',
        whatToCover: 'Machine-based step-wise arrangement patterns of words and numbers with transformation rules.',
        highWeightage: true,
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_syllogism',
        topic: 'Syllogism & Reverse Syllogisms',
        whatToCover: 'Drawing logical conclusions from statements, including new-pattern "Only a few", "Can never be" conditions.',
        highWeightage: true,
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_inequalities',
        topic: 'Inequality (Direct & Coded)',
        whatToCover: 'Direct and coded inequality questions with chained relational symbols.',
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_blood_relations',
        topic: 'Blood Relations',
        whatToCover: 'Family-tree and relationship problems across 3 generations with coded representations.',
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_direction_distance',
        topic: 'Direction & Distance',
        whatToCover: 'Tracking complex movement, final position, degree turns, angles and shadow logic.',
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_coding_decoding',
        topic: 'Coding-Decoding',
        whatToCover: 'Pattern-based transformations of words, letters and numbers.',
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_data_sufficiency',
        topic: 'Data Sufficiency',
        whatToCover: 'Deciding whether given 2 or 3 statements are sufficient to answer the problem.',
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_order_ranking',
        topic: 'Order & Ranking & Alphanumeric Series',
        whatToCover: 'Position-based problems in a sequence, overlapping ranks, and mixed letter-number series.',
        subjectSlug: 'reasoning'
      },
      {
        id: 'reas_cause_effect',
        topic: 'Cause & Effect',
        whatToCover: 'Identifying causal vs incidental relationships between events.',
        subjectSlug: 'reasoning'
      }
    ]
  },

  // PART B - PHASE 2 (MAINS)
  {
    code: 'B1',
    title: 'Paper I: Economic & Social Issues (ESI)',
    badge: 'Phase 2 • Paper I',
    subjectSlug: 'esi',
    questionsOrMarks: '100 Marks (50M MCQ + 50M Desc)',
    duration: '120 min (30m MCQ + 90m Desc)',
    nature: 'Objective + Typed Descriptive',
    keyReports: [
      'Union Budget (Current Fiscal Year)',
      'Economic Survey of India',
      'RBI Annual Report & Report on Currency and Finance',
      'World Bank World Development Report',
      'IMF World Economic Outlook (WEO)',
      'UNDP Human Development Report (HDR)'
    ],
    topics: [
      {
        id: 'esi_growth_dev',
        topic: '1. Growth & Development',
        whatToCover: 'Measurement of growth: national income and per capita income; role and share of agriculture, industry and services in GDP; industrial and labour policy.',
        highWeightage: true,
        subjectSlug: 'esi'
      },
      {
        id: 'esi_poverty_employment',
        topic: '2. Poverty & Employment',
        whatToCover: 'Concepts and measurement of poverty (Tendulkar, Rangarajan committees), poverty alleviation programmes, employment generation, unemployment trends.',
        highWeightage: true,
        subjectSlug: 'esi'
      },
      {
        id: 'esi_sustainable_dev',
        topic: '3. Sustainable Development',
        whatToCover: 'Environmental issues, climate change, green finance, renewable energy commitments, sustainability practices.',
        subjectSlug: 'esi'
      },
      {
        id: 'esi_economic_reforms',
        topic: '4. Economic Reforms',
        whatToCover: 'Liberalisation, privatisation, globalisation (LPG); role of public and private sectors; recent structural reforms.',
        subjectSlug: 'esi'
      },
      {
        id: 'esi_money_banking_fiscal',
        topic: '5. Money, Banking & Public Finance',
        whatToCover: 'Monetary policy, fiscal policy, inflation targeting, financial sector reforms, capital markets, FDI and foreign aid, Union Budget, taxation.',
        highWeightage: true,
        subjectSlug: 'esi'
      },
      {
        id: 'esi_globalisation',
        topic: '6. Globalisation',
        whatToCover: 'Opening up of the Indian economy, balance of payments (BOP), EXIM policy, IMF, World Bank, WTO, regional economic cooperation.',
        highWeightage: true,
        subjectSlug: 'esi'
      },
      {
        id: 'esi_social_structure',
        topic: '7. Social Structure in India',
        whatToCover: 'Multiculturalism, demographic trends, urbanisation and migration, gender issues, social justice, positive discrimination for underprivileged, social movements.',
        subjectSlug: 'esi'
      },
      {
        id: 'esi_indian_political_sys',
        topic: '8. Indian Political System',
        whatToCover: 'Governance structure, federalism, public policy formulation and policy-making mechanisms.',
        subjectSlug: 'esi'
      },
      {
        id: 'esi_human_development',
        topic: '9. Human Development & Social Sector',
        whatToCover: 'Health, education, welfare schemes, social sector initiatives, human development indicators.',
        highWeightage: true,
        subjectSlug: 'esi'
      },
      {
        id: 'esi_frequently_asked',
        topic: '10. Frequently Asked Areas',
        whatToCover: 'Agriculture, MSME sector, urbanisation, labour reforms, financial inclusion, digital economy, and FinTech disruption.',
        highWeightage: true,
        subjectSlug: 'esi'
      }
    ]
  },
  {
    code: 'B2',
    title: 'Paper II: English (Writing Skills)',
    badge: 'Phase 2 • Paper II',
    subjectSlug: 'english-writing',
    questionsOrMarks: '100 Marks (3 Descriptive Prompts)',
    duration: '90 min typed on screen',
    nature: '100% Typed Descriptive',
    topics: [
      {
        id: 'eng_w_essay',
        topic: 'Essay Writing (40 Marks)',
        whatToCover: 'Structured essays on economic, social, technological or current financial topics with clear thesis, logical arguments, and conclusion (approx. 400 words).',
        highWeightage: true,
        subjectSlug: 'english-writing'
      },
      {
        id: 'eng_w_precis',
        topic: 'Précis Writing (30 Marks)',
        whatToCover: 'Summarising an official central banking speech or policy report concisely while retaining the core proposition and assigning a suitable title (approx. 170 words).',
        highWeightage: true,
        subjectSlug: 'english-writing'
      },
      {
        id: 'eng_w_rc',
        topic: 'Reading Comprehension (30 Marks)',
        whatToCover: 'Understanding a dense analytical financial passage and typing precise answers to 4-5 descriptive questions.',
        highWeightage: true,
        subjectSlug: 'english-writing'
      },
      {
        id: 'eng_w_correspondence',
        topic: 'Business / Office Correspondence',
        whatToCover: 'Formal letters, policy memos and official communication in an authoritative administrative tone.',
        subjectSlug: 'english-writing'
      }
    ]
  },
  {
    code: 'B3',
    title: 'Paper III: Finance & Management (FM)',
    badge: 'Phase 2 • Paper III',
    subjectSlug: 'fm',
    questionsOrMarks: '100 Marks (50M MCQ + 50M Desc)',
    duration: '120 min (30m MCQ + 90m Desc)',
    nature: 'Objective + Typed Descriptive',
    topics: [
      // Part 1: Finance
      {
        id: 'fm_financial_system',
        topic: 'Financial System & Intermediaries',
        whatToCover: 'Structure of the Indian financial system, financial intermediaries, instruments, and regulators (RBI, SEBI, IRDAI, PFRDA).',
        highWeightage: true,
        subjectSlug: 'fm'
      },
      {
        id: 'fm_rbi_institutions',
        topic: 'Functions of RBI & Specialized Institutions',
        whatToCover: 'Functions of RBI; NABARD, SIDBI, EXIM Bank, NHB, NaBFID and other specialized developmental financial institutions.',
        highWeightage: true,
        subjectSlug: 'fm'
      },
      {
        id: 'fm_financial_markets',
        topic: 'Financial Markets',
        whatToCover: 'Money market (call/notice, T-Bills, CP, CD, Treps), capital market, forex market, bond and equity markets.',
        highWeightage: true,
        subjectSlug: 'fm'
      },
      {
        id: 'fm_risk_management',
        topic: 'Risk Management & Basel Norms',
        whatToCover: 'Banking risks (credit, market, operational) and mitigation strategies; Basel I, II, III norms; NPAs, Provisioning & PCA framework.',
        highWeightage: true,
        subjectSlug: 'fm'
      },
      {
        id: 'fm_derivatives',
        topic: 'Derivatives & Hedging',
        whatToCover: 'Basics of forwards, futures, options and swaps; hedging mechanisms and interest rate swaps.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_banking_trends',
        topic: 'Banking Sector Trends & Reforms',
        whatToCover: 'Reforms, digital transformation, payment systems (UPI, NEFT, RTGS, CBDC), FinTech innovations.',
        highWeightage: true,
        subjectSlug: 'fm'
      },
      {
        id: 'fm_financial_inclusion',
        topic: 'Financial Inclusion',
        whatToCover: 'Role of technology in inclusive banking, PMJDY, business correspondents, priority sector lending (PSL).',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_public_finance_fiscal',
        topic: 'Public Finance & Fiscal Policy',
        whatToCover: 'Union Budget, direct and indirect taxes, GST, FRBM Act, Finance Commission recommendations.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_inflation',
        topic: 'Inflation Dynamics',
        whatToCover: 'CPI, WPI, headline vs core trends, causes and monetary control measures.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_corp_governance_banking',
        topic: 'Corporate Governance in Banking',
        whatToCover: 'Governance practices in the banking sector, board composition, risk committees, ethics.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_ppp_investments',
        topic: 'PPP & Portfolio Investments',
        whatToCover: 'Public-private partnerships, infrastructure financing, portfolio investment theories.',
        subjectSlug: 'fm'
      },

      // Part 2: Management
      {
        id: 'fm_mgmt_basics_process',
        topic: 'Management Basics & Process',
        whatToCover: 'Nature, scope and functions of management: Planning, organising, staffing, directing, controlling.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_leadership',
        topic: 'Leadership Styles & Theories',
        whatToCover: 'Styles, theories and the role of leadership: Trait, behavioral, situational, transformational, Fiedler, Blake-Mouton.',
        highWeightage: true,
        subjectSlug: 'fm'
      },
      {
        id: 'fm_hrd',
        topic: 'Human Resource Development (HRD)',
        whatToCover: 'HRD concepts, training, performance appraisal, 360-degree feedback, career progression.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_motivation',
        topic: 'Motivation & Morale',
        whatToCover: 'Theories (Maslow, Herzberg, McGregor, Vroom, Alderfer, McClelland), incentives, employee satisfaction.',
        highWeightage: true,
        subjectSlug: 'fm'
      },
      {
        id: 'fm_communication',
        topic: 'Communication in Organisations',
        whatToCover: 'Types, process, barriers, interpersonal networks, role of IT in communication.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_org_behaviour',
        topic: 'Organisational Behaviour',
        whatToCover: 'Role of managers, personality, team dynamics, decision-making, conflict management.',
        subjectSlug: 'fm'
      },
      {
        id: 'fm_ethics_governance',
        topic: 'Corporate Governance & Ethics',
        whatToCover: 'Principles, mechanisms, regulatory codes, whistleblower protection and impact on organisations.',
        highWeightage: true,
        subjectSlug: 'fm'
      }
    ]
  }
];

export function Syllabus({ user }: { user: User }) {
  const navigate = useNavigate();
  const { syllabusProgress: completedTopics, updateSyllabusProgress } = useSubject();
  const [activeTab, setActiveTab] = useState<'all' | 'phase1' | 'phase2' | 'priorities'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleTopic = (id: string) => {
    const updated = { ...completedTopics, [id]: !completedTopics[id] };
    updateSyllabusProgress(updated);
  };

  const allTopicsCount = SYLLABUS_SECTIONS.reduce((sum, s) => sum + s.topics.length, 0);
  const completedCount = Object.values(completedTopics).filter(Boolean).length;
  const progressPct = allTopicsCount > 0 ? Math.round((completedCount / allTopicsCount) * 100) : 0;

  const filteredSections = SYLLABUS_SECTIONS.filter(section => {
    if (activeTab === 'phase1' && !section.badge.includes('Phase 1')) return false;
    if (activeTab === 'phase2' && !section.badge.includes('Phase 2')) return false;
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesSection = section.title.toLowerCase().includes(query) || section.code.toLowerCase().includes(query);
    const matchesTopics = section.topics.some(t => 
      t.topic.toLowerCase().includes(query) || t.whatToCover.toLowerCase().includes(query)
    );
    return matchesSection || matchesTopics;
  });

  return (
    <MotionPage className="max-w-6xl mx-auto space-y-8 pt-2 pb-16 relative z-10">
      
      {/* Top Hero Banner & Download Section */}
      <div className="ink-card-featured rounded-3xl p-5 sm:p-10 bg-[#FAF8EC] dark:bg-[#1C1C1A]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#ECD5FF] text-[#141413] text-xs font-mono font-bold tracking-wider uppercase border border-[#141413]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#141413]" />
              <span>Official RBI Recruitment Standard</span>
            </div>
            
            <h1 className="font-heading font-extrabold text-2xl sm:text-4xl text-[#141413] dark:text-[#FAF8EC] tracking-tight leading-tight">
              RBI Grade B Officer{' '}
              <span className="font-editorial-italic font-normal text-[#0D47FF] dark:text-[#ECD5FF]">
                Syllabus & Checklist
              </span>
            </h1>
            
            <p className="text-sm text-[#40403B] dark:text-[#A3A399] leading-relaxed">
              Comprehensive topic-wise tracker for the General (DR) stream across Phase 1 Prelims (200 Marks) and Phase 2 Mains (300 Marks). Calibrated strictly to the Reserve Bank of India notification standards.
            </p>

            {/* Overall Syllabus Progress Bar */}
            <div className="pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#66665E] dark:text-[#A3A399] mb-1.5 tabular-nums">
                <span className="font-bold text-[#141413] dark:text-[#FAF8EC]">
                  Curriculum Mastery: <AnimatedNumber value={completedCount} duration={0.4} /> of {allTopicsCount} Topics Checked
                </span>
                <span className="font-bold text-[#0D47FF] dark:text-[#ECD5FF]">
                  <AnimatedNumber value={progressPct} suffix="% Complete" duration={0.5} />
                </span>
              </div>
              <div className="w-full bg-[#E5E1CE] dark:bg-[#2E2E2A] h-2.5 rounded-full overflow-hidden border border-[#141413]/20 dark:border-[#2E2E2A]">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(1, progressPct / 100) }}
                  transition={{ duration: 0.65, ease: EASE_OUT_EXPO }}
                  className="bg-[#0D47FF] dark:bg-[#ECD5FF] h-full w-full rounded-full origin-left"
                />
              </div>
            </div>
          </div>

          {/* Download Action Capsule */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <motion.a
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SNAPPY}
              href="/assets/aistudio/RBI_Grade_B_Syllabus_Phase1_Phase2_7420ffa7.pdf"
              download="RBI_Grade_B_Official_Syllabus_Phase1_Phase2.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[46px] flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0D47FF] hover:bg-[#0936CC] text-white font-bold text-sm border-[1.5px] border-[#141413] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>Download Official Syllabus PDF</span>
            </motion.a>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SNAPPY}
              onClick={() => navigate('/new')}
              className="min-h-[44px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#141413] dark:border-[#ECD5FF]/60 hover:bg-[#FFD426] hover:text-[#141413] text-[#141413] dark:text-[#FAF8EC] font-bold text-xs transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
              <span>Launch Mock Exam Now</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Exam At A Glance Infographic Table */}
      <MotionSection className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
            <span>1. Exam at a Glance</span>
          </h2>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-[#FFD426] text-[#141413] border border-[#141413] tabular-nums">
            Total Merit: 375 Marks
          </span>
        </div>

        <div className="sm:hidden text-[11px] font-mono text-[#66665E] dark:text-[#A3A399]">
          Swipe table horizontally →
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A]">
          <table className="w-full min-w-[540px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF8EC] dark:bg-[#141413] border-b border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399] font-mono uppercase tracking-wider">
                <th className="py-3 px-3.5">Stage</th>
                <th className="py-3 px-3.5">Papers / Sections</th>
                <th className="py-3 px-3.5">Marks</th>
                <th className="py-3 px-3.5">Time</th>
                <th className="py-3 px-3.5">Nature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1CE] dark:divide-[#2E2E2A] text-[#40403B] dark:text-[#D5D5C8]">
              <tr className="hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50">
                <td className="py-3 px-3.5 font-bold text-[#0D47FF] dark:text-[#ECD5FF] whitespace-nowrap">Phase 1 (Prelims)</td>
                <td className="py-3 px-3.5">General Awareness (80 Q), Quantitative Aptitude (30 Q), English Language (30 Q), Reasoning Ability (60 Q)</td>
                <td className="py-3 px-3.5 font-mono font-bold tabular-nums text-[#141413] dark:text-[#FAF8EC]">200</td>
                <td className="py-3 px-3.5 whitespace-nowrap tabular-nums">120 min (total)</td>
                <td className="py-3 px-3.5 text-[#66665E] dark:text-[#A3A399]">Objective MCQ, -0.25 penalty. Qualifying only - not in final merit.</td>
              </tr>
              <tr className="hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50">
                <td className="py-3 px-3.5 font-bold text-[#141413] dark:text-[#FFD426] whitespace-nowrap" rowSpan={3}>Phase 2 (Mains)</td>
                <td className="py-3 px-3.5">Paper I: Economic & Social Issues (ESI)</td>
                <td className="py-3 px-3.5 font-mono font-bold tabular-nums text-[#141413] dark:text-[#FAF8EC]">100</td>
                <td className="py-3 px-3.5 whitespace-nowrap tabular-nums">120 min</td>
                <td className="py-3 px-3.5">Objective (50M) + Descriptive typed on screen (50M)</td>
              </tr>
              <tr className="hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50">
                <td className="py-3 px-3.5">Paper II: English (Writing Skills)</td>
                <td className="py-3 px-3.5 font-mono font-bold tabular-nums text-[#141413] dark:text-[#FAF8EC]">100</td>
                <td className="py-3 px-3.5 whitespace-nowrap tabular-nums">90 min</td>
                <td className="py-3 px-3.5">Descriptive, typed on screen (Essay, Precis, Comprehension)</td>
              </tr>
              <tr className="hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50">
                <td className="py-3 px-3.5">Paper III: Finance & Management (FM)</td>
                <td className="py-3 px-3.5 font-mono font-bold tabular-nums text-[#141413] dark:text-[#FAF8EC]">100</td>
                <td className="py-3 px-3.5 whitespace-nowrap tabular-nums">120 min</td>
                <td className="py-3 px-3.5">Objective (50M) + Descriptive typed on screen (50M)</td>
              </tr>
              <tr className="hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50">
                <td className="py-3 px-3.5 font-bold text-[#141413] dark:text-[#FFD426] whitespace-nowrap">Interview</td>
                <td className="py-3 px-3.5">Personality Test & Central Banking Viva</td>
                <td className="py-3 px-3.5 font-mono font-bold tabular-nums text-[#141413] dark:text-[#FAF8EC]">75</td>
                <td className="py-3 px-3.5">-</td>
                <td className="py-3 px-3.5 font-bold text-[#141413] dark:text-[#FAF8EC]">Final Merit = Phase 2 (300) + Interview (75) = 375</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <p className="text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] pt-1">
          * Negative marking (-0.25) applies to the objective portions of Phase 1 and Phase 2; descriptive portions carry no negative marking.
        </p>
      </MotionSection>

      {/* Search & Phase Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Phase Filter Tabs */}
        <div className="flex overflow-x-auto no-scrollbar items-center gap-1 p-1.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] w-full sm:w-auto">
          {[
            { id: 'all', label: 'Complete Checklist' },
            { id: 'phase1', label: 'Phase 1 (Prelims)' },
            { id: 'phase2', label: 'Phase 2 (Mains)' },
            { id: 'priorities', label: 'Part C: High-Weightage' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer z-10 min-h-[38px] ${
                  isActive
                    ? 'text-[#141413]'
                    : 'text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="syllabus-filter-pill"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-xl bg-[#ECD5FF] border-[1.5px] border-[#141413] shadow-[2px_2px_0px_#141413] -z-10"
                  />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#66665E] dark:text-[#A3A399]" />
          <input
            type="text"
            placeholder="Search syllabus topic or concept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[42px] pl-9 pr-4 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#141413] dark:text-[#FAF8EC] placeholder:text-[#66665E] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
      {/* Part C: High-Weightage Priorities view if selected */}
      {activeTab === 'priorities' ? (
        <motion.div
          key="syllabus-priorities"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
          className="space-y-6"
        >
          
          {/* Phase 1 High-Weightage */}
          <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="font-heading font-extrabold text-base text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0D47FF] dark:text-[#FFD426]" />
              <span>Phase 1 High-Weightage Areas (Typical Expected Questions)</span>
            </h3>

            <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  section: 'General Awareness (~50-80 Qs)',
                  dot: 'bg-[#0D47FF]',
                  items: [
                    'Current Affairs: Economic and National (25-35 Qs)',
                    'Banking & Financial Awareness: Monetary Policy, Circulars (15-25 Qs)',
                    'Government Schemes: Objectives & Outlays (7-10 Qs)',
                    'Reports & Indices: Global rankings & forecasts (5-8 Qs)'
                  ]
                },
                {
                  section: 'Reasoning Ability (~60 Qs)',
                  dot: 'bg-[#ECD5FF]',
                  items: [
                    'Seating Arrangement & Puzzles: Multi-variable floors/circles (20-40 Qs)',
                    'Logical Reasoning: Assumptions & Inferences (8-10 Qs)',
                    'Machine Input-Output: Transformation patterns (~5 Qs)',
                    'Syllogism: New-pattern rules (3-5 Qs)',
                    'Coding, Direction & Blood Relations (5-10 Qs)'
                  ]
                },
                {
                  section: 'Quantitative Aptitude (~30 Qs)',
                  dot: 'bg-[#FFD426]',
                  items: [
                    'Data Interpretation & Caselets: Multi-table/graph (10-15 Qs)',
                    'Commercial Arithmetic: SI/CI, Profit-Loss, Time-Work (8-12 Qs)',
                    'Number Series: Missing and wrong series (4-6 Qs)',
                    'Quadratic Equations & Quantity Comparison (2-5 Qs)'
                  ]
                },
                {
                  section: 'English Language (~30 Qs)',
                  dot: 'bg-[#141413] dark:bg-[#FAF8EC]',
                  items: [
                    'Reading Comprehension: Editorial inferences (8-15 Qs)',
                    'Para Jumbles: Sentence rearrangement (4-5 Qs)',
                    'Fillers & Cloze Mechanics (4-5 Qs)',
                    'Error Detection & Syntax (4-6 Qs)',
                    'Vocabulary & Phrase Replacement (4-6 Qs)'
                  ]
                }
              ].map(card => (
                <MotionStaggerItem key={card.section}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={SPRING_SNAPPY}
                    className="h-full p-4 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] space-y-2 transition-colors"
                  >
                    <h4 className="font-heading font-bold text-sm text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full border border-[#141413] shrink-0 ${card.dot}`} />
                      <span>{card.section}</span>
                    </h4>
                    <ul className="space-y-1 text-xs text-[#40403B] dark:text-[#A3A399]">
                      {card.items.map(item => (
                        <li key={item} className="flex items-start gap-1.5">
                          <span className="text-[#0D47FF] dark:text-[#FFD426] font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </MotionStaggerItem>
              ))}
            </MotionStaggerGrid>
          </div>

          {/* Phase 2 Priority Topics */}
          <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="font-heading font-extrabold text-base text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
              <span>Phase 2 Priority Topics</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#141413] dark:text-[#FFD426] uppercase">
                  <span className="w-2 h-2 rounded-full bg-[#FFD426] border border-[#141413]" />
                  <span>ESI Paper I</span>
                </span>
                <p className="text-xs text-[#40403B] dark:text-[#A3A399] leading-relaxed">
                  Inflation, monetary and fiscal policy; poverty, unemployment, sustainable development; economic reforms; globalisation (WTO, IMF, World Bank); Union Budget and Economic Survey; social issues (education, health, gender); financial inclusion.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#0D47FF] dark:text-[#ECD5FF] uppercase">
                  <span className="w-2 h-2 rounded-full bg-[#0D47FF] border border-[#141413]" />
                  <span>FM: Part 1 Finance</span>
                </span>
                <p className="text-xs text-[#40403B] dark:text-[#A3A399] leading-relaxed">
                  Indian financial system and RBI functions; money, capital, forex and bond markets; Basel norms, risk management, NPAs; repo, reverse repo, CRR, SLR; financial inclusion and digital payments; derivatives; inflation and fiscal policy.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#141413] dark:text-[#ECD5FF] uppercase">
                  <span className="w-2 h-2 rounded-full bg-[#ECD5FF] border border-[#141413]" />
                  <span>FM: Part 2 Management</span>
                </span>
                <p className="text-xs text-[#40403B] dark:text-[#A3A399] leading-relaxed">
                  Leadership theories and styles; motivation theories; communication process and barriers; HRD and performance appraisal; organisational behaviour; corporate governance and ethics; functions of management; decision-making and conflict management.
                </p>
              </div>
            </div>
          </div>

          {/* Suggested Revision Order */}
          <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="font-heading font-extrabold text-base text-[#141413] dark:text-[#FAF8EC]">
              Suggested 4-Step Revision Strategy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#0D47FF]/40 space-y-1">
                <span className="font-mono font-bold text-[#0D47FF] dark:text-[#ECD5FF] block">Step 1 • Speed Engine</span>
                <p className="text-[#40403B] dark:text-[#A3A399] text-[11px]">
                  Daily current affairs and banking awareness; practice puzzles and DI for speed. Aim to clear the cut-off comfortably.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#ECD5FF] dark:border-[#ECD5FF]/40 space-y-1">
                <span className="font-mono font-bold text-[#141413] dark:text-[#ECD5FF] block">Step 2 • Phase 2 Depth</span>
                <p className="text-[#40403B] dark:text-[#A3A399] text-[11px]">
                  Build concepts in ESI and FM from standard sources, then practise typed descriptive answers with structured examples.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#141413]/30 dark:border-[#2E2E2A] space-y-1">
                <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] block">Step 3 • Writing Acumen</span>
                <p className="text-[#40403B] dark:text-[#A3A399] text-[11px]">
                  Weekly essay and précis practice, typed on screen to match actual exam conditions and character budgets.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FFD426]/20 dark:bg-[#141413] border-[1.5px] border-[#FFD426] space-y-1">
                <span className="font-mono font-bold text-[#141413] dark:text-[#FFD426] block">Step 4 • Final Polish</span>
                <p className="text-[#40403B] dark:text-[#A3A399] text-[11px]">
                  Previous-year papers (PYQs), full-pattern mocks, and interview preparation using Economic Survey & RBI Annual Report.
                </p>
              </div>
            </div>
          </div>

        </motion.div>
      ) : (
        <motion.div
          key={`syllabus-sections-${activeTab}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
          className="space-y-6"
        >
          {filteredSections.map(section => {
            const sectionCompleted = section.topics.filter(t => completedTopics[t.id]).length;
            const sectionTotal = section.topics.length;
            const sectionPct = Math.round((sectionCompleted / sectionTotal) * 100);

            return (
              <MotionSection
                key={section.code}
                className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-3xl p-5 sm:p-8 space-y-6"
              >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E1CE] dark:border-[#2E2E2A] pb-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#ECD5FF] text-[#141413] border border-[#141413] text-xs font-mono font-bold shrink-0">
                        {section.code}
                      </span>
                      <h3 className="font-heading font-extrabold text-lg sm:text-xl text-[#141413] dark:text-[#FAF8EC]">
                        {section.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#66665E] dark:text-[#A3A399] font-mono">
                      <span>{section.questionsOrMarks}</span>
                      <span>•</span>
                      <span>{section.duration}</span>
                      <span>•</span>
                      <span>{section.nature}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="text-xs font-mono font-bold text-[#0D47FF] dark:text-[#ECD5FF] block tabular-nums">
                        {sectionCompleted} / {sectionTotal} Done ({sectionPct}%)
                      </span>
                      <div className="w-24 bg-[#E5E1CE] dark:bg-[#2E2E2A] h-1.5 rounded-full overflow-hidden mt-1">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: Math.min(1, sectionPct / 100) }}
                          transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
                          className="bg-[#0D47FF] dark:bg-[#ECD5FF] h-full w-full rounded-full origin-left"
                        />
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => navigate(`/new?subject=${section.subjectSlug}`)}
                      className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#0D47FF] hover:bg-[#0936CC] text-white border border-[#141413] shadow-[2px_2px_0px_#141413] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>Drill Section</span>
                      <ArrowRight className="w-3 h-3" />
                    </motion.button>
                  </div>
                </div>

                {/* Key Reports pill if ESI */}
                {section.keyReports && (
                  <div className="p-3.5 rounded-2xl bg-[#FFD426]/15 dark:bg-[#141413] border border-[#FFD426] space-y-1.5">
                    <span className="text-xs font-mono font-bold text-[#141413] dark:text-[#FFD426] uppercase">
                      Mandatory Annual Reports & Policy Documents:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {section.keyReports.map(rep => (
                        <span key={rep} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#141413]/25 dark:border-[#FFD426]/40 text-[#141413] dark:text-[#FAF8EC]">
                          {rep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Topics List with Interactive Tick-box Tracker */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {section.topics.map(t => {
                    const isChecked = !!completedTopics[t.id];
                    return (
                      <motion.div
                        key={t.id}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        transition={SPRING_SNAPPY}
                        onClick={() => toggleTopic(t.id)}
                        className={`p-4 rounded-2xl border-[1.5px] transition-colors cursor-pointer flex items-start gap-3 select-none ${
                          isChecked
                            ? 'bg-[#ECD5FF]/25 dark:bg-[#ECD5FF]/10 border-[#141413] dark:border-[#ECD5FF]/60'
                            : 'bg-[#FAF8EC] dark:bg-[#141413] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/50'
                        }`}
                      >
                        <motion.div
                          key={isChecked ? 'checked' : 'unchecked'}
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={SPRING_TACTILE}
                          className="pt-0.5 shrink-0"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#66665E] dark:text-[#A3A399]" />
                          )}
                        </motion.div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className={`text-xs font-bold leading-snug ${
                              isChecked ? 'line-through text-[#66665E] dark:text-[#A3A399]' : 'text-[#141413] dark:text-[#FAF8EC]'
                            }`}>
                              {t.topic}
                            </span>
                            {t.highWeightage && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FFD426] text-[#141413] border border-[#141413] shrink-0">
                                High Weightage
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-[#40403B] dark:text-[#A3A399] leading-relaxed">
                            {t.whatToCover}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/new?subject=${t.subjectSlug}&topic=${encodeURIComponent(t.topic)}`);
                          }}
                          className="shrink-0 p-2 rounded-lg text-[#66665E] dark:text-[#A3A399] hover:text-[#0D47FF] dark:hover:text-[#ECD5FF] hover:bg-[#ECD5FF]/40 dark:hover:bg-[#ECD5FF]/10 transition-colors cursor-pointer"
                          title="Generate Practice Questions on this topic"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </MotionSection>
            );
          })}
        </motion.div>
      )}
      </AnimatePresence>

    </MotionPage>
  );
}
