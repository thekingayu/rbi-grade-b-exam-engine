import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TestAttempt, Question } from '../types';
import { checkMCQCorrect } from '../utils/exam';
import { sanitizeForFirestore } from '../utils/firestore';
import { getApiUrl } from '../utils/api';

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
      const res = await fetch(getApiUrl('/api/evaluate-descriptive'), {
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

function computePerSubjectScores(
  testData: TestAttempt,
  questions: Question[],
  evals: Record<string, any>
) {
  if (!testData.sections || testData.sections.length === 0) return undefined;

  const summaryMap: Record<string, {
    sectionId: string;
    slug: string;
    name: string;
    shortName: string;
    accentColor: string;
    score: number;
    maxMarks: number;
    attempted: number;
    correct: number;
    incorrect: number;
    questionCount: number;
    mcqCount: number;
    descCount: number;
  }> = {};

  testData.sections.forEach(sec => {
    summaryMap[sec.id] = {
      sectionId: sec.id,
      slug: sec.slug,
      name: sec.name,
      shortName: sec.shortName,
      accentColor: sec.accentColor,
      score: 0,
      maxMarks: 0,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      questionCount: 0,
      mcqCount: 0,
      descCount: 0
    };
  });

  questions.forEach((q, idx) => {
    const secId = q.sectionId || q.subjectId || testData.sections![0].id;
    if (!summaryMap[secId]) {
      summaryMap[secId] = {
        sectionId: secId,
        slug: q.subjectSlug || secId,
        name: q.sectionName || 'Section',
        shortName: q.sectionName || 'Section',
        accentColor: '#0D47FF',
        score: 0,
        maxMarks: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        questionCount: 0,
        mcqCount: 0,
        descCount: 0
      };
    }

    const bucket = summaryMap[secId];
    bucket.questionCount += 1;
    bucket.maxMarks = Number((bucket.maxMarks + (q.maxMarks || 0)).toFixed(2));

    const qId = q.id || idx.toString();
    const hasAnswer = !!(q.userAnswer && q.userAnswer.trim() !== '');
    if (hasAnswer) bucket.attempted += 1;

    if (q.type === 'MCQ') {
      bucket.mcqCount += 1;
      bucket.score = Number((bucket.score + (q.score || 0)).toFixed(2));
      if (hasAnswer) {
        if (q.isCorrect) bucket.correct += 1;
        else bucket.incorrect += 1;
      }
    } else {
      bucket.descCount += 1;
      const descScore = evals[qId]?.totalScore ?? q.score ?? 0;
      bucket.score = Number((bucket.score + descScore).toFixed(2));
    }
  });

  return summaryMap;
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
  const negativePenaltyFraction = testData.negativeMarks === 0 ? 0 : 0.25;

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
        score = isCorrect ? maxMarks : -negativePenaltyFraction * maxMarks;
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

  // 2. Evaluate descriptive answers (with concurrency of 2 for faster Phase 2 evaluation)
  const descIndices = evaluatedQuestions
    .map((q, idx) => (q.type === 'Descriptive' ? idx : -1))
    .filter(idx => idx !== -1);
  const evals: Record<string, any> = { ...(testData.evaluations || {}) };
  let totalDescScore = 0;
  let descStaticScore = 0;
  let descDynamicScore = 0;
  let allDescriptiveSucceeded = true;

  let descProgressCount = 0;
  const evaluateDescAt = async (qIdx: number) => {
    const q = evaluatedQuestions[qIdx];
    const qId = q.id || qIdx.toString();

    if (isDescriptiveEvaluationValid(evals[qId])) {
      const score = Number(evals[qId].totalScore.toFixed(2));
      q.score = score;
      descProgressCount++;
      const progressPct = 20 + Math.round((descProgressCount / Math.max(1, descIndices.length)) * 55);
      onProgress?.(`Verified descriptive answer ${descProgressCount} of ${descIndices.length}...`, progressPct);
      return;
    }

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
      evals[qId] = {
        totalScore: 0,
        scoreBreakdown: { "Unattempted": 0 },
        feedbackPoints: ["Question was left unattempted."],
        suggestions: ["Attempt every question to secure partial credit for key conceptual points."]
      };
      q.score = 0;
    }

    descProgressCount++;
    const progressPct = 20 + Math.round((descProgressCount / Math.max(1, descIndices.length)) * 55);
    onProgress?.(`Evaluating descriptive answer ${descProgressCount} of ${descIndices.length} (RBI Grade B Standard)...`, progressPct);
  };

  for (let i = 0; i < descIndices.length; i += 2) {
    const pair = descIndices.slice(i, i + 2);
    await Promise.all(pair.map(idx => evaluateDescAt(idx)));
  }

  descIndices.forEach(idx => {
    const q = evaluatedQuestions[idx];
    const score = q.score || 0;
    totalDescScore += score;
    if (q.sourceTag === 'Static') descStaticScore += score;
    else descDynamicScore += score;
  });

  // 3. Overall feedback generation
  onProgress?.('Synthesizing overall performance analysis & actionable steps...', 85);
  let overallFeedback = testData.overallFeedback;
  if (!overallFeedback || !Array.isArray(overallFeedback.strengths) || overallFeedback.strengths.length === 0) {
    try {
      const res = await fetch(getApiUrl('/api/generate-overall-feedback'), {
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

  // 4. Calculate total, section, and per-subject scores
  const finalTotalScore = Number((totalMcqScore + totalDescScore).toFixed(2));
  const sectionScores = {
    mcqStatic: Number(mcqStaticScore.toFixed(2)),
    mcqDynamic: Number(mcqDynamicScore.toFixed(2)),
    descStatic: Number(descStaticScore.toFixed(2)),
    descDynamic: Number(descDynamicScore.toFixed(2))
  };
  const perSubjectScores = computePerSubjectScores(testData, evaluatedQuestions, evals);

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
    perSubjectScores,
    evaluations: evals,
    overallFeedback
  });

  await updateDoc(docRef, persistencePayload);

  // 6. Automatically extract and store Mistakes into Firestore collection 'mistakes' & local state
  try {
    const defaultSubjectId = testData.subjectId || 'sub_ga';
    const defaultSubjectSlug = testData.subjectSlug || 'general-awareness';

    const existingMistakesRaw = localStorage.getItem('rbi_mistake_entries_v1');
    let localMistakesArr: any[] = [];
    try {
      if (existingMistakesRaw) localMistakesArr = JSON.parse(existingMistakesRaw);
    } catch (e) {}

    const { setDoc } = await import('firebase/firestore');

    for (let i = 0; i < evaluatedQuestions.length; i++) {
      const q = evaluatedQuestions[i];
      const qId = q.id || i.toString();
      const userAns = q.userAnswer || answersMap[qId] || answersMap[i.toString()] || null;
      const qSubjectId = q.subjectId || q.sectionId || defaultSubjectId;
      const qSubjectSlug = q.subjectSlug || defaultSubjectSlug;

      let isMistake = false;
      let reason = '';

      if (q.type === 'MCQ') {
        if (!userAns || userAns.trim() === '') {
          // For 200-question full-length mocks, log only incorrect attempts so Mistake Notebook stays high-signal rather than flooding with 100 skipped items
          if (!testData.isFullPhaseExam) {
            isMistake = true;
            reason = 'Skipped / Unattempted MCQ';
          }
        } else if (q.isCorrect === false) {
          isMistake = true;
          reason = 'Incorrect MCQ Answer';
        }
      } else if (q.type === 'Descriptive') {
        const evalObj = evals[qId];
        const score = evalObj?.totalScore || 0;
        const max = q.maxMarks || 15;
        if (!userAns || userAns.trim() === '') {
          isMistake = true;
          reason = 'Unattempted Descriptive Prompt';
        } else if (score < max * 0.5) {
          isMistake = true;
          reason = `Descriptive Score (${score}/${max}) below 50% benchmark`;
        }
      }

      if (isMistake) {
        const mistakeId = `mistake_${testId}_${qId}`;
        const mistakeData = sanitizeForFirestore({
          id: mistakeId,
          userId,
          testId,
          subjectId: qSubjectId,
          subjectSlug: qSubjectSlug,
          questionId: qId,
          type: q.type,
          topic: q.topic || 'General Theory',
          difficulty: q.difficulty || 'Moderate',
          text: q.text,
          options: q.options || null,
          userAnswer: userAns || null,
          correctAnswer: q.correctAnswer || (q.type === 'Descriptive' ? q.modelAnswer : null) || null,
          explanation: q.explanation || evals[qId]?.evaluationSummary || reason,
          leitnerBox: 1,
          reviewCount: 0,
          createdAt: Date.now(),
          nextReviewDue: Date.now() + 24 * 60 * 60 * 1000
        });

        try {
          await setDoc(doc(db, 'mistakes', mistakeId), mistakeData, { merge: true });
        } catch (mErr) {
          console.error('Failed to write mistake to Firestore:', mErr);
        }

        const dupIdx = localMistakesArr.findIndex((m: any) => m.id === mistakeId || (m.questionId === qId && m.testId === testId));
        if (dupIdx !== -1) {
          localMistakesArr[dupIdx] = mistakeData;
        } else {
          localMistakesArr.unshift(mistakeData);
        }
      }
    }

    localStorage.setItem('rbi_mistake_entries_v1', JSON.stringify(localMistakesArr));
  } catch (err) {
    console.error('Error generating mistake entries:', err);
  }

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
  const newPerSubjectScores = computePerSubjectScores(testData, updatedQuestions, updatedEvals);

  const docRef = doc(db, 'tests', testId);
  const payload = sanitizeForFirestore({
    userId,
    isEvaluated: true,
    questions: updatedQuestions,
    evaluations: updatedEvals,
    totalScore: newTotalScore,
    sectionScores: newSectionScores,
    perSubjectScores: newPerSubjectScores
  });

  await updateDoc(docRef, payload);

  return {
    ...testData,
    ...payload,
    id: testId
  };
}
