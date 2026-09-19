import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
    
    const prompt = `You are an elite Senior Paper Setter and Chief Examiner on the Services Selection Board for the Reserve Bank of India (RBI Grade B - Officers in Grade 'B' Direct Recruitment).
Your task is to draft an exceptionally rigorous, high-standard mock examination paper based on the provided study notes.

DIFFICULTY LEVEL & BENCHMARK:
- Match and exceed the difficulty of actual RBI Grade B (Phase I General Awareness and Phase II ESI & Finance/Management) papers.
- Avoid trivial recall questions. Focus on:
  * Multi-variable statutory rules (RBI Act 1934, Banking Regulation Act 1949, FEMA 1999, PSS Act 2007, IBC 2016).
  * Prudential norms: Scale Based Regulation for NBFCs, Basel III Capital Frameworks (CRAR, CET-1, Capital Conservation Buffer, Countercyclical Buffer, LCR, NSFR), PCA framework triggers, NPA recognition norms (SMA-0, SMA-1, SMA-2, Wilful Defaulters), EBLR mechanism, Standing Deposit Facility (SDF).
  * Priority Sector Lending (PSL) sub-targets (40% ANBC/CEOBE, Small & Marginal Farmers, Micro Enterprises, Weaker Sections), Financial Inclusion Index (FI-Index - Access, Usage, Quality).
  * Contemporary macroeconomic and central banking developments: Digital Rupee (e₹-R and e₹-W), interoperability with UPI, Project Nexus, green finance frameworks, Sovereign Green Bonds, Inflation Targeting / MPC statutory requirements (Section 45ZB).

QUESTION SPECIFICATIONS:
1. STATIC MCQs (Count: ${config.mcqStatic}):
   - At least 60-70% must be statement-based questions ("Consider the following statements... Which of the statements given above is/are correct?").
   - EXACTLY 5 distinct options: Option 1, Option 2, Option 3, Option 4, Option 5 (adhering strictly to standard IBPS / RBI 5-option format: e.g. "Only 1 and 2", "Only 2 and 3", etc.).
   - Craft close, realistic distractors with nuanced technical details.
   - Provide a comprehensive, in-depth explanation breaking down why the correct option is true and why each other option/statement is false or deceptive.

2. DYNAMIC / CURRENT AFFAIRS MCQs (Count: ${config.mcqDynamic}):
   - Connect the study notes to recent RBI circulars, regulatory guidelines, MPC policy rates, Union Budget, Economic Survey, or global central bank shifts.
   - Also EXACTLY 5 options (Option 1 to Option 5).
   - High analytical rigor with complete explanatory walkthrough.

3. STATIC DESCRIPTIVE QUESTIONS (Count: ${config.descStatic}):
   - Formulated as an authentic Phase II 10-mark (400 words) or 15-mark (600 words) question.
   - Demands critical analysis ("Critically examine", "Evaluate the efficacy", "Substantiate with structural challenges").
   - Detailed 4-pillar marking scheme totaling the maxMarks.
   - Comprehensive topper-caliber model answer (with structured sections: Introduction, Analytical Pillars, Structural Bottlenecks, Policy Roadmap / Recommendations, and Synthesis).

4. DYNAMIC DESCRIPTIVE QUESTIONS (Count: ${config.descDynamic}):
   - High-yield Phase II questions focusing on contemporary reforms (CBDC, climate finance, AI/Fintech regulation, cross-border payments, resolution of stressed assets).
   - Word limit: 400 or 600 words (or 250-400 words).
   - Full 4-pillar marking scheme and exceptional benchmark model answer.

STUDY NOTES TO BASE EXAM ON:
"""
${extractedText}
"""

Output valid JSON matching this exact schema:
{
  "questions": [
    {
      "type": "MCQ",
      "sourceTag": "Static",
      "text": "Consider the following statements regarding...",
      "options": ["Only 1 and 2", "Only 2 and 3", "Only 1 and 3", "1, 2 and 3", "None of the above"],
      "correctAnswer": "Only 1 and 3",
      "explanation": "Detailed explanation of why statement 1 & 3 are correct and 2 is incorrect...",
      "maxMarks": 1
    },
    {
      "type": "Descriptive",
      "sourceTag": "Dynamic",
      "text": "Analytical question prompt...",
      "maxMarks": 15,
      "wordLimit": 400,
      "markingScheme": {
        "Conceptual Grounding & Framework": 3.5,
        "Analytical Depth & Banking Impact": 5.0,
        "Regulatory & Policy Grounding": 3.5,
        "Structure & Pragmatic Roadmap": 3.0
      },
      "modelAnswer": "Comprehensive model answer formatted with clear headings, paragraph breaks (using \\n\\n), and bulleted recommendations..."
    }
  ]
}`;

    const rawJson = await callGeminiWithRetry(prompt);
    const parsed = safeJsonParse(rawJson);
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

    // Robust Question Normalization
    const normalizedQuestions = rawQuestions.map((q: any, index: number) => {
      const isMCQ = (q.type || '').toUpperCase() === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0) || (q.options && typeof q.options === 'object');
      const text = q.text || q.question || q.questionText || `Question ${index + 1}`;
      const sourceTag = (q.sourceTag === 'Dynamic' || q.source === 'Dynamic') ? 'Dynamic' : 'Static';

      if (isMCQ) {
        // Extract options ensuring exactly 5 options if possible
        let optionsList: string[] = [];
        if (Array.isArray(q.options)) {
          optionsList = q.options.map((opt: any) => String(opt).trim());
        } else if (q.options && typeof q.options === 'object') {
          optionsList = Object.values(q.options).map((opt: any) => String(opt).trim());
        }

        // Clean option prefixes like "A) " or "Option 1: "
        optionsList = optionsList.map(opt => opt.replace(/^[A-Ea-e1-5][\).\:\-]\s*/, '').trim()).filter(Boolean);

        // Standardize correctAnswer
        let correctAnswer = String(q.correctAnswer || '').trim();
        correctAnswer = correctAnswer.replace(/^[A-Ea-e1-5][\).\:\-]\s*/, '').trim();

        // If correctAnswer was just an index or letter like "A" or "0"
        const letterIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(correctAnswer.toUpperCase());
        if (letterIndex !== -1 && optionsList[letterIndex]) {
          correctAnswer = optionsList[letterIndex];
        } else {
          // Check exact or partial match with one of the options
          const matched = optionsList.find(opt => opt.toLowerCase() === correctAnswer.toLowerCase());
          if (matched) {
            correctAnswer = matched;
          } else if (optionsList.length > 0 && !optionsList.includes(correctAnswer)) {
            // Default to first option if not matched
            correctAnswer = optionsList[0];
          }
        }

        return {
          id: q.id || `q_mcq_${index + 1}`,
          type: 'MCQ' as const,
          sourceTag,
          text,
          options: optionsList,
          correctAnswer,
          explanation: q.explanation || 'Refer to the relevant RBI guidelines and conceptual notes for this question.',
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
    const { uploadId, mimeType } = req.body;
    
    if (!uploadId) {
      return res.status(400).json({ error: 'No uploadId provided' });
    }

    const tmpFilePath = activeUploads.get(uploadId);
    if (!tmpFilePath || !fs.existsSync(tmpFilePath)) {
      return res.status(404).json({ error: 'Upload not found or incomplete' });
    }

    // Use streaming NDJSON to prevent Nginx proxy timeouts for long-running extractions
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.write(JSON.stringify({ status: 'Uploading to AI...' }) + '\n');

    const genai = getGenAI();
    let uploadResponse;
    try {
      uploadResponse = await genai.files.upload({
        file: tmpFilePath,
        config: { mimeType: mimeType || 'application/pdf' }
      });
    } finally {
      // Clean up local temp file
      activeUploads.delete(uploadId);
      await fs.promises.unlink(tmpFilePath).catch(e => console.error("Failed to delete tmp file:", e));
    }
    
    res.write(JSON.stringify({ status: 'Processing document...' }) + '\n');

    let fileState = await genai.files.get({ name: uploadResponse.name });
    while (fileState.state === 'PROCESSING') {
      await new Promise(r => setTimeout(r, 2000));
      res.write(JSON.stringify({ status: 'Processing document...' }) + '\n');
      fileState = await genai.files.get({ name: uploadResponse.name });
    }

    if (fileState.state === 'FAILED') {
      throw new Error("Document processing failed on AI server.");
    }
    
    res.write(JSON.stringify({ status: 'Analyzing notes...' }) + '\n');

    const prompt = `Please extract all the text from this document accurately. It contains study notes for an exam. Ensure you capture all headings, bullet points, and paragraphs clearly.`;
    
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
