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

    const prompt = `You are the Chief Examiner and Senior Evaluator for the Reserve Bank of India (RBI) Grade B (Phase II) Examination for Economic & Social Issues (ESI) and Finance & Management (FM).
Evaluate the candidate's descriptive answer with the highest standards of central banking rigor, analytical depth, and institutional accuracy.

EVALUATION BENCHMARK & SCORING PHILOSOPHY:
1. RBI Grade B standards are rigorous and academic.
   - An answer that is merely a brief definition or superficial list without deep economic/regulatory implications must receive low marks (e.g. 15-35% of max marks).
   - An average answer with correct definitions and basic points but missing institutional depth, RBI circulars/committees, or systemic risk analysis receives 40-55% marks.
   - A strong answer demonstrating multi-dimensional analysis, institutional context (RBI circulars, committees, empirical data), balanced trade-offs, and structured presentation receives 60-75% marks.
   - Outstanding answers with deep central banking insight receive 75-85% marks. Marks above 85% are reserved for publication-grade mastery.

2. Four-Pillar RBI Grade B Rubric (Total max marks = ${maxMarks}):
   - Dimension 1: "Conceptual Grounding & Definition" (Weight approx 20-25%)
   - Dimension 2: "Analytical Depth & Impact on Banking System" (Weight approx 30-35%)
   - Dimension 3: "Regulatory, Policy & Real-world Grounding" (Weight approx 25%)
   - Dimension 4: "Structure, Critical Balance & Policy Way Forward" (Weight approx 15-20%)

3. Word Count & Completeness Discipline:
   - Target word limit is ${wordLimit} words.
   - If the candidate's answer is severely truncated or leaves out major parts of the prompt (such as omitting financial inclusion or banking disintermediation), penalize proportionally.

Question:
"${question.text}"

Candidate's Submitted Answer:
"""
${userAnswer}
"""

Benchmark Model Answer for Reference:
"""
${question.modelAnswer || "Ideal response covering definitions, monetary policy transmission, banking disintermediation, financial inclusion mechanisms, and regulatory roadmap."}
"""

Marking Scheme Reference:
${JSON.stringify(question.markingScheme || {})}

Max Marks: ${maxMarks}
Target Word Limit: ${wordLimit}

Output valid JSON matching this exact schema:
{
  "totalScore": 8.5, // Realistic number out of ${maxMarks}
  "evaluationSummary": "Comprehensive 2-3 sentence executive review assessing the candidate's performance against RBI Grade B Phase II standards.",
  "scoreBreakdown": {
    "Conceptual Grounding & Definition": 2.5,
    "Analytical Depth & Impact": 3.0,
    "Regulatory & Policy Grounding": 1.5,
    "Structure & Policy Way Forward": 1.5
  },
  "keyStrengths": [
    "Specific strength demonstrated in the response",
    "Another accurate concept or definition cited"
  ],
  "criticalGaps": [
    "Specific concept, committee, circular, or analytical dimension omitted",
    "Unaddressed trade-off or systemic risk"
  ],
  "topperInsights": [
    "High-scoring central banking concept, circular, or committee to cite",
    "Empirical data point or international comparison (e.g. BIS, Project Nexus)"
  ],
  "feedbackPoints": [
    "Concrete observation on content depth",
    "Observation on structural flow and coverage"
  ],
  "suggestions": [
    "Actionable step to elevate the answer to RBI Grade B topper level",
    "Presentation or thematic heading recommendation"
  ]
}`;

    const rawJson = await callGeminiWithRetry(prompt);
    const raw = safeJsonParse(rawJson);

    const totalScore = typeof raw.totalScore === 'number' && !isNaN(raw.totalScore)
      ? Math.max(0, Math.min(maxMarks, Number(raw.totalScore.toFixed(2))))
      : 0;

    const scoreBreakdown = raw.scoreBreakdown && typeof raw.scoreBreakdown === 'object' && Object.keys(raw.scoreBreakdown).length > 0
      ? raw.scoreBreakdown
      : {
          "Conceptual Grounding": Number((totalScore * 0.3).toFixed(1)),
          "Analytical Depth": Number((totalScore * 0.4).toFixed(1)),
          "Regulatory Context": Number((totalScore * 0.3).toFixed(1))
        };

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
      : ["Ensure balanced multi-dimensional coverage across all clauses of the question."];

    const suggestions = Array.isArray(raw.suggestions) && raw.suggestions.length > 0
      ? raw.suggestions.map((s: any) => String(s))
      : ["Structure answers with clear thematic headings and include an actionable forward-looking conclusion."];

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
