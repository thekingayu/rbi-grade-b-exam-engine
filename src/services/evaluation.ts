import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TestAttempt, Question } from '../types';
import { checkMCQCorrect } from '../utils/exam';
import { sanitizeForFirestore } from '../utils/firestore';

export interface EvaluationProgressCallback {
  (step: string, percent?: number): void;
}

/**
 * Evaluates all question responses for a test attempt and permanently stores the complete
 * results in Firestore, marking `isEvaluated: true`. Once this completes, opening past tests
 * will never re-trigger evaluations.
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

  let descProgressCount = 0;
  for (let i = 0; i < evaluatedQuestions.length; i++) {
    const q = evaluatedQuestions[i];
    if (q.type !== 'Descriptive') continue;

    const qId = q.id || i.toString();
    descProgressCount++;
    const progressPct = 20 + Math.round((descProgressCount / Math.max(1, descQuestions.length)) * 50);
    onProgress?.(`Evaluating descriptive answer ${descProgressCount} of ${descQuestions.length}...`, progressPct);

    // If already evaluated previously and has valid score, preserve it
    if (evals[qId] && typeof evals[qId].totalScore === 'number') {
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
        const res = await fetch('/api/evaluate-descriptive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, userAnswer: q.userAnswer })
        });

        if (res.ok) {
          const evalData = await res.json();
          const score = typeof evalData.totalScore === 'number' ? Number(evalData.totalScore.toFixed(2)) : 0;
          evals[qId] = {
            totalScore: score,
            scoreBreakdown: evalData.scoreBreakdown || { "Content Coverage": score },
            feedbackPoints: Array.isArray(evalData.feedbackPoints) ? evalData.feedbackPoints : ["Answer evaluated."],
            suggestions: Array.isArray(evalData.suggestions) ? evalData.suggestions : ["Structure response with headings."]
          };
          q.score = score;
          totalDescScore += score;
          if (q.sourceTag === 'Static') descStaticScore += score;
          else descDynamicScore += score;
        } else {
          throw new Error(`Server returned ${res.status}`);
        }
      } catch (e) {
        console.error(`Evaluation failed for question ${qId}`, e);
        // Resilient fallback evaluation
        evals[qId] = {
          totalScore: 0,
          scoreBreakdown: { "Submission Logged": 0 },
          feedbackPoints: ["Response was recorded for manual review."],
          suggestions: ["Ensure standard structure and complete coverage of prompt topics."]
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
  onProgress?.('Generating overall performance analysis & actionable steps...', 85);
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
    isEvaluated: true,
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
