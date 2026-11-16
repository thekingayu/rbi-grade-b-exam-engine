import { User } from 'firebase/auth';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, TestAttempt } from '../types';
import { handleFirestoreError, OperationType, sanitizeForFirestore } from './firestore';

/**
 * Creates a brand-new, unattempted Firestore test document cloned from a past TestAttempt.
 * Preserves the exact questions, sections, rubrics, model answers, and exam configuration
 * while clearing all prior answers, scores, timestamps, and evaluations.
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

  const cleanPayload: Record<string, any> = {
    userId: user.uid,
    createdAt: Date.now(),
    status: 'setup',
    subjectId: resolvedSource.subjectId || 'sub_ga',
    subjectSlug: resolvedSource.subjectSlug || 'general-awareness',
    config: resolvedSource.config ? { ...resolvedSource.config } : {
      mcqStatic: cleanQuestions.filter(q => q.type === 'MCQ' && q.sourceTag === 'Static').length,
      mcqDynamic: cleanQuestions.filter(q => q.type === 'MCQ' && q.sourceTag === 'Dynamic').length,
      descStatic: cleanQuestions.filter(q => q.type === 'Descriptive' && q.sourceTag === 'Static').length,
      descDynamic: cleanQuestions.filter(q => q.type === 'Descriptive' && q.sourceTag === 'Dynamic').length,
    },
    sourceNoteFileRefs: Array.isArray(resolvedSource.sourceNoteFileRefs) ? [...resolvedSource.sourceNoteFileRefs] : [],
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

  try {
    const sanitized = sanitizeForFirestore(cleanPayload);
    const docRef = await addDoc(collection(db, 'tests'), sanitized);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'tests', user);
  }
}
