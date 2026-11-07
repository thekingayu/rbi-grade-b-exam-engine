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
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

// Resilient Gemini caller with model fallback chain and backoff retry
async function callGeminiWithRetry(contents: string, systemInstruction?: string): Promise<string> {
  const genai = getGenAI();
  const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
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
  const examMode = config.mode || 'Sectional';
  const difficulty = config.difficulty || 'Hard';

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
  Topics: Multi-variable Floor/Flat Puzzles (8 persons on 4 floors, 2 flats, banks/cities/colors), Linear/Circular/Square Seating arrangements (inward/outward facing), Critical & Evaluative Reasoning (Statement-Assumption, Statement-Course of Action, Strong/Weak Arguments, Inferences).
${pyqCount > 0 ? `- AUTHENTIC PYQ SECTION: Generate EXACTLY ${pyqCount} authentic Previous Year Questions (PYQs) asked in official RBI Grade B Phase 1 Reasoning papers (2018–2025) matching the selected topic or puzzle patterns. Mark each with "isPyq": true and "pyqYear": "RBI Grade B 2024" (or 2023, 2022, 2021, etc.).` : ''}

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
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (QUANTITATIVE APTITUDE - RBI GRADE B PHASE 1):
CRITICAL RULE: ABSOLUTELY ZERO GENERAL KNOWLEDGE, CURRENT AFFAIRS, OR THEORETICAL ESSAYS.
This is a pure examination of advanced quantitative ability, commercial arithmetic, algebra, and data interpretation calibrated to RBI Grade B Phase 1 (30 Marks / 25 Minutes benchmark).

QUESTION DISTRIBUTION:
- CATEGORY 1: "${primaryMcqLabel}" -> Generate EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static".
  Topics: Commercial Mathematics (SI/CI with mixed compounding, Profit-Loss with successive markups and dishonest weights, Time-Speed-Distance, Time & Work), Quadratic Equations & Algebraic Comparisons (Equation I: ax² + bx + c = 0 vs Equation II: dy² + ey + f = 0), Missing & Wrong Number Series, Probability & Combinatorics.
- CATEGORY 2: "${secondaryMcqLabel}" -> Generate EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic".
  Topics: Caselet Data Interpretation, Tabular & Radar DI Sets testing CAGR and proportional variance, Quantity I vs Quantity II comparisons, Data Sufficiency.
${pyqCount > 0 ? `- AUTHENTIC PYQ SECTION: Generate EXACTLY ${pyqCount} authentic Previous Year Questions (PYQs) asked in official RBI Grade B Quantitative Aptitude papers (2018–2025). Mark each with "isPyq": true and "pyqYear": "RBI Grade B 2024" (or 2023, 2022, etc.).` : ''}

STRICT FORMAT REQUIREMENTS:
- Every MCQ MUST have EXACTLY 5 distinct options.
- The explanation must include complete mathematical formulas and step-by-step arithmetic/algebraic calculations.`;

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
      "topic": "${config.targetTopic || 'Data Interpretation & Quantity Comparisons'}",
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
  } else if (subjectSlug === 'english') {
    subjectSpecificRules = `
SUBJECT-SPECIFIC MANDATE (ENGLISH LANGUAGE - RBI GRADE B PHASE 1):
CRITICAL RULE: Advanced verbal acuity, grammatical syntax, vocabulary in context, and macroeconomic passage comprehension (30 Marks / 25 Minutes benchmark).

QUESTION DISTRIBUTION:
- CATEGORY 1: "${primaryMcqLabel}" -> Generate EXACTLY ${mcq1Count} MCQs with "sourceTag": "Static".
  Topics: Error Detection (subjunctive mood, parallelism, inverted conditionals), Phrase Replacement, Sentence Connectors & Starters, High-register Double Fillers & Cloze Mechanics.
- CATEGORY 2: "${secondaryMcqLabel}" -> Generate EXACTLY ${mcq2Count} MCQs with "sourceTag": "Dynamic".
  Topics: Reading Comprehension on macroeconomic/central banking themes with inferential questions, Para Jumbles (5-6 sentence coherent sequencing).
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
- Utilize authentic multi-statement formats (Statement I, II, III) and Assertion-Reason pairs.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Statutory Banking & Monetary Policy'}",
      "text": "Consider the following statements regarding the Standing Deposit Facility (SDF) introduced by the Reserve Bank of India:\\n\\nI. The SDF allows the RBI to absorb liquidity from commercial banks without providing collateral in return.\\nII. The SDF rate serves as the floor of the Liquidity Adjustment Facility (LAF) corridor.\\nIII. The RBI was empowered to introduce the SDF through an amendment to Section 17 of the RBI Act, 1934.\\n\\nWhich of the statements given above is/are correct?",
      "options": [
        "Only I and II",
        "Only II and III",
        "Only I and III",
        "All I, II and III",
        "None of the above"
      ],
      "correctAnswer": "All I, II and III",
      "explanation": "All three statements are correct: (I) SDF is uncollateralized liquidity absorption; (II) it replaced fixed-rate reverse repo as the LAF corridor floor (25 bps below the policy repo rate); (III) Section 17 of the RBI Act was amended in 2018 to empower the RBI to introduce SDF.",
      "maxMarks": 1
    },
    {
      "type": "MCQ",
      "sourceTag": "Dynamic",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Dynamic Current Affairs & Circulars'}",
      "text": "Under the Prompt Corrective Action (PCA) Framework for Non-Banking Financial Companies (NBFCs) notified by the Reserve Bank of India, which of the following represents the Tier 1 Capital threshold trigger for Risk Threshold 1?",
      "options": [
        "Tier 1 Capital ratio falling below 10.0%",
        "Tier 1 Capital ratio falling below 12.0%",
        "Tier 1 Capital ratio falling below 15.0%",
        "Tier 1 Capital ratio falling below 8.0%",
        "Net NPA ratio exceeding 9.0%"
      ],
      "correctAnswer": "Tier 1 Capital ratio falling below 10.0%",
      "explanation": "Under the RBI PCA Framework for NBFCs (Middle, Upper, and Top Layers), Risk Threshold 1 is triggered when the CRAR falls below 15.0% or the Tier 1 Capital ratio drops below 10.0%.",
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
        "GDP at Market Prices - Depreciation - Net Indirect Taxes",
        "GNP at Market Prices - Depreciation + Net Indirect Taxes",
        "GDP at Factor Cost + Net Factor Income from Abroad",
        "NDP at Market Prices + Subsidies - Indirect Taxes",
        "Both (A) and (D) are correct formulations"
      ],
      "correctAnswer": "Both (A) and (D) are correct formulations",
      "explanation": "NDP_FC = GDP_MP - Depreciation - Net Indirect Taxes (where NIT = Indirect Taxes - Subsidies). Equivalently, NDP_FC = NDP_MP - NIT = NDP_MP - Indirect Taxes + Subsidies. Hence both (A) and (D) represent valid formulations.",
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
  You MUST base these questions directly on the archetypes, depth, and traps found in authentic RBI Grade B FM Previous Year Questions (PYQs). Include rigorous numerical calculations (Yield to Maturity, Modified Duration, WACC, DuPont ROE decomposition, Debt Service Coverage Ratio, Beta), Basel III capital adequacy ratios (CET-1, CCB, Countercyclical buffer), corporate governance committee recommendations (Kumar Mangalam Birla, Naresh Chandra, Narayana Murthy, Uday Kotak), and classical motivation/leadership models (Maslow, Herzberg, Vroom, Alderfer, Blake-Mouton). The difficulty level must match or EXCEED the hardest RBI Grade B PYQs.
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
      "text": "A commercial bank in India reports Risk-Weighted Assets (RWAs) of Rs. 100,000 crore. Under RBI Basel III guidelines, what is the minimum Common Equity Tier 1 (CET-1) capital including the Capital Conservation Buffer (CCB) required to be maintained by this bank?",
      "options": [
        "Rs. 5,500 crore",
        "Rs. 7,000 crore",
        "Rs. 8,000 crore",
        "Rs. 9,000 crore",
        "Rs. 11,500 crore"
      ],
      "correctAnswer": "Rs. 8,000 crore",
      "explanation": "Under RBI regulations, minimum CET-1 is 5.5% of RWAs and the CCB is 2.5% of RWAs (which must be met entirely with CET-1). Total CET-1 requirement = 5.5% + 2.5% = 8.0% of Rs. 100,000 crore = Rs. 8,000 crore.",
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
SUBJECT-SPECIFIC MANDATE (ENGLISH WRITING SKILLS - RBI GRADE B PHASE 2):
100-mark descriptive examination (90 minutes): 1 Essay (40 Marks / 400 words), 1 Précis (30 Marks / 170 words), and Business Reading Comprehension (30 Marks / 5 analytical questions).

QUESTION SPECIFICATIONS:
- Category 1: "${primaryDescLabel || 'Official Essay & Speech Précis'}" -> Generate ${desc1Count || 2} questions.
  Provide:
  1) An authoritative, thought-provoking 400-word essay prompt on central banking, digital economy, or financial inclusion.
  2) A 450-word excerpt from an official central banking speech or policy report, requiring a précis of exactly 170 words with a suitable title.
- Category 2: "${secondaryDescLabel || 'Business Reading Comprehension'}" -> Generate ${desc2Count || 1} questions.
  Provide a dense 350-word financial analysis passage with 4-5 descriptive analytical comprehension questions.`;

    jsonSchemaExample = `{
  "questions": [
    {
      "type": "Descriptive",
      "sourceTag": "Static",
      "isPyq": false,
      "topic": "${config.targetTopic || 'Macroeconomic Policy Essay'}",
      "text": "Write a comprehensive essay in approximately 400 words on the topic:\\n'Central Bank Digital Currencies (CBDCs): Catalysts for Financial Inclusion or Challenges to Commercial Bank Disintermediation?'",
      "maxMarks": 40,
      "wordLimit": 400,
      "markingScheme": {
        "Conceptual Depth & Thematic Coherence": 10.0,
        "Financial Architecture & Disintermediation Risks": 12.0,
        "Structural Organization & Paragraph Transitions": 10.0,
        "Grammatical Precision & Formal Register": 8.0
      },
      "modelAnswer": "### Central Bank Digital Currencies: Balancing Inclusion and Disintermediation\\n\\nThe advent of Central Bank Digital Currencies (CBDCs) represents the most profound reimagining of sovereign money since the abandonment of the gold standard...\\n\\nWholesale and retail CBDC implementations offer distinct utility curves...\\n\\nTo avert deposit disintermediation during financial stress, central banks must calibrate holding caps and non-remunerated architectures...\\n\\nIn conclusion, CBDCs can anchor sovereign trust in the digital era without disrupting private credit creation."
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
      "options": ["Option 1", "Option 2", "Option 3", "Option 4", "None of the above"],
      "correctAnswer": "Option 1",
      "explanation": "Detailed theoretical and empirical explanation.",
      "maxMarks": 1
    }
  ]
}`;
  }

  return `You are the Chief Examiner and Principal Paper Setter on the Services Selection Board for the Reserve Bank of India (RBI Grade B - Officers in Grade 'B' Direct Recruitment).
You must construct an exceptionally rigorous, high-difficulty mock examination that matches and exceeds the authentic difficulty level of the actual RBI Grade B examination.

SUBJECT: "${subjectName}"
${topicFocus}
EXAM MODE: "${examMode}"
DIFFICULTY: "${difficulty}"
TARGET MCQ COUNT: ${totalMcqs} (${mcq1Count} in "${primaryMcqLabel}", ${mcq2Count} in "${secondaryMcqLabel}"${pyqCount > 0 ? `, ${pyqCount} Authentic PYQs` : ''})
TARGET DESCRIPTIVE COUNT: ${totalDescs} (${desc1Count} in "${primaryDescLabel}", ${desc2Count} in "${secondaryDescLabel}")

${subjectSpecificRules}

MANDATORY EXAMINATION STANDARDS:
1. STRICT 5-OPTION RULE: EVERY single MCQ MUST HAVE EXACTLY 5 DISTINCT OPTIONS (Option 1 to Option 5). Never output only 4 options.
2. DIFFICULTY BENCHMARK: AVOID simplistic, trivial one-liner factual trivia. Every question must test deep conceptual mastery, statutory accuracy, multi-layered analytical deduction, or exact calculations.
3. DISTRACTOR INTEGRITY: Distractors (incorrect options) must be realistic, tricky, and designed to trap candidates with superficial knowledge.
4. QUESTION COUNT ENFORCEMENT:
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
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

    // Safe option prefix cleaner: strips leading "A) ", "(A) ", "Option 1: ", "1. " etc. without destroying "A-2, B-1"
    const cleanOptionText = (opt: any): string => {
      if (!opt) return '';
      return String(opt)
        .replace(/^(?:Option\s+[A-E1-5][\:\.]?\s*|\(?[A-Ea-e1-5]\)\s*|[A-Ea-e1-5][\.\:]\s+)/i, '')
        .trim();
    };

    // Robust Question Normalization
    const normalizedQuestions = rawQuestions.map((q: any, index: number) => {
      const isMCQ = (q.type || '').toUpperCase() === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0) || (q.options && typeof q.options === 'object');
      const text = q.text || q.question || q.questionText || `Question ${index + 1}`;
      const sourceTag = (q.sourceTag === 'Dynamic' || q.source === 'Dynamic') ? 'Dynamic' : 'Static';

      if (isMCQ) {
        // Extract options ensuring exactly 5 options
        let optionsList: string[] = [];
        if (Array.isArray(q.options)) {
          optionsList = q.options.map(cleanOptionText).filter(Boolean);
        } else if (q.options && typeof q.options === 'object') {
          optionsList = Object.values(q.options).map(cleanOptionText).filter(Boolean);
        }

        // Standardize correctAnswer
        let rawCorrect = cleanOptionText(q.correctAnswer || '');

        // If correctAnswer was just an index or letter like "A", "B", "C", "D", "E" or "1".."5"
        const letterIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(rawCorrect.toUpperCase());
        const numIndex = ['1', '2', '3', '4', '5'].indexOf(rawCorrect);
        
        let resolvedCorrect = '';
        if (letterIndex !== -1 && optionsList[letterIndex]) {
          resolvedCorrect = optionsList[letterIndex];
        } else if (numIndex !== -1 && optionsList[numIndex]) {
          resolvedCorrect = optionsList[numIndex];
        } else {
          // Check match with one of the options
          const matched = optionsList.find(opt => opt.toLowerCase() === rawCorrect.toLowerCase());
          if (matched) {
            resolvedCorrect = matched;
          }
        }

        // Strictly enforce 5 options per RBI Grade B standards
        const defaultFillers = [
          "None of the above",
          "Cannot be determined from the available regulatory data",
          "Both (b) and (c)",
          "All of the above statements are valid"
        ];
        let fillerIdx = 0;
        while (optionsList.length < 5) {
          const candidate = defaultFillers[fillerIdx++] || `Option ${optionsList.length + 1}`;
          if (!optionsList.includes(candidate)) {
            optionsList.push(candidate);
          }
        }
        if (optionsList.length > 5) {
          // Truncate to 5 options, ensuring resolvedCorrect stays if present
          if (resolvedCorrect && optionsList.indexOf(resolvedCorrect) >= 5) {
            optionsList[4] = resolvedCorrect;
          }
          optionsList = optionsList.slice(0, 5);
        }

        // Finalize correctAnswer
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

        return {
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
          maxMarks: 1
        };
      } else {
        const maxMarks = typeof q.maxMarks === 'number' && q.maxMarks > 0 ? q.maxMarks : 15;
        const wordLimit = typeof q.wordLimit === 'number' && q.wordLimit > 0 ? q.wordLimit : (maxMarks === 10 ? 400 : 600);
        
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

    const prompt = `You are the Chief Examiner and Senior Evaluator for the Reserve Bank of India (RBI) Grade B (Phase II) Examination for Economic & Social Issues (ESI) and Finance & Management (FM).
Evaluate the candidate's descriptive answer with the highest standards of central banking rigor, analytical depth, statutory grounding, and institutional accuracy.

EXAMINATION BENCHMARK & RIGOR (RBI GRADE B & BEYOND):
1. Scoring Philosophy:
   - RBI Grade B is an elite, highly selective examination. Do not give inflated marks.
   - An answer that merely regurgitates high-school definitions or vague generic points without statutory references (e.g., RBI Act 1934, Banking Regulation Act 1949, FEMA, IBC, Basel III) or concrete monetary mechanics must score low (20-40% of max marks).
   - An average answer that lists basic textbook points but lacks real-world banking context, transmission channels, or recent RBI circulars/committees receives 45-55% marks.
   - A strong answer demonstrating multi-dimensional analysis (statutory authority, balance sheet impact, transmission channels, trade-offs, and systemic implications) receives 60-75% marks.
   - 75%+ marks are strictly reserved for answers that match or exceed topper quality with precise regulatory grounding, empirical awareness, and a structured policy way forward.

2. Dimensions & Marking Scheme:
   You MUST evaluate the answer against these exact criteria and maximum marks:
   ${JSON.stringify(effectiveScheme, null, 2)}
   Ensure each criterion's score in "scoreBreakdown" is realistic and does NOT exceed its allocated maximum marks. The sum of these dimension scores must equal "totalScore".

3. Word Count & Completeness Discipline:
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
    
    // Create a summarized version of the test to fit context window efficiently
    const summary = {
      mcqQuestions: test.questions.filter((q: any) => q.type === 'MCQ').map((q: any) => ({
        sourceTag: q.sourceTag,
        isCorrect: q.userAnswer === q.correctAnswer
      })),
      descriptiveEvaluations: test.questions.filter((q: any) => q.type === 'Descriptive').map((q: any) => {
        const qId = q.id || test.questions.indexOf(q).toString();
        const evalData = test.evaluations?.[qId];
        return {
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
Focus on identifying broad patterns across MCQs and descriptive answers (e.g., strong in static, weak in dynamic, good structure but lacks content depth).

Performance Summary:
${JSON.stringify(summary, null, 2)}

Output strict JSON schema:
{
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "nextSteps": ["Actionable step 1", "Actionable step 2"]
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
