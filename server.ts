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
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://*.firebaseapp.com https://*.googleapis.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.firebasestorage.app https://*.run.app",
      "connect-src 'self' data: blob: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.firebasestorage.app https://*.run.app https://rbi-grade-b-exam-engine.vercel.app ws: wss:",
      "frame-src 'self' https://*.firebaseapp.com https://*.google.com",
      "frame-ancestors 'self' https://*.google.com https://*.run.app https://ais-*.run.app https://rbi-grade-b-exam-engine.vercel.app",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
  next();
});

// Authorized origins including the Vercel production domain
const ALLOWED_ORIGINS = [
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

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { extractedText, config } = req.body;
    const subjectName = config?.subject || 'General Banking & Economic Awareness';
    const targetTopic = config?.targetTopic ? `Specific Topic Focus: ${config.targetTopic}` : '';
    const examMode = config?.mode || 'Sectional';
    const totalMcqs = (config.mcqStatic || 0) + (config.mcqDynamic || 0);
    
    const prompt = `You are the Chief Examiner and Principal Paper Setter on the Services Selection Board for the Reserve Bank of India (RBI Grade B - Officers in Grade 'B' Direct Recruitment).
You must construct an exceptionally rigorous, high-difficulty mock examination that matches and exceeds the authentic difficulty level of the actual RBI Grade B examination (Phase 1 & Phase 2).

SUBJECT: "${subjectName}"
${targetTopic}
EXAM MODE: "${examMode}"
TARGET MCQ COUNT: ${totalMcqs} (${config.mcqStatic || 0} Static, ${config.mcqDynamic || 0} Dynamic)
TARGET DESCRIPTIVE COUNT: ${(config.descStatic || 0) + (config.descDynamic || 0)} (${config.descStatic || 0} Static, ${config.descDynamic || 0} Dynamic)

DIFFICULTY LEVEL & BENCHMARK (MANDATORY):
- RBI Grade B is notoriously difficult. AVOID simplistic, trivial one-liner factual trivia.
- Every question must test deep conceptual mastery, statutory provisions, regulatory circulars, multi-layered analytical deduction, or financial/mathematical calculations.
- Distractors (incorrect options) must be realistic, tricky, and designed to trap candidates who only have superficial knowledge.

MANDATORY DIVERSITY OF RBI GRADE B MCQ FORMATS:
Do NOT create only "Which statement is correct" questions. You MUST distribute the ${totalMcqs} MCQs across the following authentic RBI Grade B question archetypes:

1. [Multi-Statement Analytical Evaluation]:
   Provide 3 to 4 technical statements labeled (I), (II), (III), and optionally (IV).
   Prompt: "Which of the statements given above is/are correct?" or "is/are INCORRECT?"
   Options MUST be combinations, e.g.:
   - "Only I and III"
   - "Only II and IV"
   - "Only I, II and III"
   - "All I, II, III and IV"
   - "None of the above"

2. [Passage / Caselet Contextual Question]:
   Provide a dense 3-5 line extract representing an RBI Circular, Union Budget excerpt, Economic Survey finding, or macroeconomic scenario labeled "[Context / Caselet]".
   Follow with an analytical question evaluating policy implications, statutory limits, or indirect economic fallout.

3. [Assertion (A) & Reason (R)]:
   Assertion (A): [Proposition on monetary transmission, Basel III norms, fiscal deficit, or management theory]
   Reason (R): [Theoretical mechanism or statutory foundation]
   Options MUST follow standard RBI pattern:
   - "Both (A) and (R) are true and (R) is the correct explanation of (A)"
   - "Both (A) and (R) are true but (R) is NOT the correct explanation of (A)"
   - "(A) is true but (R) is false"
   - "(A) is false but (R) is true"
   - "Both (A) and (R) are false"

4. [Match the Following / Matrix Matching]:
   Column I (A, B, C, D) listing regulatory bodies, committees, financial ratios, or schemes.
   Column II (1, 2, 3, 4) listing recommendations, formulas, mandates, or statutory sections.
   Options must be exact matching codes: "A-2, B-4, C-1, D-3", "A-3, B-1, C-4, D-2", etc.

5. [Numerical / Financial Math Problem]:
   For Finance, Management, or Quant: Real calculation problem (e.g. Yield to Maturity, Modified Duration, DuPont ROE decomposition, Debt Service Coverage Ratio (DSCR), WACC, Capital Adequacy / CRAR calculations, or Data Interpretation).
   Options with precise calculated numerical values.

6. [Chronological / Regulatory Sequencing]:
   Provide 4 historical or policy milestones (I, II, III, IV) and ask to arrange them in the correct chronological sequence of notification or occurrence.

7. [Technical Multi-Blank Verification]:
   Regulatory framework with [Blank I] and [Blank II] (e.g. "Under the PCA framework, Threshold 1 is triggered when CET-1 is below [Blank I] and Net NPA exceeds [Blank II]").
   Options with paired regulatory percentages or statutory figures.

8. [Quantity I vs Quantity II Comparison] (for QA / Reasoning / Finance):
   Quantity I: [Description / Value]
   Quantity II: [Description / Value]
   Options: "Quantity I > Quantity II", "Quantity I < Quantity II", "Quantity I >= Quantity II", "Quantity I <= Quantity II", "Quantity I = Quantity II or relation cannot be established".

STRICT 5-OPTION RULE:
- EVERY single MCQ MUST HAVE EXACTLY 5 DISTINCT OPTIONS (Option 1 to Option 5).
- Never output only 4 options.

DESCRIPTIVE QUESTION SPECIFICATIONS:
- Authentic Phase II 10-mark (400 words) or 15-mark (600 words) analytical questions.
- Demands multi-dimensional analysis: theoretical grounding, regulatory framework, contemporary challenges, and forward-looking pragmatic roadmap.
- Provide a rigorous 4-pillar marking scheme and an exhaustive topper-standard model answer with clear section headings.

STUDY NOTES & REFERENCE TEXT:
"""
${extractedText}
"""

Output valid JSON matching this exact schema:
{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "topic": "${config.targetTopic || 'Regulatory Framework & Monetary Economics'}",
      "text": "Consider the following statements regarding the Basel III Capital Regulations issued by the Reserve Bank of India:\\n\\nI. The minimum Common Equity Tier 1 (CET-1) capital requirement is 5.5% of Risk-Weighted Assets (RWAs).\\nII. The Capital Conservation Buffer (CCB) of 2.5% must be comprised entirely of Common Equity Tier 1 capital.\\nIII. The minimum total capital (CRAR) requirement for commercial banks in India is 8.0%, which matches the international Basel baseline.\\n\\nWhich of the statements given above is/are correct?",
      "options": [
        "Only I and II",
        "Only II and III",
        "Only I and III",
        "All I, II, and III",
        "None of the above"
      ],
      "correctAnswer": "Only I and II",
      "explanation": "Statement I and II are correct. Under RBI guidelines (stricter than Basel norms), minimum CET-1 is 5.5% and CCB is 2.5% (all CET-1). Statement III is incorrect because RBI mandates a minimum CRAR of 9.0% for commercial banks, whereas the international Basel III minimum is 8.0%.",
      "maxMarks": 1
    },
    {
      "type": "Descriptive",
      "sourceTag": "Dynamic",
      "topic": "${config.targetTopic || 'Macroeconomic & Financial Stability'}",
      "text": "Examine the macroeconomic trade-offs between fiscal consolidation and capital expenditure in India's post-pandemic growth trajectory. In this context, evaluate how the Reserve Bank of India's liquidity management framework supports sovereign borrowing without crowding out private sector credit.",
      "maxMarks": 15,
      "wordLimit": 600,
      "markingScheme": {
        "Macro-Fiscal Context & Theoretical Foundation": 3.5,
        "RBI Liquidity Tools & Sovereign Debt Dynamics": 4.5,
        "Private Credit Crowding Out & Transmission Analysis": 4.0,
        "Structural Recommendations & Policy Roadmap": 3.0
      },
      "modelAnswer": "### 1. Introduction & Macro-Fiscal Landscape\\n\\nIndia's post-pandemic fiscal policy has navigated the dual imperative of fiscal consolidation (targeting a fiscal deficit below 4.5% of GDP by FY26) while sustaining high-multiplier capital expenditure (exceeding 3.3% of GDP)...\\n\\n### 2. Monetary-Fiscal Coordination & Liquidity Management\\n\\nThe RBI facilitates the orderly absorption of sovereign borrowing through calibrated liquidity operations, utilizing the Standing Deposit Facility (SDF) as the floor and Marginal Standing Facility (MSF) as the ceiling of the Liquidity Adjustment Facility (LAF) corridor...\\n\\n### 3. Mitigating Private Sector Crowding-Out\\n\\nCrowding out is averted when public investment crowds IN private capex through infrastructure debottlenecking, accompanied by robust banking sector capitalization (CRAR > 16.8%) and historically low Non-Performing Assets (Gross NPAs < 2.8%)...\\n\\n### 4. Conclusion & Forward Roadmap\\n\\nA sustainable fiscal-monetary matrix necessitates deepening the corporate bond market, active secondary market sovereign debt management, and steadfast adherence to the FRBM debt-to-GDP trajectory."
    }
  ]
}`;

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

        return {
          id: q.id || `q_mcq_${index + 1}`,
          type: 'MCQ' as const,
          sourceTag,
          topic: q.topic || config.targetTopic || (sourceTag === 'Dynamic' ? 'Current Regulatory & Policy Affairs' : 'Statutory & Core Principles'),
          difficulty: q.difficulty || config.difficulty || 'Hard',
          text,
          options: optionsList,
          correctAnswer: resolvedCorrect,
          explanation: q.explanation || 'Refer to the statutory RBI circulars, Master Directions, and core economic literature for this question.',
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
