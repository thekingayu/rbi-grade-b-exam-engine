import { User } from 'firebase/auth';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, TestAttempt } from '../types';
import {
  buildFirestoreErrorInfo,
  handleFirestoreError,
  OperationType,
  sanitizeForFirestore,
} from './firestore';

// In-memory store for instant exam launch without a redundant Firestore read roundtrip
const preloadedTestsCache = new Map<string, TestAttempt>();
const pendingTestWrites = new Map<string, Promise<{ ok: boolean; error?: string }>>();

export function getPreloadedTest(testId: string): TestAttempt | undefined {
  return preloadedTestsCache.get(testId);
}

export function clearPreloadedTest(testId: string): void {
  preloadedTestsCache.delete(testId);
}

export async function waitForPendingTestWrite(
  testId: string
): Promise<{ ok: boolean; error?: string }> {
  const pending = pendingTestWrites.get(testId);
  if (pending) {
    return await pending;
  }
  return { ok: true };
}

/**
 * Clones a past TestAttempt into a brand-new, unattempted exam using the
 * already-loaded questions from Firestore (or fetching once only if missing),
 * caches the fresh attempt in memory for instant (<5ms) CBT launch, and
 * persists the new document to Firestore in the background.
 */
export async function createFreshReattemptTest(
  sourceTest: TestAttempt,
  user: User
): Promise<string> {
  if (!user?.uid) {
    throw new Error('You must be signed in to reattempt an exam.');
  }

  let resolvedSource = sourceTest;
  if (!Array.isArray(resolvedSource.questions) || resolvedSource.questions.length === 0) {
    try {
      const snap = await getDoc(doc(db, 'tests', sourceTest.id));
      if (snap.exists()) {
        resolvedSource = { id: snap.id, ...(snap.data() as Omit<TestAttempt, 'id'>) };
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tests/${sourceTest.id}`, user);
    }
  }

  if (!Array.isArray(resolvedSource.questions) || resolvedSource.questions.length === 0) {
    throw new Error('This past exam has no saved questions available to reattempt.');
  }

  const cleanQuestions: Question[] = resolvedSource.questions.map((q, idx) => {
    const {
      userAnswer: _ua,
      score: _sc,
      isCorrect: _ic,
      timeSpentSeconds: _ts,
      confidence: _cf,
      ...rest
    } = q;

    return {
      ...rest,
      id: rest.id || `q_${idx}`,
    };
  });

  const now = Date.now();
  const newDocRef = doc(collection(db, 'tests'));

  const cleanPayload: Record<string, any> = {
    userId: user.uid,
    createdAt: now,
    startedAt: now,
    status: 'in-progress',
    subjectId: resolvedSource.subjectId || 'sub_ga',
    subjectSlug: resolvedSource.subjectSlug || 'general-awareness',
    config: resolvedSource.config
      ? { ...resolvedSource.config }
      : {
          mcqStatic: cleanQuestions.filter(q => q.type === 'MCQ' && q.sourceTag === 'Static').length,
          mcqDynamic: cleanQuestions.filter(q => q.type === 'MCQ' && q.sourceTag === 'Dynamic').length,
          descStatic: cleanQuestions.filter(q => q.type === 'Descriptive' && q.sourceTag === 'Static').length,
          descDynamic: cleanQuestions.filter(q => q.type === 'Descriptive' && q.sourceTag === 'Dynamic').length,
        },
    sourceNoteFileRefs: Array.isArray(resolvedSource.sourceNoteFileRefs)
      ? [...resolvedSource.sourceNoteFileRefs]
      : [],
    extractedNotesText: resolvedSource.extractedNotesText || '',
    durationSeconds: resolvedSource.durationSeconds || 1800,
    negativeMarks: typeof resolvedSource.negativeMarks === 'number' ? resolvedSource.negativeMarks : 0,
    questions: cleanQuestions,
    answers: {},
    reattemptOfTestId: resolvedSource.id,
  };

  if (resolvedSource.subjectName) cleanPayload.subjectName = resolvedSource.subjectName;
  if (resolvedSource.mode) cleanPayload.mode = resolvedSource.mode;
  if (resolvedSource.targetTopic) cleanPayload.targetTopic = resolvedSource.targetTopic;
  if (typeof resolvedSource.isFullPhaseExam === 'boolean') {
    cleanPayload.isFullPhaseExam = resolvedSource.isFullPhaseExam;
  }
  if (resolvedSource.phaseExamType) cleanPayload.phaseExamType = resolvedSource.phaseExamType;
  if (Array.isArray(resolvedSource.sections) && resolvedSource.sections.length > 0) {
    cleanPayload.sections = resolvedSource.sections.map(sec => ({ ...sec }));
  }
  if (typeof resolvedSource.sectionalTimingEnabled === 'boolean') {
    cleanPayload.sectionalTimingEnabled = resolvedSource.sectionalTimingEnabled;
  }

  const sanitized = sanitizeForFirestore(cleanPayload);
  const fullPreloadedTest: TestAttempt = {
    id: newDocRef.id,
    ...(sanitized as Omit<TestAttempt, 'id'>),
  };

  // Cache synchronously so Exam page renders immediately without a redundant Firestore download
  preloadedTestsCache.set(newDocRef.id, fullPreloadedTest);

  // Persist to Firestore in background and track promise so Submit/Terminate never races
  const writePromise = setDoc(newDocRef, sanitized)
    .then(() => ({ ok: true as const }))
    .catch((err) => {
      const errInfo = buildFirestoreErrorInfo(
        err,
        OperationType.CREATE,
        `tests/${newDocRef.id}`,
        user
      );
      console.error('Background Firestore save error for reattempt:', JSON.stringify(errInfo));
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    })
    .finally(() => {
      pendingTestWrites.delete(newDocRef.id);
    });

  pendingTestWrites.set(newDocRef.id, writePromise);

  return newDocRef.id;
}
