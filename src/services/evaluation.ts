import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TestAttempt, Question } from '../types';
import { checkMCQCorrect } from '../utils/exam';
import { sanitizeForFirestore } from '../utils/firestore';

export interface EvaluationProgressCallback {
  (step: string, percent?: number): void;
}

/**
 * Checks if a question has a genuine, completed evaluation (not a placeholder or error)
 */
export function isDescriptiveEvaluationValid(evalEntry: any): boolean {
  if (!evalEntry || typeof evalEntry.totalScore !== 'number') return false;
  if (evalEntry.isFailed || evalEntry.needsReeval) return false;
  if (evalEntry.scoreBreakdown && (evalEntry.scoreBreakdown['Submission Logged'] !== undefined || evalEntry.scoreBreakdown['Evaluation Pending'] !== undefined)) {
    return false;
  }
  if (Array.isArray(evalEntry.feedbackPoints) && evalEntry.feedbackPoints.some((p: string) => 
    p.includes('recorded for manual review') || p.includes('Evaluation failed') || p.includes('temporary service timeout')
  )) {
    return false;
  }
  return true;
}

/**
 * Helper to call evaluate-descriptive with retries
 */
async function callEvaluateDescriptiveWithRetry(question: Question, userAnswer: string, maxAttempts = 3): Promise<any> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('/api/evaluate-descriptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, userAnswer })
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
      throw new Error(`Server returned status ${res.status}`);
    } catch (err: any) {
      lastErr = err;
      console.warn(`Descriptive evaluation attempt ${attempt} failed:`, err?.message || err);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastErr || new Error('Evaluation failed after retries');
}

/**
 * Evaluates all question responses for a test attempt and permanently stores the complete
 * results in Firestore, marking `isEvaluated: true`.
 */
export async function evaluateAndPersistTest(
  testId: string,
  testData: TestAttempt,
  userId: string,
  onProgress?: EvaluationProgressCallback
): Promise<TestAttempt> {
  const answersMap: Record<string, string> = { ...(testData.answers || {}) };

  // 1. Reconcile and calculate MCQ scores
  onProgress?.('Scoring multiple-choice questions...', 20);
  let totalMcqScore = 0;
  let mcqStaticScore = 0;
  let mcqDynamicScore = 0;

  const evaluatedQuestions: Question[] = (testData.questions || []).map((q, idx) => {
    const qId = q.id || idx.toString();
    const rawAns = q.userAnswer || answersMap[qId] || answersMap[idx.toString()] || null;
    const cleanUserAns = (rawAns && rawAns.trim() !== '') ? rawAns.trim() : null;

    if (q.type === 'MCQ') {
      const maxMarks = (typeof q.maxMarks === 'number' && q.maxMarks > 0) ? q.maxMarks : 1;
      let score = 0;
      let isCorrect = false;

      if (cleanUserAns) {
        isCorrect = checkMCQCorrect(cleanUserAns, q.correctAnswer, q.options);
        score = isCorrect ? maxMarks : -0.25 * maxMarks;
      }

      totalMcqScore += score;
      if (q.sourceTag === 'Static') {
        mcqStaticScore += score;
      } else {
        mcqDynamicScore += score;
      }

      return {
        ...q,
        id: qId,
        maxMarks,
        userAnswer: cleanUserAns,
        score: Number(score.toFixed(2)),
        isCorrect
      };
    }

    // Descriptive placeholder
    return {
      ...q,
      id: qId,
      maxMarks: (typeof q.maxMarks === 'number' && q.maxMarks > 0) ? q.maxMarks : 15,
      userAnswer: cleanUserAns
    };
  });

  // 2. Evaluate descriptive answers
  const descQuestions = evaluatedQuestions.filter(q => q.type === 'Descriptive');
  const evals: Record<string, any> = { ...(testData.evaluations || {}) };
  let totalDescScore = 0;
  let descStaticScore = 0;
  let descDynamicScore = 0;
  let allDescriptiveSucceeded = true;

  let descProgressCount = 0;
  for (let i = 0; i < evaluatedQuestions.length; i++) {
    const q = evaluatedQuestions[i];
    if (q.type !== 'Descriptive') continue;

    const qId = q.id || i.toString();
    descProgressCount++;
    const progressPct = 20 + Math.round((descProgressCount / Math.max(1, descQuestions.length)) * 50);
    onProgress?.(`Evaluating descriptive answer ${descProgressCount} of ${descQuestions.length} (RBI Grade B Standard)...`, progressPct);

    // If already evaluated with valid genuine evaluation, preserve it
    if (isDescriptiveEvaluationValid(evals[qId])) {
      const score = Number(evals[qId].totalScore.toFixed(2));
      q.score = score;
      totalDescScore += score;
      if (q.sourceTag === 'Static') descStaticScore += score;
      else descDynamicScore += score;
      continue;
    }

    // If user provided an answer, evaluate with AI
    if (q.userAnswer && q.userAnswer.trim() !== '') {
      try {
        const evalData = await callEvaluateDescriptiveWithRetry(q, q.userAnswer, 3);
        const score = typeof evalData.totalScore === 'number' ? Number(evalData.totalScore.toFixed(2)) : 0;
        
        evals[qId] = {
          totalScore: score,
          evaluationSummary: evalData.evaluationSummary,
          scoreBreakdown: evalData.scoreBreakdown || { "Content Coverage": score },
          keyStrengths: evalData.keyStrengths || [],
          criticalGaps: evalData.criticalGaps || [],
          topperInsights: evalData.topperInsights || [],
          feedbackPoints: Array.isArray(evalData.feedbackPoints) ? evalData.feedbackPoints : ["Answer evaluated against model answer."],
          suggestions: Array.isArray(evalData.suggestions) ? evalData.suggestions : ["Structure response with headings and citations."]
        };
        q.score = score;
        totalDescScore += score;
        if (q.sourceTag === 'Static') descStaticScore += score;
        else descDynamicScore += score;
      } catch (e) {
        console.error(`Evaluation failed for descriptive question ${qId}`, e);
        allDescriptiveSucceeded = false;
        evals[qId] = {
          totalScore: 0,
          needsReeval: true,
          isFailed: true,
          scoreBreakdown: { "Evaluation Pending": 0 },
          feedbackPoints: ["Evaluation encountered a temporary service timeout. Click 'Re-Grade Answer' to evaluate."],
          suggestions: ["Ensure continuous network connection and click to re-evaluate."]
        };
        q.score = 0;
      }
    } else {
      // Unattempted descriptive question
      evals[qId] = {
        totalScore: 0,
        scoreBreakdown: { "Unattempted": 0 },
        feedbackPoints: ["Question was left unattempted."],
        suggestions: ["Attempt every question to secure partial credit for key conceptual points."]
      };
      q.score = 0;
    }
  }

  // 3. Overall feedback generation
  onProgress?.('Synthesizing overall performance analysis & actionable steps...', 85);
  let overallFeedback = testData.overallFeedback;
  if (!overallFeedback || !Array.isArray(overallFeedback.strengths) || overallFeedback.strengths.length === 0) {
    try {
      const res = await fetch('/api/generate-overall-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: {
            ...testData,
            questions: evaluatedQuestions,
            evaluations: evals
          }
        })
      });

      if (res.ok) {
        overallFeedback = await res.json();
      }
    } catch (e) {
      console.error('Overall feedback generation error:', e);
    }

    if (!overallFeedback || !Array.isArray(overallFeedback.strengths) || overallFeedback.strengths.length === 0) {
      overallFeedback = {
        strengths: ["Completed mock exam under timed test conditions."],
        weaknesses: ["Review missed MCQs and refine speed on descriptive sections."],
        nextSteps: ["Focus revision on high-yield RBI Grade B static topics and practice dynamic writing."]
      };
    }
  }

  // 4. Calculate total and section scores
  const finalTotalScore = Number((totalMcqScore + totalDescScore).toFixed(2));
  const sectionScores = {
    mcqStatic: Number(mcqStaticScore.toFixed(2)),
    mcqDynamic: Number(mcqDynamicScore.toFixed(2)),
    descStatic: Number(descStaticScore.toFixed(2)),
    descDynamic: Number(descDynamicScore.toFixed(2))
  };

  // 5. Store permanently in Firestore
  onProgress?.('Storing finalized evaluation report into database...', 95);
  const docRef = doc(db, 'tests', testId);

  const persistencePayload = sanitizeForFirestore({
    userId,
    status: 'completed' as const,
    isEvaluated: allDescriptiveSucceeded, // Only mark fully evaluated if all completed
    evaluatedAt: Date.now(),
    submittedAt: testData.submittedAt || Date.now(),
    questions: evaluatedQuestions,
    answers: answersMap,
    totalScore: finalTotalScore,
    sectionScores,
    evaluations: evals,
    overallFeedback
  });

  await updateDoc(docRef, persistencePayload);

  onProgress?.('Complete!', 100);

  return {
    ...testData,
    ...persistencePayload,
    status: 'completed',
    id: testId
  };
}

/**
 * Re-evaluates a single descriptive question and updates the test record in Firestore
 */
export async function evaluateSingleDescriptiveQuestion(
  testId: string,
  testData: TestAttempt,
  questionId: string,
  userId: string
): Promise<TestAttempt> {
  const qIndex = (testData.questions || []).findIndex((q, idx) => (q.id || idx.toString()) === questionId);
  if (qIndex === -1) throw new Error('Question not found in test attempt');

  const question = testData.questions[qIndex];
  const userAns = question.userAnswer || testData.answers?.[questionId] || testData.answers?.[qIndex.toString()] || '';

  if (!userAns || userAns.trim() === '') {
    throw new Error('No answer submitted for this question');
  }

  const evalData = await callEvaluateDescriptiveWithRetry(question, userAns, 3);
  const score = typeof evalData.totalScore === 'number' ? Number(evalData.totalScore.toFixed(2)) : 0;

  const updatedEvals = {
    ...(testData.evaluations || {}),
    [questionId]: {
      totalScore: score,
      evaluationSummary: evalData.evaluationSummary,
      scoreBreakdown: evalData.scoreBreakdown || { "Content Coverage": score },
      keyStrengths: evalData.keyStrengths || [],
      criticalGaps: evalData.criticalGaps || [],
      topperInsights: evalData.topperInsights || [],
      feedbackPoints: Array.isArray(evalData.feedbackPoints) ? evalData.feedbackPoints : ["Answer evaluated against model answer."],
      suggestions: Array.isArray(evalData.suggestions) ? evalData.suggestions : ["Structure response with headings and citations."]
    }
  };

  const updatedQuestions = testData.questions.map((q, idx) => {
    if ((q.id || idx.toString()) === questionId) {
      return { ...q, score };
    }
    return q;
  });

  // Recalculate totals
  let totalMcq = 0;
  let totalDesc = 0;
  let mcqStatic = 0;
  let mcqDynamic = 0;
  let descStatic = 0;
  let descDynamic = 0;

  for (let i = 0; i < updatedQuestions.length; i++) {
    const q = updatedQuestions[i];
    const qScore = typeof q.score === 'number' ? q.score : 0;
    if (q.type === 'MCQ') {
      totalMcq += qScore;
      if (q.sourceTag === 'Static') mcqStatic += qScore;
      else mcqDynamic += qScore;
    } else {
      totalDesc += qScore;
      if (q.sourceTag === 'Static') descStatic += qScore;
      else descDynamic += qScore;
    }
  }

  const newTotalScore = Number((totalMcq + totalDesc).toFixed(2));
  const newSectionScores = {
    mcqStatic: Number(mcqStatic.toFixed(2)),
    mcqDynamic: Number(mcqDynamic.toFixed(2)),
    descStatic: Number(descStatic.toFixed(2)),
    descDynamic: Number(descDynamic.toFixed(2))
  };

  const docRef = doc(db, 'tests', testId);
  const payload = sanitizeForFirestore({
    userId,
    isEvaluated: true,
    questions: updatedQuestions,
    evaluations: updatedEvals,
    totalScore: newTotalScore,
    sectionScores: newSectionScores
  });

  await updateDoc(docRef, payload);

  return {
    ...testData,
    ...payload,
    id: testId
  };
}
