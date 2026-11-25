import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Eliminate server software and technology disclosure
app.disable('x-powered-by');

// Comprehensive Security Headers: suppress technology identifiers, enforce nosniff, HSTS, Referrer-Policy, and hardened CSP
app.use((_req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseapp.com https://*.googleapis.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.firebasestorage.app https://*.run.app",
      "connect-src 'self' https: data: blob: ws: wss:",
      "frame-src 'self' https://*.firebaseapp.com https://*.google.com",
      "frame-ancestors 'self' https://*.google.com https://*.run.app https://ais-*.run.app https://*.onrender.com https://rbi-grade-b-exam-engine.vercel.app",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
  next();
});

// Authorized origins including the Render and Vercel production domains
const ALLOWED_ORIGINS = [
  'https://rbi-grade-b-exam-engine-1.onrender.com',
  'https://rbi-grade-b-exam-engine.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://ais-dev-jzllizn5s3fhhw7kfwihpr-560411628824.asia-southeast1.run.app',
  'https://ais-pre-jzllizn5s3fhhw7kfwihpr-560411628824.asia-southeast1.run.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or same-origin requests (origin undefined)
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.run.app')
    ) {
      return callback(null, true);
    }
    // Allow any origin in dev or permissive fallback for API usage
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Ensure OPTIONS preflight requests are handled cleanly
app.options('*', cors());

app.use(express.json({ limit: '200mb' }));

// Lazy init Gemini to avoid crashing if key is missing on startup
let ai: GoogleGenAI | null = null;
function getGenAI() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return ai;
}

// Resilient Gemini caller with model fallback chain and backoff retry
async function callGeminiWithRetry(contents: string, systemInstruction?: string): Promise<string> {
  const genai = getGenAI();
  const models = ['gemini-4-hydrogen', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await genai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            systemInstruction: systemInstruction || undefined,
          }
        });
        if (response.text && response.text.trim()) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt ${attempt + 1} with model ${model} failed:`, err?.message || err);
        await new Promise(r => setTimeout(r, 750 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error("Failed to generate content with Gemini after retries across candidate models");
}

function safeJsonParse(text: string): any {
  if (!text) return {};
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function getDifficultyDirective(difficulty: string, subjectSlug: string): string {
  const normalized = (difficulty || 'Hard').toLowerCase();

  if (normalized === 'easy') {
    return `
DIFFICULTY CALIBRATION — FOUNDATIONAL RBI GRADE B:
- Focus on clear conceptual verification and core statutory rules without ambiguous trick phrasing.
- Still maintain strict 5-option RBI formatting and accurate explanations.`;
  }

  if (normalized === 'moderate') {
    return `
DIFFICULTY CALIBRATION — OFFICIAL RBI GRADE B STANDARD:
- Match standard RBI Grade B Phase I & Phase II exam complexity: multi-concept MCQs, 2-step numericals, standard 2-variable puzzles, and realistic near-miss distractors.
- Avoid trivial direct-definition questions.`;
  }

  let subjectExtremeSpecs = '';
  if (subjectSlug === 'reasoning') {
    subjectExtremeSpecs = `
- EXTREME REASONING MANDATE (IBPS PO MAINS / RBI GRADE B TOUGHEST SHIFT CALIBRE):
  * Puzzles & Seating: Build dense 3-variable or 4-variable arrangements (e.g., 8-10 people across floors/flats WITH a vacant flat/floor OR uncertain-number linear/circular seating facing both inward & outward WITH blood relation links & designation/bank constraints & negative conditions). Single-variable 4-line puzzles are STRICTLY FORBIDDEN.
  * Machine Input-Output: Multi-step dual-condition alphanumeric shifting/rearrangement where word vowel/consonant rules + prime/composite number transforms apply simultaneously across 4-5 steps.
  * Syllogisms & Critical Reasoning: Use Reverse Syllogisms (find which set of 4-5 statements guarantees 3 complex conclusions) OR multi-clause "Only a few" + "Can never be" + "Possibility" traps. In Critical Reasoning, avoid obvious moral/common-sense choices—test subtle implicit assumptions, necessary conditions, paradox resolution, and causal weakening.
  * Coded Inequalities & Blood Relations: Multi-symbol chains with coded brackets and 3-generation lineage traps.`;
  } else if (subjectSlug === 'quant') {
    subjectExtremeSpecs = `
- EXTREME QUANTITATIVE MANDATE (CAT 99%ILE / RBI PHASE 1 TOUGHEST SHIFT CALIBRE):
  * Data Interpretation & Caselets: Build multi-layered DI sets (Pie/Double-Pie, Vertical/Horizontal Bar Graphs, Line Graphs, Paragraph Caselets, and Mixed Table+Chart combinations) with interconnected percentage/degree splits, weighted averages, CAGR, or ratio chains. Every single chart value MUST be 100% mathematically consistent across all 5 linked questions.
  * Arithmetic & Algebra: Combine multiple concepts per problem (e.g., dishonest dealer + successive markup/discount + partnership with time-varying capital + CI with variable rate per year, or Boat/Stream + Time-Speed-Distance relative motion).
  * Quadratics / Series / Comparisons: Include equations with fractional/surd/cubic terms, wrong-number series combining alternating prime/cube/factorial differences, 3-statement Data Sufficiency (checking Statement I, II, III sufficiency combinations rigorously), and Quantity I vs Quantity II vs Quantity III requiring exact multi-step algebra.`;
  } else if (subjectSlug === 'english') {
    subjectExtremeSpecs = `
- EXTREME ENGLISH MANDATE (GMAT 750+ / RBI GRADE B HARDEST SHIFT CALIBRE):
  * Reading Comprehension: Dense central-banking/monetary-economics editorial excerpts (The Economist / BIS / RBI Bulletin style) testing nuanced authorial tone shifts, implicit paradoxes, primary logical flaw, strengthen/weaken inference, and subtle contextual phrasing.
  * Grammar & Syntax: Multi-clause sentences testing subjunctive mood, inverted conditionals, dangling/misplaced modifiers, parallelism across nested clauses, and genuine "No Error" traps—no simple subject-verb typos.
  * Para-Jumbles & Fillers: 6-sentence coherent academic/financial paragraph reconstruction and triple-blank / double-sentence contextual fillers using high-register C2/economic vocabulary where multiple options share similar surface meanings.`;
  } else if (subjectSlug === 'general-awareness') {
    subjectExtremeSpecs = `
- EXTREME GENERAL AWARENESS MANDATE (UPSC PRELIMS + RBI GRADE B PHASE 1 TOUGHEST SHIFT CALIBRE):
  * BANNED: Never ask trivial one-liner recall like "Where is the headquarters of..." or "What is the full form of...".
  * QUESTION FORMAT DIVERSITY (CRITICAL — DO NOT OVERUSE ONE PATTERN):
    Vary formats deliberately across every batch:
    (a) ~40% Direct Analytical / Statutory / Threshold Scenario MCQs (concrete numerical figures, statutory clauses, committee names, or swapped jurisdiction thresholds as the 5 options),
    (b) ~20% Code-Combination Statement MCQs ("Only I and III", "Only II and IV", "Only I, II and IV", "All I, II, III and IV", "None of the above"),
    (c) ~15% Caselet Vignette / Double-Blank [X] & [Y] MCQs (short 3–4 line policy/RBI circular vignette asking candidates to identify exact paired facts/sections),
    (d) ~15% Match-the-Following (List I vs List II with paired codes like "1-C, 2-A, 3-D, 4-B") or Negative/Exception MCQs ("Which of the following is NOT true...?"),
    (e) MAXIMUM 10–15% Pair-Counting MCQs ("Only one / Only two / Only three / All four / None") — STRICT CAP of at most 2 questions per 15–20 Q batch, and NEVER two in a row.
  * Dynamic 2024–2026 Current Affairs: Test second-order details of RBI Master Directions, MPC corridor triggers, PCA Risk Threshold 1/2/3 ratios, Union Budget/Economic Survey fiscal glidepath/capex figures, and global central-bank/BIS frameworks.`;
  } else if (subjectSlug === 'esi') {
    subjectExtremeSpecs = `
- EXTREME ESI MANDATE (RBI GRADE B PHASE 2 + INDIAN ECONOMIC SERVICE CALIBRE):
  * MCQs: Test multi-statement theoretical & empirical synthesis—e.g. combining Solow-Swan steady-state dynamics, Gini/Lorenz/MPI methodology traps, National Income accounting identity edge cases, BoP Capital vs Current Account sub-components, and intricate scheme exclusions/funding splits (Centre:State ratio, beneficiary caps, sunset clauses) in Union Budget & Economic Survey 2024–2026.
  * Authentic Format Variety: Mix Direct Quantitative/Analytical MCQs (~40%), Code-Combination "Only I and II" / "Only II and III" MCQs (~25%), Economic Vignette / Caselet [X]–[Y] MCQs (~20%), Match-the-Following / Exception MCQs (~10%), and AT MOST 1 Pair-Counting ("Only one / Only two...") MCQ per batch.
  * Descriptive: Craft policy trade-off dilemmas (e.g., fiscal consolidation vs public capex multiplier under sticky food inflation and sovereign debt dynamics) demanding quantitative anchors and counter-arguments.`;
  } else if (subjectSlug === 'fm') {
    subjectExtremeSpecs = `
- EXTREME FINANCE & MANAGEMENT MANDATE (CFA LEVEL II + RBI GRADE B PHASE 2 CALIBRE):
  * Chained Financial Numericals: Require 2–4 chained formulas per numerical MCQ (e.g. DuPont 5-factor ROE decomposition, WACC with tax-shield & market-value debt weights, Bond price sensitivity using Modified Duration + Convexity, YTM approximation, Levered vs Unlevered Beta using Hamada equation, DSCR with tax-adjusted preference dividends, Basel III CET-1 + CCB + Countercyclical + D-SIB capital surcharge exact rupee calculations).
  * Governance & Organizational Behavior: Mix numericals (~35%), realistic Boardroom Caselets (~25%), Code-Combination Statements ("Only I and III", ~20%), Match-the-Theorist/Committee (~10%), and keep Pair-Counting ("Only one / Only two...") below 10%.
  * Descriptive: Construct boardroom regulatory/risk-governance crises requiring Basel/RBI supervisory mechanics and structural change-management execution.`;
  } else if (subjectSlug === 'english-writing') {
    subjectExtremeSpecs = `
- EXTREME WRITING MANDATE:
  * Essay topics must pose sharp macroeconomic/central-banking paradoxes (e.g., AI-driven productivity vs monetary policy transmission lags, or CBDC programmability vs privacy & commercial bank disintermediation).
  * Précis source passages must be dense, multi-layered institutional speeches requiring exact abstraction without losing nuance.`;
  }

  return `
DIFFICULTY CALIBRATION — MAXIMUM / EXTREME HARD MODE (ABSOLUTE PEAK RIGOR):
YOU MUST PUSH QUESTION DIFFICULTY TO THE FULLEST POSSIBLE EXTENT. "Hard" here means EXTREMELY HARD — top 0.1% difficulty matching the hardest shift ever set by IBPS/RBI/UPSC/CAT.
STRICT ANTI-SOFTBALL & OPTION DIVERSITY RULES:
1. ZERO trivial, single-fact, or one-step questions. Every question must require AT LEAST 2–3 distinct reasoning steps, nested exclusions, multi-statement cross-verification, or chained formulas.
2. ADVERSARIAL DISTRACTOR DESIGN: Every single incorrect option among the 5 options must represent a plausible, realistic mistake (a forgotten tax adjustment, a wrong RBI Act section, a swapped committee threshold, an off-by-one constraint in a puzzle, or a subtle sign reversal).
3. ANTI-MONOTONY OPTION DIVERSITY (MANDATORY):
   - NEVER repeat the same option template across consecutive questions.
   - STRICTLY CAP "Only one statement / Only two statements / Only three statements / All four / None" pair-counting questions to AT MOST 10–15% of the batch (maximum 1–2 questions total per batch, NEVER back-to-back).
   - Mix freely across: (A) Direct Concrete Answers (values, formulas, statutory clauses, regulatory conclusions), (B) Code Combinations ("Only I and III", "Only II and IV"), (C) Match-the-Following ("1-C, 2-A, 3-D, 4-B"), (D) Scenario/Passage Vignettes with [X] and [Y] blanks, and (E) Negative/Exception prompts ("Which statement is INCORRECT?").
4. NEGATIVE & EXCEPTION TRAPS: Regularly test subtle regulatory exceptions, boundary conditions ("except", "incorrect", "necessary vs sufficient"), and multi-layer numerical traps.${subjectExtremeSpecs}`;
}

function buildSubjectPrompt(subjectSlug: string, subjectName: string, config: any, extractedText: string): string {
  const pyqCount = typeof config.pyqCount === 'number' ? config.pyqCount : 0;
  const totalMcqs = (config.mcqStatic || 0) + (config.mcqDynamic || 0) + pyqCount;
  const totalDescs = (config.descStatic || 0) + (config.descDynamic || 0);
  const mcq1Count = config.mcqStatic || 0;
  const mcq2Count = config.mcqDynamic || 0;
  const desc1Count = config.descStatic || 0;
  const desc2Count = config.descDynamic || 0;
  const primaryMcqLabel = config.primaryMcqLabel || 'Category 1 Core MCQs';
  const secondaryMcqLabel = config.secondaryMcqLabel || 'Category 2 Applied MCQs';
  const primaryDescLabel = config.primaryDescLabel || 'Category 1 Descriptive';
  const secondaryDescLabel = config.secondaryDescLabel || 'Category 2 Descriptive';
  const topicFocus = config.targetTopic ? `SPECIFIC TOPIC FOCUS: "${config.targetTopic}"` : '';
  const batchDirective = config.batchFocus
    ? `\nBATCH MANDATE (STRICT COVERAGE): This batch MUST specifically focus on: ${config.batchFocus}. Do NOT drift into duplicate basic questions covered by other batches.`
    : '';
  const weightedMarksDirective = (typeof config.mcqTwoMarkCount === 'number' && config.mcqTwoMarkCount > 0)
    ? `\nOFFICIAL RBI GRADE B PHASE 2 WEIGHTED MCQ MARKING:
  - Output EXACTLY ${config.mcqOneMarkCount || 0} concise MCQs with "maxMarks": 1.
  - Output EXACTLY ${config.mcqTwoMarkCount} deeper analytical / multi-statement / numerical / case-based MCQs with "maxMarks": 2.`
    : '';
  const examMode = config.mode || 'Sectional';
  const difficulty = config.difficulty || 'Hard';
  const difficultyDirective = getDifficultyDirective(difficulty, subjectSlug);

  let subjectSpecificRules = '';
  let jsonSchemaExample = '';

  if (subjectSlug === 'reasoning') {
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (REASONING APTITUDE - RBI GRADE B PHASE 1):
CRITICAL RULE: ABSOLUTELY ZERO GENERAL KNOWLEDGE, CURRENT AFFAIRS, BANKING LAWS, OR CIRCULARS.
This is a pure examination of high-difficulty logical deduction, puzzles, and analytical reasoning as conducted by IBPS for RBI Grade B Officers (60 Marks / 45 Minutes benchmark).

QUESTION DISTRIBUTION:
- CATEGORY 1: "${primaryMcqLabel}" -> Generate EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static".
  Topics: Reverse Syllogisms & Syllogisms ("Only a few", "Can never be"), Machine Input-Output with multi-step alphanumeric shifting/reversal, Coded Inequalities (@, #, $, %, &), Coded Blood Relations with 3-generation lineage, Direction & Distance with angular degree shifts.
- CATEGORY 2: "${secondaryMcqLabel}" -> Generate EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic".
  Topics: Multi-variable Floor/Flat Puzzles (8–10 persons, 4–5 floors, 2 flats, vacant flat/floor traps, banks/cities/colors), Linear/Circular/Square seating arrangements (uncertain number, inward/outward facing), Critical & Evaluative Reasoning (Statement-Assumption, Inference, Course of Action, Weakening/Strengthening).
${pyqCount > 0 ? `- AUTHENTIC PYQ SECTION: Generate EXACTLY ${pyqCount} authentic Previous Year Questions (PYQs) asked in official RBI Grade B Phase 1 Reasoning papers (2018–2025) matching the selected topic or hardest puzzle patterns. Mark each with "isPyq": true and "pyqYear": "RBI Grade B 2024" (or 2023, 2022, 2021, etc.).` : ''}

STRICT FORMAT REQUIREMENTS:
- Every MCQ MUST have EXACTLY 5 distinct options.
- The explanation must detail the logical step-by-step reasoning or deduction path.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Syllogisms & Reverse Syllogisms'}",
      "text": "Statements:\\nOnly a few Banks are NBFCs.\\nAll NBFCs are Fintechs.\\nNo Fintech is a ChitFund.\\n\\nConclusions:\\nI. Some Banks can never be ChitFunds.\\nII. All NBFCs being ChitFunds is a possibility.\\nIII. At least some Banks are Fintechs.\\n\\nWhich of the conclusion(s) logically follow(s)?",
      "options": [
        "Only I follows",
        "Only I and III follow",
        "Only II follows",
        "Only II and III follow",
        "None of the conclusions follow"
      ],
      "correctAnswer": "Only I and III follow",
      "explanation": "Conclusion I is valid: The specific portion of Banks that are NBFCs are wholly contained within Fintechs, which are disjoint from ChitFunds; thus, those Banks can never be ChitFunds. Conclusion II is false since no NBFC can ever be a ChitFund. Conclusion III is valid as the overlap between Banks and NBFCs is subset within Fintechs.",
      "maxMarks": 1
    },
    {
      "type": "MCQ",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Puzzles, Seating & Critical Reasoning'}",
      "text": "Eight persons - P, Q, R, S, T, U, V, and W - live on four different floors of a building (Floors 1 to 4 from bottom to top). Each floor has two flats: Flat-1 (west) and Flat-2 (east). Each person works in a different financial institution.\\n- P lives on an even-numbered floor in Flat-1.\\n- Only one floor is between P and the person working in SBI, who lives in Flat-2.\\n- T lives immediately above the person from SBI in the same flat type.\\n- R lives to the immediate east of T on the same floor.\\nWho among the following lives in Flat-2 on Floor 4?",
      "options": [
        "R",
        "T",
        "P",
        "W",
        "Cannot be determined from the given conditions"
      ],
      "correctAnswer": "R",
      "explanation": "Following the flat-floor spatial layout: P is placed on Floor 2, Flat 1. One floor gap places the SBI employee on Floor 4 or Floor 1 in Flat-2. Given T is immediately above SBI in the same flat type, the SBI employee must be on Floor 1, Flat 2. Thus T is on Floor 2, Flat 2, or following the inverted constraints, R occupies Flat-2 on Floor 4.",
      "maxMarks": 1
    }
  ]
}`;
  } else if (subjectSlug === 'quant') {
    const isDiTopicDrill = /data interpretation|caselet|\bdi\b|pie|bar|line|table|graph/i.test(config.targetTopic || '');
    let diSetCount = 0;
    if (mcq2Count >= 5) {
      diSetCount = Math.min(3, Math.floor(mcq2Count / 5));
    } else if (isDiTopicDrill && totalMcqs >= 5) {
      diSetCount = Math.min(3, Math.floor(totalMcqs / 5));
    }
    const diTotalMcqs = diSetCount * 5;
    const standaloneTotal = Math.max(0, totalMcqs - diTotalMcqs);
    const standaloneStatic = Math.min(mcq1Count, standaloneTotal);
    const standalonePyq = Math.min(pyqCount, Math.max(0, standaloneTotal - standaloneStatic));
    const standaloneDynamic = Math.max(0, standaloneTotal - standaloneStatic - standalonePyq);

    // Pick diverse DI formats so Pie, Vertical/Horizontal Bar, Line, Caselet, and Mixed all get represented properly
    const diFormatsPool = [
      'PIE CHART DI ("diType": "pie" or "double_pie"): Circular percentage (%) or degree (° summing to 360°) distribution across 5-6 sectors/companies/departments, optionally paired as two pie charts comparing two periods or Total vs Sub-category.',
      'BAR GRAPH DI ("diType": "bar_vertical" or "bar_horizontal"): Multi-series rectangular bars (use "chartType": "bar_vertical" or "bar_horizontal" cleanly) comparing 5 categories across 2-3 years, banks, or metrics.',
      'LINE GRAPH DI ("diType": "line"): Connected time-series points tracking trends, growth rates (%), or quarterly/annual fluctuations across 5-6 years/months for 2-3 entities.',
      'CASELET DI ("diType": "caselet"): Rich paragraph-based passage (set "charts": [] so NO visual graph is rendered; place the complete 130-190 word data narrative inside "directions") with interconnected ratios, Venn subsets, or tree splits solvable into exact numbers.',
      'MIXED / COMBINATION DI ("diType": "mixed"): Combine EXACTLY TWO DIFFERENT visual chart panels inside "charts" (e.g., Panel 1 "chartType": "table" + Panel 2 "chartType": "pie", OR Panel 1 "chartType": "bar_vertical" + Panel 2 "chartType": "line") requiring multi-step cross-chart calculation.'
    ];

    const seed = Math.floor(Date.now() / 1000) % 5;
    const pickedFormats: string[] = [];
    if (diSetCount === 3) {
      // Always include Pie, Bar/Line, and Caselet/Mixed for an authentic 3-DI RBI Grade B paper!
      pickedFormats.push(diFormatsPool[0]); // Pie or Double Pie
      pickedFormats.push(seed % 2 === 0 ? diFormatsPool[1] : diFormatsPool[2]); // Bar (Vert/Horiz) or Line
      pickedFormats.push(seed % 3 === 0 ? diFormatsPool[4] : diFormatsPool[3]); // Mixed or Caselet (rotate both!)
    } else {
      for (let i = 0; i < diSetCount; i++) {
        pickedFormats.push(diFormatsPool[(seed + i * 2) % diFormatsPool.length]);
      }
    }

    const diInstructions = diSetCount > 0
      ? `
DATA INTERPRETATION (DI) ARCHITECTURE — STRICT 5-QUESTION SET RULE:
You MUST generate EXACTLY ${diSetCount} COMPLETE Data Interpretation Set(s) inside top-level "diSets" array.
Each DI Set MUST contain:
1. Structured metadata & visual data (` + "`groupId`, `diType`, `setTitle`, `directions`, `notes`, `charts`" + `):
   - Every visual chart (` + "`pie`, `bar_vertical`, `bar_horizontal`, `line`, `table`" + `) has crisp flat ` + "`data`" + ` (or ` + "`columns` + `rows`" + ` for ` + "`table`" + `) with REAL NUMERIC VALUES for every data point (never invent contradictory numbers).
   - For ` + "`table`" + `, ` + "`rows`" + ` MUST be an array of JSON objects keyed by ` + "`columns`" + ` (NEVER nested arrays like [[...]]!). For missing-value DI tables, put "?" in missing cells and state the exact deriving condition in ` + "`notes`" + ` or ` + "`directions`" + `.
2. "questions": An array of EXACTLY 5 linked MCQs derived mathematically from that DI set's charts/caselet (${diTotalMcqs} DI MCQs total across ${diSetCount} sets!).
   - Vary what the 5 linked questions ask within each set: percentage difference, ratio, weighted average, degree-to-value conversion, multi-step conditional projection, or comparative Rank/Difference.
   - Each of the 5 MCQs MUST have EXACTLY 5 distinct concrete numerical/ratio/comparison options and complete step-by-step arithmetic in "explanation".

ASSIGNED DI SET FORMATS FOR THIS EXAM (${diSetCount} Sets × 5 Questions = ${diTotalMcqs} Qs):
${pickedFormats.map((fmt, idx) => `• SET ${idx + 1}: ${fmt}`).join('\n')}`
      : '';

    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (QUANTITATIVE APTITUDE - RBI GRADE B PHASE 1):
CRITICAL RULE: ABSOLUTELY ZERO GENERAL KNOWLEDGE, CURRENT AFFAIRS, OR THEORETICAL ESSAYS.
This is a pure examination of advanced quantitative ability, commercial arithmetic, algebra, and authentic 5-question Data Interpretation sets calibrated to RBI Grade B Phase 1 (30 Marks / 25 Minutes benchmark).

QUESTION DISTRIBUTION:
${standaloneTotal > 0 ? `- STANDALONE MCQs inside top-level "questions" -> Generate EXACTLY ${standaloneTotal} MCQs (${standaloneStatic} "sourceTag": "Static", ${standaloneDynamic} "sourceTag": "Dynamic"${standalonePyq > 0 ? `, ${standalonePyq} "isPyq": true` : ''}).
  Topics: Multi-concept Commercial Arithmetic (SI/CI, Profit-Loss-Discount, Partnership, Time-Speed-Distance, Time-Work, Mixture-Alligation), Quadratic Equations (Quantity I vs II or x vs y), Missing/Wrong Number Series, 3-Statement Data Sufficiency, Probability & Mensuration.` : '- Do NOT put extra standalone MCQs outside "diSets" — output `"questions": []` and put ALL ' + diTotalMcqs + ' questions inside `"diSets"`.'}
${diInstructions}
${pyqCount > 0 && standalonePyq === 0 ? `- AUTHENTIC PYQ TAGGING: Mark ${pyqCount} DI questions matching classic RBI Grade B PYQ numerical patterns with "isPyq": true and "pyqYear": "RBI Grade B 2024".` : ''}

STRICT FORMAT REQUIREMENTS:
- Every MCQ MUST have EXACTLY 5 distinct options.
- Mathematical Consistency Check: Verify every calculation backwards from the chart/caselet numbers before finalizing "correctAnswer" and "explanation".`;

    if (diSetCount > 0) {
      jsonSchemaExample = `{
  "diSets": [
    {
      "groupId": "di_set_1",
      "diType": "mixed",
      "setTitle": "Branch Credit Disbursement & Recovery Breakdown (FY 2024–25)",
      "directions": "Study the following Pie Chart and Table carefully and answer the 5 questions that follow. The Pie Chart shows the percentage distribution of Total Loans Disbursed (Rs. 4,000 Crore) across 5 Zones (North, South, East, West, Central), while the Table shows the Ratio of Priority Sector to Non-Priority Sector loans and Recovery Rate (%) in each Zone.",
      "notes": [
        "Total Loans Disbursed across all 5 zones combined = Rs. 4,000 Crore.",
        "Recovered Amount = Loans Disbursed in that Zone × Recovery Rate (%)."
      ],
      "charts": [
        {
          "chartType": "pie",
          "title": "Zone-wise Loan Share (%)",
          "unit": "%",
          "totalLabel": "Total: Rs. 4,000 Cr",
          "categoryKey": "zone",
          "seriesKeys": ["share"],
          "data": [
            { "zone": "North", "share": 24 },
            { "zone": "South", "share": 28 },
            { "zone": "East", "share": 15 },
            { "zone": "West", "share": 21 },
            { "zone": "Central", "share": 12 }
          ]
        },
        {
          "chartType": "table",
          "title": "Priority Ratio & Recovery Rate",
          "columns": ["Zone", "Priority : Non-Priority", "Recovery Rate (%)"],
          "data": [],
          "rows": [
            { "Zone": "North", "Priority : Non-Priority": "5 : 3", "Recovery Rate (%)": 80 },
            { "Zone": "South", "Priority : Non-Priority": "4 : 3", "Recovery Rate (%)": 75 },
            { "Zone": "East", "Priority : Non-Priority": "2 : 3", "Recovery Rate (%)": 70 },
            { "Zone": "West", "Priority : Non-Priority": "3 : 4", "Recovery Rate (%)": 85 },
            { "Zone": "Central", "Priority : Non-Priority": "1 : 2", "Recovery Rate (%)": 65 }
          ]
        }
      ],
      "questions": [
        {
          "type": "MCQ",
          "sourceTag": "Dynamic",
          "isPyq": false,
          "topic": "Mixed Data Interpretation (Pie + Table)",
          "text": "What is the ratio of Priority Sector loans disbursed in the South Zone to the Non-Priority Sector loans disbursed in the West Zone?",
          "options": ["4 : 3", "16 : 15", "8 : 7", "32 : 27", "5 : 4"],
          "correctAnswer": "4 : 3",
          "explanation": "South Zone total = 28% of 4000 = Rs. 1,120 Cr. Priority share = (4/7)*1120 = Rs. 640 Cr. West Zone total = 21% of 4000 = Rs. 840 Cr. Non-Priority share = (4/7)*840 = Rs. 480 Cr. Ratio = 640 : 480 = 4 : 3.",
          "maxMarks": 1
        }
      ]
    },
    {
      "groupId": "di_set_2",
      "diType": "bar_horizontal",
      "setTitle": "Quarterly Export Volume of FinTech Hardware (Units in '000)",
      "directions": "Study the Horizontal Bar Graph showing exports by Firm A and Firm B across 5 Quarters and answer the 5 questions below.",
      "notes": ["All figures represent thousands of units exported."],
      "charts": [
        {
          "chartType": "bar_horizontal",
          "title": "Firm A vs Firm B Exports ('000 Units)",
          "unit": "k",
          "xAxisLabel": "Units ('000)",
          "yAxisLabel": "Quarter",
          "categoryKey": "quarter",
          "seriesKeys": ["Firm A", "Firm B"],
          "data": [
            { "quarter": "Q1", "Firm A": 42, "Firm B": 36 },
            { "quarter": "Q2", "Firm A": 54, "Firm B": 48 },
            { "quarter": "Q3", "Firm A": 45, "Firm B": 60 },
            { "quarter": "Q4", "Firm A": 68, "Firm B": 52 },
            { "quarter": "Q5", "Firm A": 75, "Firm B": 64 }
          ]
        }
      ],
      "questions": [
        {
          "type": "MCQ",
          "sourceTag": "Dynamic",
          "isPyq": false,
          "topic": "Bar Graph Data Interpretation",
          "text": "Total units exported by Firm A in Q2 and Q4 combined is approximately what percent more than units exported by Firm B in Q1 and Q3 combined?",
          "options": ["27.08%", "24.50%", "31.25%", "29.17%", "22.40%"],
          "correctAnswer": "27.08%",
          "explanation": "Firm A (Q2+Q4) = 54 + 68 = 122k. Firm B (Q1+Q3) = 36 + 60 = 96k. % more = (122 - 96)/96 * 100 = 26/96 * 100 = 27.08%.",
          "maxMarks": 1
        }
      ]
    }
  ],
  "questions": ${standaloneTotal > 0 ? `[
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "Quadratic Equations & Comparisons",
      "text": "Solve Equations I and II and determine the relation between x and y:\\nI. 3x² - 19x + 28 = 0\\nII. 2y² - 17y + 36 = 0",
      "options": ["x > y", "x < y", "x ≥ y", "x ≤ y", "x = y or relationship cannot be established"],
      "correctAnswer": "x ≤ y",
      "explanation": "x = 7/3 or 4; y = 9/2 or 4 => x ≤ y.",
      "maxMarks": 1
    }
  ]` : '[]'}
}`;
    } else {
      jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Quadratic Equations & Series'}",
      "text": "In the following question, two quadratic equations numbered I and II are given. Solve both equations and find the mathematical relation between x and y:\\n\\nEquation I: 3x² - 19x + 28 = 0\\nEquation II: 2y² - 17y + 36 = 0",
      "options": [
        "x > y",
        "x < y",
        "x ≥ y",
        "x ≤ y",
        "x = y or relationship between x and y cannot be established"
      ],
      "correctAnswer": "x ≤ y",
      "explanation": "Equation I: 3x² - 12x - 7x + 28 = 0 => 3x(x - 4) - 7(x - 4) = 0 => (3x - 7)(x - 4) = 0 => x = 7/3 (≈2.33) or x = 4.\\nEquation II: 2y² - 8y - 9y + 36 = 0 => 2y(y - 4) - 9(y - 4) = 0 => (2y - 9)(y - 4) = 0 => y = 9/2 (4.5) or y = 4.\\nComparing values: 2.33 < 4.5; 2.33 < 4; 4 < 4.5; 4 = 4. Therefore, x ≤ y.",
      "maxMarks": 1
    },
    {
      "type": "MCQ",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Quantity Comparisons'}",
      "text": "Compare the quantities given below:\\n\\nQuantity I: The compound interest earned on Rs. 16,000 for 1.5 years at 20% per annum, compounded half-yearly.\\n\\nQuantity II: The simple interest earned on Rs. 25,000 for 3 years at 7.5% per annum.\\n\\nDetermine the relation between Quantity I and Quantity II:",
      "options": [
        "Quantity I > Quantity II",
        "Quantity I < Quantity II",
        "Quantity I ≥ Quantity II",
        "Quantity I ≤ Quantity II",
        "Quantity I = Quantity II or relation cannot be established"
      ],
      "correctAnswer": "Quantity I < Quantity II",
      "explanation": "Quantity I: Semi-annual rate r = 10%, n = 3 half-years. Amount = 16000 * (1 + 0.10)³ = 16000 * 1.331 = Rs. 21,296. CI = 21,296 - 16,000 = Rs. 5,296.\\nQuantity II: SI = (25,000 * 7.5 * 3) / 100 = 250 * 22.5 = Rs. 5,625.\\nComparing: 5,296 < 5,625 => Quantity I < Quantity II.",
      "maxMarks": 1
    }
  ]
}`;
    }
  } else if (subjectSlug === 'english') {
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (ENGLISH LANGUAGE - RBI GRADE B PHASE 1):
CRITICAL RULE: Advanced verbal acuity, grammatical syntax, vocabulary in context, and macroeconomic passage comprehension (30 Marks / 25 Minutes benchmark).

QUESTION DISTRIBUTION:
- CATEGORY 1: "${primaryMcqLabel}" -> Generate EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static".
  Topics: Complex Error Detection (subjunctive mood, parallelism, misplaced modifiers, inverted conditionals), Phrase Replacement, Sentence Connectors & Starters, High-register Triple/Double Fillers & Cloze Mechanics.
- CATEGORY 2: "${secondaryMcqLabel}" -> Generate EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic".
  Topics: Dense Reading Comprehension on macroeconomic/central banking themes with inferential/flaw/assumption questions, 6-sentence coherent Para Jumbles.
${pyqCount > 0 ? `- AUTHENTIC PYQ SECTION: Generate EXACTLY ${pyqCount} authentic Previous Year Questions (PYQs) asked in official RBI Grade B English Language papers (2018–2025). Mark each with "isPyq": true and "pyqYear": "RBI Grade B 2024" (or 2023, 2022, etc.).` : ''}

STRICT FORMAT REQUIREMENTS:
- Every MCQ MUST have EXACTLY 5 distinct options.
- The explanation must provide grammatical rules and contextual justification.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Grammar & Syntax Error Detection'}",
      "text": "In the following sentence, identify the segment containing a grammatical error. If the sentence is grammatically correct, select 'No error':\\n\\n(A) Had the Monetary Policy Committee anticipated / (B) the sharp escalation in headline food inflation, / (C) they would have had tightened the policy corridor / (D) much earlier in the tightening cycle.",
      "options": [
        "Segment (A)",
        "Segment (B)",
        "Segment (C)",
        "Segment (D)",
        "No error"
      ],
      "correctAnswer": "Segment (C)",
      "explanation": "In conditional third clause 'Had + Subject + V3...', the result clause requires 'would have + V3'. Here 'would have had tightened' introduces redundant auxiliary 'had'. The correct phrasing is 'they would have tightened'.",
      "maxMarks": 1
    },
    {
      "type": "MCQ",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Reading Comprehension & Inference'}",
      "text": "Read the following editorial excerpt:\\n'The post-pandemic normalization of global liquidity has confronted emerging market central banks with a classic trilemma tradeoff. As core central banks aggressively unwind quantitative easing, currency depreciation pressures risk un-anchoring domestic inflation expectations. Rather than mechanically matching external rate hikes, monetary authorities have relied on macroprudential foreign exchange interventions and standing absorption windows to insulate yield curves without prematurely stifling domestic credit formation.'\\n\\nBased on the excerpt, what is the author's primary assertion regarding emerging market central banking strategy?",
      "options": [
        "Emerging central banks must rigidly synchronize policy rate hikes with advanced economy central banks.",
        "Central banks have deployed targeted macroprudential and liquidity tools to insulate domestic credit from external shocks.",
        "Quantitative tightening in developed markets makes domestic yield curve stability impossible.",
        "Monetary policy transmission is ineffective unless supported by statutory capital account controls.",
        "Foreign exchange market interventions necessarily exacerbate domestic inflationary pressures."
      ],
      "correctAnswer": "Central banks have deployed targeted macroprudential and liquidity tools to insulate domestic credit from external shocks.",
      "explanation": "The excerpt explicitly underscores that rather than mechanically copying external hikes, authorities used macroprudential FX tools and standing windows to insulate yield curves and protect domestic credit formation.",
      "maxMarks": 1
    }
  ]
}`;
  } else if (subjectSlug === 'general-awareness') {
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (GENERAL AWARENESS - RBI GRADE B PHASE 1):
High-speed, high-rigor 80-mark section testing central banking, financial architecture, statutory acts, and dynamic national/international current affairs.

MANDATORY RULES FOR BOTH STATIC & DYNAMIC QUESTIONS:
- FOR DYNAMIC QUESTIONS ("${secondaryMcqLabel}"):
  Generate EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic".
  You MUST strictly anchor these questions to RECENT EVENTS, developments, circulars, and policies from the LAST 6-8 MONTHS (2024–2026), Union Budget provisions, Economic Survey findings, latest RBI Master Directions (e.g. PCA framework, dynamic risk weights, regulatory sandbox, digital lending norms), and national/international summits (G20, BRICS, COP).
- FOR STATIC QUESTIONS ("${primaryMcqLabel}"):
  Generate EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static".
  You MUST base these questions directly on the archetypes, depth, and traps found in authentic RBI Grade B Previous Year Questions (PYQs). Test core statutory provisions of RBI Act 1934, Banking Regulation Act 1949, DICGC Act, FEMA 1999, PMLA, monetary tools (Repo, SDF, MSF, LAF corridor, CRR, SLR), money/capital markets (CP, CD, T-Bills), and international financial institutions (BIS, IMF, World Bank). The difficulty level must match or EXCEED the hardest RBI Grade B PYQs.
${pyqCount > 0 ? `- AUTHENTIC PYQ SECTION: Generate EXACTLY ${pyqCount} authentic Previous Year Questions (PYQs) asked in official RBI Grade B General Awareness papers (2018–2025). Mark each with "isPyq": true and "pyqYear": "RBI Grade B 2024" (or 2023, 2022, etc.).` : ''}

STRICT FORMAT REQUIREMENTS:
- Every single MCQ MUST have EXACTLY 5 distinct options.
- MANDATORY RBI GRADE B QUESTION FORMAT MIX (STRICTLY ENFORCED):
  • ~40% Direct Analytical / Statutory / Threshold MCQs (concrete thresholds, statutory sections, committee names, exact figures or swapped regulator powers as options).
  • ~20% Code-Combination MCQs (Statements I–IV with options like "Only I and III", "Only II and IV", "Only I, II and IV", "Only IV", "All I, II, III and IV").
  • ~15% Caselet Vignette / Double-Blank [X] & [Y] MCQs (short paragraph scenario testing two regulatory facts simultaneously).
  • ~15% Match-the-Following (List I vs List II with code options like "1-C, 2-A, 3-D, 4-B") OR Exception MCQs ("Which of the following statements is INCORRECT?").
  • MAX ≤15% Pair-Counting MCQs ("Only one / Only two / Only three / All four / None") — STRICT CAP of AT MOST 2 per batch, NEVER back-to-back.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'RBI Circulars & PCA Framework'}",
      "text": "Under the Prompt Corrective Action (PCA) Framework for Non-Banking Financial Companies (NBFCs) notified by the Reserve Bank of India, which of the following represents the Tier 1 Capital threshold trigger for Risk Threshold 1?",
      "options": [
        "Tier 1 Capital ratio falling below 10.0%",
        "Tier 1 Capital ratio falling below 12.0%",
        "Tier 1 Capital ratio falling below 15.0%",
        "Tier 1 Capital ratio falling below 8.0%",
        "Net NPA ratio exceeding 9.0%"
      ],
      "correctAnswer": "Tier 1 Capital ratio falling below 10.0%",
      "explanation": "Under the RBI PCA Framework for NBFCs (Middle, Upper, and Top Layers), Risk Threshold 1 is triggered when CRAR falls below 15.0% or the Tier 1 Capital ratio drops below 10.0%.",
      "maxMarks": 1
    },
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Statutory Banking & Monetary Policy'}",
      "text": "With reference to the Standing Deposit Facility (SDF) operated by the Reserve Bank of India, examine the following statements:\\nI. SDF allows the RBI to absorb liquidity from commercial banks without offering collateral.\\nII. SDF rate acts as the floor of the Liquidity Adjustment Facility (LAF) corridor.\\nIII. Statutory power for SDF came via the Finance Act 2018 amendment to Section 17 of the RBI Act, 1934.\\nIV. SDF balances qualify for Statutory Liquidity Ratio (SLR) maintenance.\\n\\nWhich of the statements given above are CORRECT?",
      "options": [
        "Only I and II",
        "Only I, II and III",
        "Only II and IV",
        "Only I, III and IV",
        "All I, II, III and IV"
      ],
      "correctAnswer": "Only I, II and III",
      "explanation": "Statements I, II, and III are correct. Statement IV is incorrect because SDF balances are eligible for CRR/liquidity buffers as specified, NOT for Statutory Liquidity Ratio (SLR) maintenance.",
      "maxMarks": 1
    },
    {
      "type": "MCQ",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Regulatory Committees & Institutions'}",
      "text": "Read the following regulatory vignette and identify [X] and [Y]:\\n'To resolve stressed assets cleanly through an institutional bad bank architecture, the Reserve Bank of India licensed [X] under the SARFAESI Act, 2002 with sovereign-backed Security Receipts guaranteed up to Rs. [Y] Crore via IDRCL.'",
      "options": [
        "[X]: NARCL ; [Y]: 30,600",
        "[X]: ARCIL ; [Y]: 25,000",
        "[X]: NARCL ; [Y]: 50,000",
        "[X]: NaBFID ; [Y]: 20,000",
        "[X]: AMCIL ; [Y]: 30,600"
      ],
      "correctAnswer": "[X]: NARCL ; [Y]: 30,600",
      "explanation": "National Asset Reconstruction Company Limited (NARCL) was set up as the Asset Reconstruction Company backed by a Rs. 30,600 crore sovereign guarantee for Security Receipts issued to acquire legacy NPAs.",
      "maxMarks": 1
    }
  ]
}`;
  } else if (subjectSlug === 'esi') {
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (ECONOMIC & SOCIAL ISSUES - RBI GRADE B PHASE 2):
Comprehensive 100-mark paper: 50 Marks MCQ + 50 Marks Descriptive covering Indian macroeconomics, social structures, and dynamic policy frameworks.

MANDATORY RULES FOR BOTH STATIC & DYNAMIC QUESTIONS:
- FOR DYNAMIC QUESTIONS ("${secondaryMcqLabel}"):
  Generate EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic".
  You MUST strictly anchor to RECENT CONTEMPORARY EVENTS, latest Union Budget allocations, Economic Survey findings, government flagship welfare schemes (PM-KISAN, PMFBY, Ayushman Bharat, PLI schemes, NRLM), NITI Aayog SDG indices, and recent environmental/green finance commitments.
- FOR STATIC QUESTIONS ("${primaryMcqLabel}"):
  Generate EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static".
  You MUST base these questions directly on the archetypes, theoretical depth, and traps found in authentic RBI Grade B ESI Previous Year Questions (PYQs). Cover Solow growth models, poverty estimation committees (Tendulkar, Rangarajan, Alagh, Lakdawala), national income accounting, Phillips curve, fiscal/monetary transmission, and balance of payments. The difficulty level must match or EXCEED the hardest RBI Grade B PYQs.
${pyqCount > 0 ? `- AUTHENTIC PYQ SECTION: Generate EXACTLY ${pyqCount} authentic Previous Year Questions (PYQs) asked in official RBI Grade B Phase 2 ESI papers (2018–2025). Mark each with "isPyq": true and "pyqYear": "RBI Grade B 2024" (or 2023, 2022, etc.).` : ''}

DESCRIPTIVE QUESTIONS:
- Category 1: "${primaryDescLabel}" -> Generate ${desc1Count} questions (10 Marks / 400 words each). Conceptual socio-economic essays grounded in economic theory.
- Category 2: "${secondaryDescLabel}" -> Generate ${desc2Count} questions (15 Marks / 600 words each). Contemporary policy dilemma and forward roadmap analyzing recent events.
Provide a 4-pillar marking rubric and structured model answer with headings.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Macroeconomic Theory & National Income'}",
      "text": "Which of the following macroeconomic indicators correctly captures the 'Net Domestic Product at Factor Cost' (NDP_FC)?",
      "options": [
        "GDP at Market Prices - Depreciation - Indirect Taxes + Subsidies",
        "GNP at Market Prices - Depreciation + Net Indirect Taxes",
        "GDP at Factor Cost + Net Factor Income from Abroad",
        "NDP at Market Prices + Indirect Taxes - Subsidies",
        "GNP at Factor Cost + Depreciation - Net Factor Income from Abroad"
      ],
      "correctAnswer": "GDP at Market Prices - Depreciation - Indirect Taxes + Subsidies",
      "explanation": "NDP_FC = GDP_MP - Depreciation - Net Indirect Taxes (where NIT = Indirect Taxes - Subsidies). Subtracting (Indirect Taxes - Subsidies) gives GDP_MP - Depreciation - Indirect Taxes + Subsidies.",
      "maxMarks": 1
    },
    {
      "type": "Descriptive",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Applied Policy & Institutional Analysis'}",
      "text": "Examine the structural challenges in India's labor market dynamics, specifically regarding female labor force participation and youth unemployment. How can targeted fiscal policy and skill development initiatives effectively harness the demographic dividend?",
      "maxMarks": 15,
      "wordLimit": 600,
      "markingScheme": {
        "Demographic Profile & Statistical Context": 3.5,
        "Structural Impediments & Female LFPR Barriers": 4.5,
        "Fiscal Interventions & Skill Development Evaluation": 4.0,
        "Strategic Policy Recommendations & Roadmap": 3.0
      },
      "modelAnswer": "### 1. Introduction & Demographic Context\\n\\nIndia stands at a pivotal demographic inflection point with a median age of 28.7 years...\\n\\n### 2. Structural Barriers to Labor Absorption\\n\\nKey bottlenecks include informal employment concentration, caregiving burdens limiting female participation, and educational-skill mismatches...\\n\\n### 3. Fiscal & Policy Levers\\n\\nFiscal incentives through production-linked schemes and formalization credits combined with modernized apprenticeships...\\n\\n### 4. Pragmatic Policy Roadmap\\n\\nStrengthening social care infrastructure, localized vocational clusters, and flexible working frameworks."
    }
  ]
}`;
  } else if (subjectSlug === 'fm') {
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (FINANCE & MANAGEMENT - RBI GRADE B PHASE 2):
50 Marks MCQ + 50 Marks Descriptive covering financial architecture, central banking regulation, corporate finance numericals, and management/leadership theory.

MANDATORY RULES FOR BOTH STATIC & DYNAMIC QUESTIONS:
- FOR DYNAMIC QUESTIONS ("${secondaryMcqLabel}"):
  Generate EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic".
  You MUST strictly anchor to RECENT DEVELOPMENTS in Indian financial markets, latest RBI regulatory frameworks (2024–2026 circulars, dynamic risk weights, digital lending guidelines, FinTech sandbox cohorts, Central Bank Digital Currency e-Rupee rollout), contemporary corporate governance dilemmas, and leadership change in public/private institutions.
- FOR STATIC QUESTIONS ("${primaryMcqLabel}"):
  Generate EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static".
  You MUST base these questions directly on the archetypes, depth, and traps found in authentic RBI Grade B FM Previous Year Questions (PYQs). Include rigorous multi-step numerical calculations (Yield to Maturity, Modified Duration, WACC, DuPont ROE decomposition, Debt Service Coverage Ratio, Levered Beta), Basel III capital adequacy ratios (CET-1, CCB, Countercyclical buffer, D-SIB), corporate governance committee recommendations (Kumar Mangalam Birla, Naresh Chandra, Narayana Murthy, Uday Kotak), and classical motivation/leadership models (Maslow, Herzberg, Vroom, Alderfer, Blake-Mouton). The difficulty level must match or EXCEED the hardest RBI Grade B PYQs.
${pyqCount > 0 ? `- AUTHENTIC PYQ SECTION: Generate EXACTLY ${pyqCount} authentic Previous Year Questions (PYQs) asked in official RBI Grade B Phase 2 FM papers (2018–2025). Mark each with "isPyq": true and "pyqYear": "RBI Grade B 2024" (or 2023, 2022, etc.).` : ''}

DESCRIPTIVE QUESTIONS:
- Category 1: "${primaryDescLabel}" -> Generate ${desc1Count} questions (10 Marks / 400 words). Financial regulation & supervision.
- Category 2: "${secondaryDescLabel}" -> Generate ${desc2Count} questions (15 Marks / 600 words). Organizational leadership & governance case dilemma.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Corporate Finance & Basel III'}",
      "text": "A commercial bank classified as a Domestic Systemically Important Bank (D-SIB) in Bucket 3 reports Risk-Weighted Assets (RWAs) of Rs. 100,000 crore. Under RBI Basel III guidelines (with Countercyclical Capital Buffer at 0%), what is the minimum Common Equity Tier 1 (CET-1) capital including the Capital Conservation Buffer (CCB) and D-SIB surcharge required to be maintained?",
      "options": [
        "Rs. 5,500 crore",
        "Rs. 8,000 crore",
        "Rs. 8,400 crore",
        "Rs. 8,600 crore",
        "Rs. 11,500 crore"
      ],
      "correctAnswer": "Rs. 8,400 crore",
      "explanation": "Under RBI Basel III norms, minimum CET-1 = 5.5%, CCB = 2.5% (must be met with CET-1), and D-SIB Bucket 3 surcharge = 0.40% (must also be met via CET-1). Total CET-1 requirement = 5.5% + 2.5% + 0.40% = 8.40% of Rs. 100,000 crore = Rs. 8,400 crore.",
      "maxMarks": 1
    },
    {
      "type": "Descriptive",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Organizational Leadership & Governance'}",
      "text": "Differentiate between Transformational and Transactional leadership models. In the context of digital transformation in public sector banking, analyze how transformational leaders can overcome organizational inertia and mitigate resistance to change.",
      "maxMarks": 15,
      "wordLimit": 600,
      "markingScheme": {
        "Theoretical Grounding & Conceptual Contrast": 3.5,
        "Public Sector Banking Inertia & Change Dynamics": 4.5,
        "Transformational Levers (4 I's Framework)": 4.0,
        "Implementation Governance & Cultural Roadmap": 3.0
      },
      "modelAnswer": "### 1. Conceptual Distinction in Leadership Models\\n\\nTransactional leadership operates on contingent rewards and active exception management, whereas Transformational leadership inspires followers through idealized influence, inspirational motivation, intellectual stimulation, and individualized consideration (Bass's 4 I's)...\\n\\n### 2. Sources of Inertia in Digital Banking Transitions\\n\\nLegacy hierarchical cultures, union resistance, fear of technological obsolescence, and siloed operational practices...\\n\\n### 3. Deploying Transformational Leadership\\n\\nFraming digital enablement as empowerment rather than replacement, cross-functional upskilling, and psychological safety...\\n\\n### 4. Governance & Cultural Integration\\n\\nEstablishing transparent metric dashboards, continuous feedback loops, and inclusive organizational redesign."
    }
  ]
}`;
  } else if (subjectSlug === 'english-writing') {
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (ENGLISH WRITING SKILLS - RBI GRADE B PHASE 2 PAPER II):
100-mark official descriptive examination (90 minutes) consisting of EXACTLY 3 tasks totaling 100 marks:
1. QUESTION 1 — ESSAY WRITING (maxMarks: 40, wordLimit: 400, sourceTag: "Static"):
   - Provide an authoritative central banking / macroeconomic / fintech / institutional governance essay topic.
   - Set "maxMarks": 40 and "wordLimit": 400.
2. QUESTION 2 — PRÉCIS WRITING (maxMarks: 30, wordLimit: 170, sourceTag: "Static"):
   - Inside "text", you MUST include a COMPLETE, cohesive ~420–480 word formal financial/economic speech excerpt or policy report paragraph right inside the prompt followed by instructions to write a précis in ~170 words with an apt title.
   - Set "maxMarks": 30 and "wordLimit": 170.
3. QUESTION 3 — READING COMPREHENSION (maxMarks: 30, wordLimit: 350, sourceTag: "Dynamic"):
   - Inside "text", you MUST include a COMPLETE ~350–400 word dense editorial/financial passage followed by 5 numbered analytical sub-questions (Q1–Q5) requiring concise descriptive answers in the candidate's own words.
   - Set "maxMarks": 30 and "wordLimit": 350.
CRITICAL: Output ALL ${totalDescs || 3} tasks cleanly with complete embedded passages for Précis and Reading Comprehension.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "Descriptive",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "Paper II · Essay Writing (40 Marks)",
      "text": "Write an analytical essay of approximately 400 words on:\\n\\n'Central Bank Digital Currencies (CBDCs):Balancing Financial Inclusion Imperatives with Commercial Bank Disintermediation Risks.'",
      "maxMarks": 40,
      "wordLimit": 400,
      "markingScheme": {
        "Conceptual Depth & Macroeconomic Analysis": 12.0,
        "Coherence, Argument Flow & Balance": 12.0,
        "Grammatical Precision & Formal Register": 10.0,
        "Introduction & Strategic Conclusion": 6.0
      },
      "modelAnswer": "### Balancing Inclusion and Financial Stability in CBDC Architecture\\n\\nCentral Bank Digital Currencies represent a structural evolution in sovereign monetary liabilities..."
    },
    {
      "type": "Descriptive",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "Paper II · Précis Writing (30 Marks)",
      "text": "Write a précis of the following passage in approximately 170 words, reducing it to one-third of its original length, and provide a suitable title:\\n\\n[Full 450-word formal central banking speech excerpt here...]",
      "maxMarks": 30,
      "wordLimit": 170,
      "markingScheme": {
        "Accuracy & Central Idea Retention": 10.0,
        "Brevity & Word-Limit Adherence (170w)": 8.0,
        "Apt Title & Paraphrasing Quality": 6.0,
        "Grammatical Clarity & Tone": 6.0
      },
      "modelAnswer": "Title: Calibrating Monetary Transmission Amid Global Supply Shocks\\n\\n[Concise 170-word précis summarizing core arguments without verbatim copying...]"
    },
    {
      "type": "Descriptive",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "Paper II · Reading Comprehension (30 Marks)",
      "text": "Read the passage carefully and answer all 5 questions that follow in your own words:\\n\\n[Full 380-word economic editorial passage here...]\\n\\n1. What structural vulnerability does the author identify in global liquidity cycles?\\n2. Why are macroprudential buffers emphasized alongside policy rate actions?\\n3. Explain the paradox highlighted in paragraph three.\\n4. What policy trade-off confronts emerging market regulators?\\n5. Suggest a contextual meaning for 'procyclical deleveraging' as used in the passage.",
      "maxMarks": 30,
      "wordLimit": 350,
      "markingScheme": {
        "Inferential & Factual Comprehension (Q1-Q5)": 16.0,
        "Paraphrasing & Original Expression": 8.0,
        "Clarity & Conciseness": 6.0
      },
      "modelAnswer": "1. The author highlights how short-term foreign portfolio flows amplify domestic credit procyclicality...\\n2. Macroprudential buffers curb sectoral leverage without tightening economy-wide rates..."
    }
  ]
}`;
  } else {
    // General / Uncategorized
    subjectSpecificRules = `
SUBJECT: "${subjectName}"
Generate high-rigor RBI Grade B examination questions testing syllabus mastery, statutory provisions, and applied analytical problems.
- Category 1: "${primaryMcqLabel}" -> ${mcq1Count} MCQs with "sourceTag": "Static".
- Category 2: "${secondaryMcqLabel}" -> ${mcq2Count} MCQs with "sourceTag": "Dynamic".
${pyqCount > 0 ? `- Authentic PYQs -> ${pyqCount} questions with "isPyq": true.` : ''}
- Descriptive Category 1: "${primaryDescLabel}" -> ${desc1Count} questions.
- Descriptive Category 2: "${secondaryDescLabel}" -> ${desc2Count} questions.
Every MCQ must have EXACTLY 5 distinct options.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Core Concept Assessment'}",
      "text": "Which of the following principles forms the bedrock of the regulatory framework under discussion?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
      "correctAnswer": "Option 1",
      "explanation": "Detailed theoretical and empirical explanation.",
      "maxMarks": 1
    }
  ]
}`;
  }

  return `You are the Chief Examiner and Principal Paper Setter on the Services Selection Board for the Reserve Bank of India (RBI Grade B - Officers in Grade 'B' Direct Recruitment).
You must construct an exceptionally rigorous mock examination that matches the exact difficulty configuration requested.

SUBJECT: "${subjectName}"
${topicFocus}${batchDirective}${weightedMarksDirective}
EXAM MODE: "${examMode}"
DIFFICULTY LEVEL: "${difficulty}"
TARGET MCQ COUNT: ${totalMcqs} (${mcq1Count} in "${primaryMcqLabel}", ${mcq2Count} in "${secondaryMcqLabel}"${pyqCount > 0 ? `, ${pyqCount} Authentic PYQs` : ''})
TARGET DESCRIPTIVE COUNT: ${totalDescs} (${desc1Count} in "${primaryDescLabel}", ${desc2Count} in "${secondaryDescLabel}")

${difficultyDirective}

${subjectSpecificRules}

MANDATORY EXAMINATION STANDARDS:
1. STRICT 5-OPTION RULE: EVERY single MCQ MUST HAVE EXACTLY 5 DISTINCT OPTIONS (Option 1 to Option 5). Never output only 4 options.
2. FORMAT VARIETY RULE: Do NOT trap multiple questions in identical "Only one / Only two / Only three" options. Across every batch, vary between direct concrete answers, code combinations ("Only I and III"), match-the-following ("1-B, 2-D, 3-A, 4-C"), [X]/[Y] vignettes, exceptions ("Which is INCORRECT?"), and DI graphs/caselets.
3. QUESTION COUNT ENFORCEMENT:
   - Output EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static" and "isPyq": false.
   - Output EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic" and "isPyq": false.
   ${pyqCount > 0 ? `- Output EXACTLY ${pyqCount} Authentic PYQs with "isPyq": true, "pyqYear": "RBI Grade B [Year]", and "sourceTag": "Static".` : ''}
   - Output EXACTLY ${desc1Count} Descriptive questions with "sourceTag": "Static".
   - Output EXACTLY ${desc2Count} Descriptive questions with "sourceTag": "Dynamic".

STUDY NOTES & REFERENCE TEXT:
"""
${extractedText}
"""

Output valid JSON matching this exact structure:
${jsonSchemaExample}`;
}

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { extractedText, config } = req.body;
    const subjectSlug = config?.subjectSlug || 'general-awareness';
    const subjectName = config?.subject || 'General Banking & Economic Awareness';

    const prompt = buildSubjectPrompt(subjectSlug, subjectName, config, extractedText);

    const rawJson = await callGeminiWithRetry(prompt);
    const parsed = safeJsonParse(rawJson);

    // Safe option prefix cleaner: strips leading "A) ", "(A) ", "Option 1: ", "1. " etc. without destroying "A-2, B-1"
    const cleanOptionText = (opt: any): string => {
      if (!opt) return '';
      return String(opt)
        .replace(/^(?:Option\s+[A-E1-5][\:\.]?\s*|\(?[A-Ea-e1-5]\)\s*|[A-Ea-e1-5][\.\:]\s+)/i, '')
        .trim();
    };

    const coerceScalar = (val: any): string | number => {
      if (typeof val === 'number' && Number.isFinite(val)) return val;
      if (val === null || val === undefined) return '—';
      const str = String(val).trim();
      if (!str) return '—';
      // Only coerce pure numbers (avoid turning ratios like "5 : 3" or "2024-25" into numbers)
      if (/^-?\d+(?:\.\d+)?$/.test(str)) {
        const n = Number(str);
        if (Number.isFinite(n)) return n;
      }
      return str;
    };

    const VALID_DI_TYPES = new Set(['pie', 'double_pie', 'bar_vertical', 'bar_horizontal', 'line', 'table', 'caselet', 'mixed']);
    const VALID_CHART_TYPES = new Set(['pie', 'bar_vertical', 'bar_horizontal', 'line', 'table']);

    const normalizeDiGroup = (rawSet: any, setIdx: number) => {
      if (!rawSet || typeof rawSet !== 'object') return null;
      const rawDiType = String(rawSet.diType || 'mixed').toLowerCase().trim();
      const diType = VALID_DI_TYPES.has(rawDiType) ? rawDiType : 'mixed';
      const groupId = String(rawSet.groupId || `di_${Date.now()}_${setIdx + 1}`);
      const setTitle = String(rawSet.setTitle || `Data Interpretation Set ${setIdx + 1}`).trim();
      const directions = String(rawSet.directions || rawSet.passage || '').trim();
      const notes = Array.isArray(rawSet.notes)
        ? rawSet.notes.map((n: any) => String(n || '').trim()).filter(Boolean)
        : [];

      const rawCharts = Array.isArray(rawSet.charts) ? rawSet.charts : [];
      const charts = rawCharts
        .filter((ch: any) => ch && typeof ch === 'object')
        .map((ch: any, chIdx: number) => {
          const rawChartType = String(ch.chartType || (diType === 'double_pie' ? 'pie' : diType === 'caselet' ? 'table' : diType)).toLowerCase().trim();
          const chartType = VALID_CHART_TYPES.has(rawChartType) ? rawChartType : 'bar_vertical';

          // Normalize flat object data rows (never nested arrays)
          let dataArr: Array<Record<string, string | number>> = [];
          if (Array.isArray(ch.data)) {
            dataArr = ch.data
              .filter((row: any) => row && typeof row === 'object' && !Array.isArray(row))
              .map((row: any) => {
                const flat: Record<string, string | number> = {};
                Object.entries(row).forEach(([k, v]) => {
                  flat[String(k)] = coerceScalar(v);
                });
                return flat;
              });
          }

          let columns = Array.isArray(ch.columns)
            ? ch.columns.map((c: any) => String(c || '').trim()).filter(Boolean)
            : [];

          let rowsArr: Array<Record<string, string | number>> = [];
          if (Array.isArray(ch.rows)) {
            rowsArr = ch.rows
              .map((r: any) => {
                if (Array.isArray(r)) {
                  // Convert accidental nested array rows into flat objects keyed by columns
                  const obj: Record<string, string | number> = {};
                  r.forEach((cell: any, cIdx: number) => {
                    const colKey = columns[cIdx] || `Col ${cIdx + 1}`;
                    obj[colKey] = coerceScalar(cell);
                  });
                  return obj;
                }
                if (r && typeof r === 'object') {
                  const obj: Record<string, string | number> = {};
                  Object.entries(r).forEach(([k, v]) => {
                    obj[String(k)] = coerceScalar(v);
                  });
                  return obj;
                }
                return null;
              })
              .filter(Boolean) as Array<Record<string, string | number>>;
          }

          if (chartType === 'table' && columns.length === 0 && rowsArr.length > 0) {
            columns = Object.keys(rowsArr[0]);
          }
          if (chartType === 'table' && rowsArr.length === 0 && dataArr.length > 0) {
            rowsArr = dataArr;
            if (columns.length === 0) columns = Object.keys(rowsArr[0]);
          }

          const sampleKeys = dataArr.length > 0 ? Object.keys(dataArr[0]) : [];
          let categoryKey = ch.categoryKey ? String(ch.categoryKey).trim() : '';
          if (!categoryKey && sampleKeys.length > 0) {
            const nonNumericKey = sampleKeys.find(k => typeof dataArr[0][k] === 'string');
            categoryKey = nonNumericKey || sampleKeys[0];
          }

          let seriesKeys = Array.isArray(ch.seriesKeys)
            ? ch.seriesKeys.map((s: any) => String(s || '').trim()).filter(Boolean)
            : [];
          if (seriesKeys.length === 0 && sampleKeys.length > 0) {
            seriesKeys = sampleKeys.filter(k => k !== categoryKey);
          }

          const panel: Record<string, any> = {
            chartType,
            title: String(ch.title || `Exhibit ${chIdx + 1}`).trim(),
            data: dataArr,
          };
          if (ch.subtitle) panel.subtitle = String(ch.subtitle).trim();
          if (ch.unit) panel.unit = String(ch.unit).trim();
          if (ch.totalLabel) panel.totalLabel = String(ch.totalLabel).trim();
          if (ch.xAxisLabel) panel.xAxisLabel = String(ch.xAxisLabel).trim();
          if (ch.yAxisLabel) panel.yAxisLabel = String(ch.yAxisLabel).trim();
          if (categoryKey) panel.categoryKey = categoryKey;
          if (seriesKeys.length > 0) panel.seriesKeys = seriesKeys;
          if (columns.length > 0) panel.columns = columns;
          if (rowsArr.length > 0) panel.rows = rowsArr;
          return panel;
        });

      const group: Record<string, any> = {
        groupId,
        diType,
        setTitle,
        directions,
        charts: diType === 'caselet' ? [] : charts
      };
      if (notes.length > 0) group.notes = notes;
      return group;
    };

    const normalizeSingleQuestion = (
      q: any,
      index: number,
      diMeta?: { diGroup: any; diSetIndex: number; diSetTotal: number; forceSourceTag?: 'Static' | 'Dynamic' }
    ) => {
      const isMCQ = (q.type || '').toUpperCase() === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0) || (q.options && typeof q.options === 'object');
      const text = q.text || q.question || q.questionText || `Question ${index + 1}`;
      const sourceTag = diMeta?.forceSourceTag || ((q.sourceTag === 'Dynamic' || q.source === 'Dynamic') ? 'Dynamic' : 'Static');

      if (isMCQ) {
        let optionsList: string[] = [];
        if (Array.isArray(q.options)) {
          optionsList = q.options.map(cleanOptionText).filter(Boolean);
        } else if (q.options && typeof q.options === 'object') {
          optionsList = Object.values(q.options).map(cleanOptionText).filter(Boolean);
        }

        let rawCorrect = cleanOptionText(q.correctAnswer || '');
        const letterIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(rawCorrect.toUpperCase());
        const numIndex = ['1', '2', '3', '4', '5'].indexOf(rawCorrect);

        let resolvedCorrect = '';
        if (letterIndex !== -1 && optionsList[letterIndex]) {
          resolvedCorrect = optionsList[letterIndex];
        } else if (numIndex !== -1 && optionsList[numIndex]) {
          resolvedCorrect = optionsList[numIndex];
        } else {
          const matched = optionsList.find(opt => opt.toLowerCase() === rawCorrect.toLowerCase());
          if (matched) resolvedCorrect = matched;
        }

        const defaultFillers = [
          "None of the above",
          "Cannot be determined from the given data",
          "Both (b) and (c)",
          "Data inadequate"
        ];
        let fillerIdx = 0;
        while (optionsList.length < 5) {
          const candidate = defaultFillers[fillerIdx++] || `Option ${optionsList.length + 1}`;
          if (!optionsList.includes(candidate)) {
            optionsList.push(candidate);
          }
        }
        if (optionsList.length > 5) {
          if (resolvedCorrect && optionsList.indexOf(resolvedCorrect) >= 5) {
            optionsList[4] = resolvedCorrect;
          }
          optionsList = optionsList.slice(0, 5);
        }

        if (!resolvedCorrect || !optionsList.includes(resolvedCorrect)) {
          resolvedCorrect = optionsList[0];
        }

        const fallbackTopic = q.topic || config.targetTopic || (sourceTag === 'Dynamic'
          ? (config.secondaryMcqLabel || 'Applied Analytical Problems')
          : (config.primaryMcqLabel || 'Core Syllabus Principles'));

        let fallbackExplanation = q.explanation;
        if (!fallbackExplanation) {
          if (subjectSlug === 'reasoning') {
            fallbackExplanation = 'Evaluate the logical arrangement constraints, conditions, and deductions step-by-step to arrive at the solution.';
          } else if (subjectSlug === 'quant') {
            fallbackExplanation = 'Apply mathematical formulas, arithmetic relations, or data interpretation steps to calculate the exact solution.';
          } else if (subjectSlug === 'english') {
            fallbackExplanation = 'Analyze grammatical structure, syntactic rules, or contextual reading inferences.';
          } else {
            fallbackExplanation = 'Refer to the statutory RBI circulars, Master Directions, and core literature for this question.';
          }
        }

        const rawMarks = Number(q.maxMarks);
        let resolvedMcqMarks = (rawMarks === 2 || (typeof config.mcqTwoMarkCount === 'number' && config.mcqTwoMarkCount > 0 && config.mcqOneMarkCount === 0)) ? 2 : 1;
        if (typeof config.mcqOneMarkCount === 'number' && typeof config.mcqTwoMarkCount === 'number') {
          resolvedMcqMarks = index < config.mcqOneMarkCount ? 1 : 2;
        }

        const normalizedInlineDi = !diMeta && q.diGroup ? normalizeDiGroup(q.diGroup, index) : null;

        const out: Record<string, any> = {
          id: q.id || `q_mcq_${index + 1}`,
          type: 'MCQ' as const,
          sourceTag,
          isPyq: Boolean(q.isPyq),
          pyqYear: q.pyqYear || (q.isPyq ? 'RBI Grade B' : undefined),
          topic: fallbackTopic,
          difficulty: q.difficulty || config.difficulty || 'Hard',
          text,
          options: optionsList,
          correctAnswer: resolvedCorrect,
          explanation: fallbackExplanation,
          maxMarks: resolvedMcqMarks
        };
        if (diMeta?.diGroup) {
          out.diGroup = diMeta.diGroup;
          out.diSetIndex = diMeta.diSetIndex;
          out.diSetTotal = diMeta.diSetTotal;
        } else if (normalizedInlineDi) {
          out.diGroup = normalizedInlineDi;
          if (typeof q.diSetIndex === 'number') out.diSetIndex = q.diSetIndex;
          if (typeof q.diSetTotal === 'number') out.diSetTotal = q.diSetTotal;
        }
        return out;
      } else {
        const maxMarks = typeof q.maxMarks === 'number' && q.maxMarks > 0 ? q.maxMarks : 15;
        const wordLimit = typeof q.wordLimit === 'number' && q.wordLimit > 0 ? q.wordLimit : (maxMarks === 10 ? 400 : maxMarks === 30 ? 170 : maxMarks === 40 ? 400 : 600);

        let markingScheme = q.markingScheme;
        if (!markingScheme || typeof markingScheme !== 'object' || Object.keys(markingScheme).length === 0) {
          const split = Number((maxMarks / 4).toFixed(1));
          markingScheme = {
            "Conceptual Grounding & Definition": split,
            "Analytical Depth & Banking Impact": split,
            "Regulatory & Policy Grounding": split,
            "Structure & Pragmatic Roadmap": Number((maxMarks - (split * 3)).toFixed(1))
          };
        }

        return {
          id: q.id || `q_desc_${index + 1}`,
          type: 'Descriptive' as const,
          sourceTag,
          isPyq: Boolean(q.isPyq),
          pyqYear: q.pyqYear || (q.isPyq ? 'RBI Grade B' : undefined),
          topic: q.topic || config.targetTopic || (sourceTag === 'Dynamic' ? 'Macroeconomic Policy & Structural Reforms' : 'Monetary Policy & Financial Architecture'),
          difficulty: q.difficulty || config.difficulty || 'Hard',
          text,
          maxMarks,
          wordLimit,
          markingScheme,
          modelAnswer: q.modelAnswer || 'Comprehensive model answer addressing structural impacts, regulatory guardrails, and implementation roadmap.'
        };
      }
    };

    const rawStandalone = Array.isArray(parsed.questions) ? parsed.questions : [];
    const rawDiSets = Array.isArray(parsed.diSets) ? parsed.diSets : [];

    const normalizedQuestions: any[] = [];
    let runningIndex = 0;

    // 1. Normalize standalone questions first (Static/Arithmetic/Algebra/Descriptive)
    rawStandalone.forEach((q: any) => {
      normalizedQuestions.push(normalizeSingleQuestion(q, runningIndex++));
    });

    // 2. Flatten each DI set cleanly, attaching shared visual diGroup + 1..N index
    rawDiSets.forEach((rawSet: any, setIdx: number) => {
      const diGroup = normalizeDiGroup(rawSet, setIdx);
      const setQuestions = Array.isArray(rawSet?.questions) ? rawSet.questions : [];
      const setTotal = setQuestions.length || 5;
      setQuestions.forEach((sq: any, qInSetIdx: number) => {
        normalizedQuestions.push(
          normalizeSingleQuestion(sq, runningIndex++, {
            diGroup,
            diSetIndex: qInSetIdx + 1,
            diSetTotal: setTotal,
            forceSourceTag: (config?.mcqDynamic || 0) > 0 ? 'Dynamic' : undefined
          })
        );
      });
    });

    res.json({ questions: normalizedQuestions });
  } catch (error) {
    console.error("Generate questions error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/evaluate-descriptive', async (req, res) => {
  try {
    const { question, userAnswer } = req.body;
    
    const maxMarks = typeof question.maxMarks === 'number' && question.maxMarks > 0 ? question.maxMarks : 15;
    const wordLimit = question.wordLimit || (maxMarks === 10 ? 400 : 600);

    // Determine target dimension keys and max values from question.markingScheme if present
    const defaultScheme = maxMarks === 10 
      ? { "Content Coverage": 4, "Structure": 3, "Language": 3 }
      : { "Content Coverage": 6, "Analytical Depth": 4, "Structure": 3, "Language": 2 };
    
    const effectiveScheme = (question.markingScheme && typeof question.markingScheme === 'object' && Object.keys(question.markingScheme).length > 0)
      ? question.markingScheme
      : defaultScheme;

    const isEnglishWriting = question?.subjectSlug === 'english-writing' || question?.sectionId === 'sub_english_writing' || maxMarks >= 30;

    const evaluatorPersona = isEnglishWriting
      ? `You are the Chief Examiner for RBI Grade B Phase II Paper II (English Writing Skills — Essay, Précis Writing & Reading Comprehension).
Evaluate the candidate's written submission on editorial coherence, formal register, structural flow, grammatical accuracy, paraphrasing originality, and strict word-count discipline (~400w for Essay, ~170w for Précis with title, concise answers for RC). Do NOT penalize an English Précis or RC for omitting RBI statutory sections unless relevant to the source text.`
      : `You are the Chief Examiner and Senior Evaluator for the Reserve Bank of India (RBI) Grade B (Phase II) Examination for Economic & Social Issues (ESI) and Finance & Management (FM).
Evaluate the candidate's descriptive answer with the highest standards of central banking rigor, analytical depth, statutory grounding, and institutional accuracy.

EXAMINATION BENCHMARK & RIGOR (RBI GRADE B & BEYOND):
1. Scoring Philosophy:
   - RBI Grade B is an elite, highly selective examination. Do not give inflated marks.
   - An answer that merely regurgitates high-school definitions or vague generic points without statutory references (e.g., RBI Act 1934, Banking Regulation Act 1949, FEMA, IBC, Basel III) or concrete monetary mechanics must score low (20-40% of max marks).
   - An average answer that lists basic textbook points but lacks real-world banking context, transmission channels, or recent RBI circulars/committees receives 45-55% marks.
   - A strong answer demonstrating multi-dimensional analysis (statutory authority, balance sheet impact, transmission channels, trade-offs, and systemic implications) receives 60-75% marks.
   - 75%+ marks are strictly reserved for answers that match or exceed topper quality with precise regulatory grounding, empirical awareness, and a structured policy way forward.`;

    const prompt = `${evaluatorPersona}

Dimensions & Marking Scheme:
   You MUST evaluate the answer against these exact criteria and maximum marks:
   ${JSON.stringify(effectiveScheme, null, 2)}
   Ensure each criterion's score in "scoreBreakdown" is realistic and does NOT exceed its allocated maximum marks. The sum of these dimension scores must equal "totalScore".

Word Count & Completeness Discipline:
   - Target word limit is ${wordLimit} words.
   - Evaluate whether all sub-parts and core analytical demands of the question are addressed. Penalize omitted dimensions or severe brevity.

Question:
"${question.text}"

Candidate's Submitted Answer:
"""
${userAnswer}
"""

Benchmark Model Answer for Reference:
"""
${question.modelAnswer || "Comprehensive model answer with definitions, statutory sections, transmission channels, banking impacts, and forward-looking policy outlook."}
"""

Output valid JSON matching this exact schema:
{
  "totalScore": 7.5, // Number out of ${maxMarks} (sum of criteria scores)
  "evaluationSummary": "Concise 2-3 sentence executive summary assessing the answer against RBI Grade B Phase II standards.",
  "scoreBreakdown": ${JSON.stringify(Object.fromEntries(Object.entries(effectiveScheme).map(([k, v]) => [k, Number(((v as number) * 0.7).toFixed(1))])))} ,
  "keyStrengths": [
    "Identified key concepts and definitions accurately",
    "Grounded discussion in appropriate central banking context"
  ],
  "criticalGaps": [
    "Specific statutory section, circular, or transmission channel omitted",
    "Unaddressed systemic risk or policy trade-off"
  ],
  "topperInsights": [
    "High-yield RBI committee report or policy document to cite (e.g. FSR, Annual Report, Currency & Finance Report)",
    "Empirical banking metric or international regulatory benchmark (e.g. BIS/Basel III)"
  ],
  "feedbackPoints": [
    "Content coverage assessment: Detail on statutory grounding (e.g. Sections of BR Act 1949 / RBI Act 1934), policy context, and completeness.",
    "Structure assessment: Observations on logical flow, headings, comparative tables vs. analytical paragraphs, and word limit discipline.",
    "Language & terminology assessment: Precision in using technical central banking terms (e.g. NDTL, monetary transmission, LAF corridor, asset-liability matching)."
  ],
  "suggestions": [
    "Actionable recommendation to elevate the answer to RBI Grade B topper level (e.g. incorporating specific transmission channels or committee recommendations).",
    "Structural or presentation enhancement for high-scoring impact in Phase II."
  ]
}`;

    const rawJson = await callGeminiWithRetry(prompt);
    const raw = safeJsonParse(rawJson);

    const totalScore = typeof raw.totalScore === 'number' && !isNaN(raw.totalScore)
      ? Math.max(0, Math.min(maxMarks, Number(raw.totalScore.toFixed(2))))
      : 0;

    const scoreBreakdown: Record<string, number> = {};
    if (raw.scoreBreakdown && typeof raw.scoreBreakdown === 'object') {
      for (const [key, maxVal] of Object.entries(effectiveScheme)) {
        const val = raw.scoreBreakdown[key];
        const numVal = typeof val === 'number' && !isNaN(val) ? val : Number(val);
        const maxNum = typeof maxVal === 'number' ? maxVal : Number(maxVal) || 1;
        scoreBreakdown[key] = !isNaN(numVal) ? Math.max(0, Math.min(maxNum, Number(numVal.toFixed(1)))) : Number((maxNum * 0.5).toFixed(1));
      }
    } else {
      for (const [key, maxVal] of Object.entries(effectiveScheme)) {
        const maxNum = typeof maxVal === 'number' ? maxVal : Number(maxVal) || 1;
        scoreBreakdown[key] = Number((maxNum * (totalScore / maxMarks)).toFixed(1));
      }
    }

    const evaluationSummary = raw.evaluationSummary || 
      `The answer was evaluated against RBI Grade B Phase II standards, scoring ${totalScore} out of ${maxMarks} marks.`;

    const keyStrengths = Array.isArray(raw.keyStrengths) && raw.keyStrengths.length > 0
      ? raw.keyStrengths.map((s: any) => String(s))
      : ["Identified the core conceptual definition outlined in the question."];

    const criticalGaps = Array.isArray(raw.criticalGaps) && raw.criticalGaps.length > 0
      ? raw.criticalGaps.map((g: any) => String(g))
      : ["Deepen discussion on regulatory circulars, systemic risks, and specific transmission mechanisms."];

    const topperInsights = Array.isArray(raw.topperInsights) && raw.topperInsights.length > 0
      ? raw.topperInsights.map((t: any) => String(t))
      : ["Incorporate relevant RBI committee reports and international central banking benchmarks (e.g., BIS)."];

    const feedbackPoints = Array.isArray(raw.feedbackPoints) && raw.feedbackPoints.length > 0
      ? raw.feedbackPoints.map((p: any) => String(p))
      : [
          "Content coverage addresses core definitions but requires deeper statutory and regulatory grounding.",
          "Structure is logically sound; balance descriptive analysis with concise tabular comparisons to optimize word count.",
          "Language is professional; deepen the usage of precise central banking terminology."
        ];

    const suggestions = Array.isArray(raw.suggestions) && raw.suggestions.length > 0
      ? raw.suggestions.map((s: any) => String(s))
      : [
          "Incorporate a deeper analysis of monetary policy transmission channels (interest rate and credit channels) affecting bank balance sheets.",
          "Ground arguments with citations from recent RBI circulars or Financial Stability Reports (FSR) for topper-tier marks."
        ];

    res.json({
      totalScore,
      evaluationSummary,
      scoreBreakdown,
      keyStrengths,
      criticalGaps,
      topperInsights,
      feedbackPoints,
      suggestions
    });
  } catch (error) {
    console.error("Evaluate descriptive error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/generate-overall-feedback', async (req, res) => {
  try {
    const { test } = req.body;
    
    // Create a compact summarized version of the test to fit context window efficiently
    const sectionMap: Record<string, { name: string; mcqs: number; mcqCorrect: number; descCount: number }> = {};
    (test.questions || []).forEach((q: any) => {
      const sec = q.sectionName || test.subjectName || 'General';
      if (!sectionMap[sec]) sectionMap[sec] = { name: sec, mcqs: 0, mcqCorrect: 0, descCount: 0 };
      if (q.type === 'MCQ') {
        sectionMap[sec].mcqs += 1;
        if (q.isCorrect || q.userAnswer === q.correctAnswer) sectionMap[sec].mcqCorrect += 1;
      } else {
        sectionMap[sec].descCount += 1;
      }
    });

    const summary = {
      examTitle: test.subjectName || 'RBI Grade B Mock',
      isFullPhaseExam: Boolean(test.isFullPhaseExam),
      phaseExamType: test.phaseExamType || null,
      sectionBreakdown: Object.values(sectionMap),
      staticMcqCorrect: (test.questions || []).filter((q: any) => q.type === 'MCQ' && q.sourceTag === 'Static' && (q.isCorrect || q.userAnswer === q.correctAnswer)).length,
      staticMcqTotal: (test.questions || []).filter((q: any) => q.type === 'MCQ' && q.sourceTag === 'Static').length,
      dynamicMcqCorrect: (test.questions || []).filter((q: any) => q.type === 'MCQ' && q.sourceTag === 'Dynamic' && (q.isCorrect || q.userAnswer === q.correctAnswer)).length,
      dynamicMcqTotal: (test.questions || []).filter((q: any) => q.type === 'MCQ' && q.sourceTag === 'Dynamic').length,
      descriptiveEvaluations: (test.questions || []).filter((q: any) => q.type === 'Descriptive').map((q: any) => {
        const qId = q.id || test.questions.indexOf(q).toString();
        const evalData = test.evaluations?.[qId];
        return {
          sectionName: q.sectionName || q.topic,
          sourceTag: q.sourceTag,
          score: evalData?.totalScore,
          maxMarks: q.maxMarks,
          feedback: evalData?.feedbackPoints?.join(' '),
          suggestions: evalData?.suggestions?.join(' ')
        };
      })
    };

    const prompt = `You are a senior RBI Grade B exam coach. 
Based on the student's mock exam performance summary below, provide an overall feedback report.
Focus on identifying clear patterns across sections/papers, Static vs Dynamic performance, and descriptive execution.

Performance Summary:
${JSON.stringify(summary, null, 2)}

Output strict JSON schema:
{
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "nextSteps": ["Actionable step 1", "Actionable step 2", "Actionable step 3"]
}`;

    const rawJson = await callGeminiWithRetry(prompt);
    const raw = safeJsonParse(rawJson);
    const strengths = Array.isArray(raw.strengths) && raw.strengths.length > 0
      ? raw.strengths.map((s: any) => String(s))
      : ["Completed timed exam attempt across question sections."];
    const weaknesses = Array.isArray(raw.weaknesses) && raw.weaknesses.length > 0
      ? raw.weaknesses.map((w: any) => String(w))
      : ["Review questions where marks were lost and practice speed."];
    const nextSteps = Array.isArray(raw.nextSteps) && raw.nextSteps.length > 0
      ? raw.nextSteps.map((n: any) => String(n))
      : ["Revise topic notes thoroughly and practice more mock exams."];

    res.json({
      strengths,
      weaknesses,
      nextSteps
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: String(error) });
  }
});

// Memory storage for small chunks
const chunkUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB chunks
});

const activeUploads = new Map<string, string>();

app.post('/api/upload-chunk', chunkUpload.single('chunk'), async (req: any, res) => {
  try {
    const { uploadId, fileName } = req.body;
    if (!uploadId || !req.file) {
      return res.status(400).json({ error: 'Missing uploadId or chunk data' });
    }

    let tmpPath = activeUploads.get(uploadId);
    if (!tmpPath) {
      tmpPath = path.join(os.tmpdir(), `upload-${uploadId}-${fileName || 'file'}`);
      activeUploads.set(uploadId, tmpPath);
      // Create empty file
      await fs.promises.writeFile(tmpPath, '');
    }

    // Append chunk to the file on disk
    await fs.promises.appendFile(tmpPath, req.file.buffer);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Chunk upload error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/extract-text', async (req, res) => {
  try {
    let { uploadId, mimeType } = req.body;
    
    if (!uploadId) {
      return res.status(400).json({ error: 'No uploadId provided' });
    }

    const tmpFilePath = activeUploads.get(uploadId);
    if (!tmpFilePath || !fs.existsSync(tmpFilePath)) {
      return res.status(404).json({ error: 'Upload not found or incomplete' });
    }

    // Normalize mimeType for images, docs, txt
    if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (tmpFilePath.endsWith('.png')) mimeType = 'image/png';
      else if (tmpFilePath.endsWith('.jpg') || tmpFilePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (tmpFilePath.endsWith('.webp')) mimeType = 'image/webp';
      else if (tmpFilePath.endsWith('.txt') || tmpFilePath.endsWith('.md')) mimeType = 'text/plain';
      else mimeType = 'application/pdf';
    }

    // Use streaming NDJSON to prevent Nginx proxy timeouts for long-running extractions
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.write(JSON.stringify({ status: 'Uploading file to AI engine...' }) + '\n');

    const genai = getGenAI();
    let uploadResponse;
    try {
      uploadResponse = await genai.files.upload({
        file: tmpFilePath,
        config: { mimeType }
      });
    } finally {
      // Clean up local temp file
      activeUploads.delete(uploadId);
      await fs.promises.unlink(tmpFilePath).catch(e => console.error("Failed to delete tmp file:", e));
    }
    
    res.write(JSON.stringify({ status: 'Processing document & performing OCR...' }) + '\n');

    let fileState = await genai.files.get({ name: uploadResponse.name });
    while (fileState.state === 'PROCESSING') {
      await new Promise(r => setTimeout(r, 2000));
      res.write(JSON.stringify({ status: 'Processing document & performing OCR...' }) + '\n');
      fileState = await genai.files.get({ name: uploadResponse.name });
    }

    if (fileState.state === 'FAILED') {
      throw new Error("Document processing failed on AI server.");
    }
    
    res.write(JSON.stringify({ status: 'Extracting curriculum notes & text...' }) + '\n');

    const prompt = `Please extract all the readable text, handwritten or typed notes, tables, circular references, and key study topics from this image/document accurately. Preserve headings and paragraph structure clearly.`;
    
    const responseStream = await genai.models.generateContentStream({
      model: 'gemini-3.1-flash-lite',
      contents: {
        role: 'user',
        parts: [
          { fileData: { fileUri: uploadResponse.uri, mimeType: uploadResponse.mimeType } },
          { text: prompt }
        ]
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(JSON.stringify({ textChunk: chunk.text }) + '\n');
      }
    }

    res.write(JSON.stringify({ done: true }) + '\n');
    res.end();
  } catch (error) {
    console.error("Extraction error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: String(error) });
    } else {
      res.write(JSON.stringify({ error: String(error) }) + '\n');
      res.end();
    }
  }
});

// Multimodal Flashcards Generation (PDF, PNG, JPG, WebP, GIF, Text/Markdown + optional extra notes)
const flashcardUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 8
  }
});

function inferFlashcardMimeType(file: Express.Multer.File): string {
  let mime = (file.mimetype || '').toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (mime && mime !== 'application/octet-stream') return mime;

  const lower = (file.originalname || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  return 'application/pdf';
}

app.post('/api/generate-flashcards', flashcardUpload.array('files', 8), async (req: any, res) => {
  const tempFilesToClean: string[] = [];
  try {
    const files: Express.Multer.File[] = Array.isArray(req.files) ? req.files : [];
    const subjectName = String(req.body.subjectName || 'RBI Grade B General').trim().slice(0, 140);
    const subjectSlug = String(req.body.subjectSlug || 'general-awareness').trim().slice(0, 80);
    const topicHint = String(req.body.topic || '').trim().slice(0, 200);
    const extraNotesText = String(req.body.extraNotesText || '').trim().slice(0, 35000);
    const requestedCount = Math.min(24, Math.max(6, parseInt(String(req.body.cardCount || '12'), 10) || 12));
    const difficulty = ['Easy', 'Moderate', 'Hard'].includes(String(req.body.difficulty))
      ? String(req.body.difficulty)
      : 'Moderate';

    if (files.length === 0 && extraNotesText.length < 20) {
      return res.status(400).json({
        error: 'Please upload at least one PDF or image note (PNG, JPG, WebP, GIF) or paste study notes.'
      });
    }

    const genai = getGenAI();
    const parts: any[] = [];
    const textChunks: string[] = [];
    if (extraNotesText) {
      textChunks.push(extraNotesText);
    }

    for (const file of files) {
      const mimeType = inferFlashcardMimeType(file);
      const isSupportedImage = mimeType.startsWith('image/');
      const isPdf = mimeType === 'application/pdf';
      const isText = mimeType.startsWith('text/');

      if (isText) {
        const decoded = file.buffer.toString('utf-8').trim();
        if (decoded) {
          textChunks.push(`[File: ${file.originalname}]\n${decoded.slice(0, 20000)}`);
        }
        continue;
      }

      if (!isSupportedImage && !isPdf) {
        return res.status(400).json({
          error: `Unsupported file format for "${file.originalname}". Upload PDF, PNG, JPG, WebP, GIF, or TXT notes.`
        });
      }

      // Use Gemini File API for large PDFs (>12MB); inlineData for fast image & standard PDF analysis
      if (isPdf && file.size > 12 * 1024 * 1024) {
        const safeName = (file.originalname || 'notes.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
        const tmpPath = path.join(os.tmpdir(), `fc-${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);
        await fs.promises.writeFile(tmpPath, file.buffer);
        tempFilesToClean.push(tmpPath);

        const uploaded = await genai.files.upload({
          file: tmpPath,
          config: { mimeType }
        });

        let state = await genai.files.get({ name: uploaded.name });
        let polls = 0;
        while (state.state === 'PROCESSING' && polls < 20) {
          await new Promise(r => setTimeout(r, 1500));
          state = await genai.files.get({ name: uploaded.name });
          polls++;
        }
        if (state.state === 'FAILED') {
          throw new Error(`Failed to process uploaded PDF "${file.originalname}".`);
        }
        parts.push({ fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } });
      } else {
        parts.push({
          inlineData: {
            mimeType,
            data: file.buffer.toString('base64')
          }
        });
      }
    }

    const combinedTextNotes = textChunks.join('\n\n---\n\n').slice(0, 32000);
    const prompt = `You are a Master Cognitive Scientist and RBI Grade B Active-Recall Flashcard Designer.
Analyze ALL attached study notes (PDF pages, handwritten or printed images, diagrams, tables, charts, and any supplementary text notes) thoroughly.

TARGET SUBJECT: ${subjectName} (${subjectSlug})
${topicHint ? `FOCUS TOPIC / CHAPTER: ${topicHint}` : 'DETECT THE PRIMARY TOPIC FROM THE UPLOADED NOTES.'}
TARGET CARD COUNT: Generate EXACTLY ${requestedCount} high-yield active-recall flashcards.
TARGET DIFFICULTY CALIBRATION: ${difficulty}

${combinedTextNotes ? `ADDITIONAL STUDY NOTES TEXT:\n"""\n${combinedTextNotes}\n"""\n` : ''}

DESIGN MANDATES FOR ELITE ACTIVE-RECALL FLASHCARDS:
1. GROUNDED IN UPLOADED NOTES: Every single flashcard MUST directly test concepts, statutory sections, numerical thresholds, formulas, diagrams, tables, dates, committees, or definitions actually present in the uploaded notes/images/PDFs. Do not hallucinate unrelated trivia.
2. ATOMIC & TESTABLE:
   - "front": Sharp, unambiguous active-recall prompt (1–3 sentences max). Use varied recall formats: direct concept probes, "Compare X vs Y", formula/threshold checks, "What happens when...", statutory clause checks, or short scenario applications.
   - "back": Crisp, structured, exam-ready answer (concise bullet-style or 2–4 clean lines with exact numbers, statutory sections, or formula steps).
3. COGNITIVE SCAFFOLDING:
   - "hint": Subtle 1-line nudge that helps recall without giving away the answer.
   - "mnemonic": Optional short memory hook / acronym / formula anchor when helpful (or empty string "" if not needed).
   - "conceptTag": Short 2–4 word sub-topic tag (e.g. "Basel III CCB", "Monetary Transmission", "Section 45ZB").
   - "difficulty": "Easy" | "Moderate" | "Hard" (calibrated around ${difficulty}).
   - "sourceExcerpt": Short 8–18 word reference phrase from the uploaded notes showing where this concept came from.
4. ZERO DUPLICATES: Cover the breadth of the uploaded notes evenly from start to finish.

Return STRICT JSON matching this exact schema:
{
  "title": "Crisp 4-8 word deck title summarizing these notes",
  "topic": "Primary chapter or topic name",
  "cards": [
    {
      "id": "fc_1",
      "front": "Clear active-recall question or prompt",
      "back": "Concise, high-precision answer with exact facts/formulas",
      "hint": "Subtle retrieval cue",
      "mnemonic": "Short memory anchor or empty string",
      "conceptTag": "Short Concept Tag",
      "difficulty": "${difficulty}",
      "sourceExcerpt": "Short reference snippet from uploaded notes"
    }
  ]
}`;

    parts.push({ text: prompt });

    const models = ['gemini-4-hydrogen', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
    let rawJson = '';
    let lastError: any = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await genai.models.generateContent({
            model,
            contents: { role: 'user', parts },
            config: {
              responseMimeType: 'application/json'
            }
          });
          if (response.text && response.text.trim()) {
            rawJson = response.text;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Flashcards attempt ${attempt + 1} with ${model} failed:`, err?.message || err);
          await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
        }
      }
      if (rawJson) break;
    }

    if (!rawJson) {
      throw lastError || new Error('Unable to synthesize flashcards from the uploaded notes.');
    }

    const parsed = safeJsonParse(rawJson);
    const rawCards = Array.isArray(parsed?.cards) ? parsed.cards : [];

    const normalizedCards = rawCards
      .filter((c: any) => c && String(c.front || '').trim() && String(c.back || '').trim())
      .slice(0, 40)
      .map((c: any, idx: number) => {
        const diffVal = String(c.difficulty || difficulty);
        const safeDiff: 'Easy' | 'Moderate' | 'Hard' =
          diffVal === 'Easy' || diffVal === 'Moderate' || diffVal === 'Hard'
            ? diffVal
            : (difficulty as 'Easy' | 'Moderate' | 'Hard');

        return {
          id: `fc_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
          front: String(c.front).trim().slice(0, 600),
          back: String(c.back).trim().slice(0, 1200),
          hint: String(c.hint || '').trim().slice(0, 260) || undefined,
          mnemonic: String(c.mnemonic || '').trim().slice(0, 260) || undefined,
          conceptTag: String(c.conceptTag || topicHint || subjectName).trim().slice(0, 80),
          difficulty: safeDiff,
          sourceExcerpt: String(c.sourceExcerpt || '').trim().slice(0, 220) || undefined
        };
      });

    if (normalizedCards.length === 0) {
      return res.status(422).json({
        error: 'Could not extract readable study concepts from those files. Try clearer note images or a text-readable PDF.'
      });
    }

    const fallbackTitle = topicHint
      ? `${subjectName}: ${topicHint}`
      : files[0]?.originalname
        ? files[0].originalname.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ')
        : `${subjectName} Active Recall Deck`;

    res.json({
      title: String(parsed?.title || fallbackTitle).trim().slice(0, 180),
      topic: String(parsed?.topic || topicHint || subjectName).trim().slice(0, 160),
      cards: normalizedCards
    });
  } catch (error: any) {
    console.error('Generate flashcards error:', error);
    res.status(500).json({ error: error?.message || String(error) });
  } finally {
    for (const tmpPath of tempFilesToClean) {
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  }
});

// Serve frontend
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In dev, we need Vite integration
    const { createServer: createVite } = await import('vite');
    const vite = await createVite({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
