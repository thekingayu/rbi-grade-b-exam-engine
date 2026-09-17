import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { extractedText, config } = req.body;
    
    const prompt = `You are a senior RBI Grade B exam paper-setter.
Generate an exam based on the provided study notes.
Configuration:
- Static MCQs: ${config.mcqStatic}
- Dynamic/Current Affairs MCQs: ${config.mcqDynamic} (relate notes to recent events)
- Static Descriptive: ${config.descStatic}
- Dynamic/Current Affairs Descriptive: ${config.descDynamic}

Study Notes:
"""
${extractedText}
"""

Rules:
1. Difficulty & format strictly matches RBI Grade B Phase I and Phase II. Skew slightly harder.
2. MCQs: 4 options, single correct answer. Factual, applied, and conceptual mix.
3. Dynamic questions MUST connect the topic to recent real-world developments.
4. Descriptive questions must specify a clear word limit (e.g., 250 words) and have a comprehensive marking scheme breakdown (modelAnswer should be a top candidate response).
5. Output strict JSON matching the schema exactly.

Schema for output:
{
  "questions": [
    {
      "type": "MCQ" | "Descriptive",
      "sourceTag": "Static" | "Dynamic",
      "text": "The question text",
      "options": ["opt1", "opt2", "opt3", "opt4"], // Only if MCQ, else null
      "correctAnswer": "optX", // Only if MCQ, else null
      "explanation": "Explanation for the correct answer", // Only if MCQ, else null
      "modelAnswer": "Detailed ideal answer formatted with appropriate headings, paragraph breaks (using \\n\\n), bullet points, and strictly matching the specified word limit...", // Only if Descriptive, else null
      "markingScheme": { "Content Coverage": 4, "Structure": 3, "Language": 3 }, // Only if Descriptive, else null
      "maxMarks": 1, // 1 for MCQ, e.g., 10 or 15 for Descriptive
      "wordLimit": 250 // Only if Descriptive, else null
    }
  ]
}`;

    const genai = getGenAI();
    const response = await genai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) throw new Error("No response from Gemini");
    const jsonStr = response.text.replace(/^```json\n?/, '').replace(/```$/, '');
    res.json(JSON.parse(jsonStr));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/evaluate-descriptive', async (req, res) => {
  try {
    const { question, userAnswer } = req.body;
    
    const prompt = `You are a senior RBI Grade B exam evaluator.
Evaluate the user's descriptive answer against the model answer and marking scheme.

Question: ${question.text}
Model Answer: ${question.modelAnswer}
Marking Scheme: ${JSON.stringify(question.markingScheme)}
Max Marks: ${question.maxMarks}
Word Limit: ${question.wordLimit}

User Answer:
"""
${userAnswer}
"""

Provide specific, actionable writing feedback:
- What content points were missed?
- Structural issues (intro/body/conclusion)?
- Language/clarity issues?
- 2-3 concrete suggestions to improve.
Also provide a score breakdown matching the marking scheme keys.

Output JSON schema:
{
  "totalScore": 0,
  "scoreBreakdown": { "Content Coverage": 2, "Structure": 2, "Language": 2 },
  "feedbackPoints": ["Missed point X", "Good structure but..."],
  "suggestions": ["Improve X by doing Y"]
}`;

    const genai = getGenAI();
    const response = await genai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) throw new Error("No response from Gemini");
    const jsonStr = response.text.replace(/^```json\n?/, '').replace(/```$/, '');
    res.json(JSON.parse(jsonStr));
  } catch (error) {
    console.error(error);
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

    const genai = getGenAI();
    const response = await genai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) throw new Error("No response from Gemini");
    const jsonStr = response.text.replace(/^```json\n?/, '').replace(/```$/, '');
    res.json(JSON.parse(jsonStr));
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

app.post('/api/upload-chunk', chunkUpload.single('chunk'), async (req, res) => {
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
        mimeType: mimeType || 'application/pdf',
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
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // In dev, we need Vite integration
  const createViteServer = async () => {
    const { createServer: createVite } = await import('vite');
    const vite = await createVite({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  };
  createViteServer();
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
