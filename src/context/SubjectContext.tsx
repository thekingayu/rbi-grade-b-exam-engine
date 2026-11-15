import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Subject, SubjectNote, MistakeEntry, TestAttempt, UserProfile } from '../types';
import { INITIAL_SUBJECTS } from '../data/subjects';
import { sanitizeForFirestore } from '../utils/firestore';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface SubjectContextType {
  subjects: Subject[];
  activeSubject: Subject | null;
  setActiveSubject: (subject: Subject | null) => void;
  targetExamDate: string;
  setTargetExamDate: (date: string) => void;
  targetScoreGoal: number;
  setTargetScoreGoal: (score: number) => void;
  userProfile: UserProfile | null;
  updateUserProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  syllabusProgress: Record<string, boolean>;
  updateSyllabusProgress: (nextProgress: Record<string, boolean>) => void;
  notes: SubjectNote[];
  addNote: (note: Omit<SubjectNote, 'id' | 'uploadedAt'>) => SubjectNote;
  deleteNote: (id: string) => void;
  mistakes: MistakeEntry[];
  recordMistake: (mistake: Omit<MistakeEntry, 'id' | 'createdAt' | 'reviewCount'>) => void;
  updateMistakeBox: (id: string, promoted: boolean) => void;
  deleteMistake: (id: string) => void;
  updateSubject: (updated: Subject) => void;
  resetSubjectsToDefault: () => void;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  refreshSync: () => Promise<void>;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

const LEGACY_STORAGE_KEYS = [
  'rbi_subjects_custom_v1',
  'rbi_target_exam_date_v1',
  'rbi_target_score_goal_v1',
  'rbi_user_profile_v1',
  'rbi_subject_notes_v1',
  'rbi_mistake_entries_v1',
  'rbi_syllabus_progress'
];

const getScopedKey = (uid: string | null | undefined, key: string) =>
  uid ? `rbi_sync_${uid}_${key}` : `rbi_guest_${key}`;

const safeReadStorage = <T,>(uid: string | null | undefined, key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(getScopedKey(uid, key));
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore corrupted JSON
  }
  return fallback;
};

const safeWriteStorage = (uid: string | null | undefined, key: string, value: unknown) => {
  if (!uid) return;
  try {
    localStorage.setItem(getScopedKey(uid, key), typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
};

const clearLegacyUnscopedCaches = () => {
  try {
    LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
};

const DEFAULT_TARGET_DATE = '2026-09-12';
const DEFAULT_SCORE_GOAL = 75;
const DEFAULT_BIO = 'Aspiring RBI Grade B Officer · Preparing for Phase 1 & Phase 2 examination';

const isSyntheticSyncNote = (id: string, data: any): boolean => {
  if (!id && !data) return true;
  if (id.startsWith('profile_sync_') || id.startsWith('note_profile_')) return true;
  if (data?.type === 'profile_sync' || data?.fileType === 'profile') return true;
  return false;
};

export const SubjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialUid = auth.currentUser?.uid || null;

  const [subjects, setSubjects] = useState<Subject[]>(() =>
    safeReadStorage<Subject[]>(initialUid, 'subjects', INITIAL_SUBJECTS)
  );
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [targetExamDate, setTargetExamDateState] = useState<string>(() => {
    try {
      return (initialUid && localStorage.getItem(getScopedKey(initialUid, 'exam_date'))) || DEFAULT_TARGET_DATE;
    } catch {
      return DEFAULT_TARGET_DATE;
    }
  });
  const [targetScoreGoal, setTargetScoreGoalState] = useState<number>(() => {
    try {
      const saved = initialUid ? localStorage.getItem(getScopedKey(initialUid, 'score_goal')) : null;
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : DEFAULT_SCORE_GOAL;
    } catch {
      return DEFAULT_SCORE_GOAL;
    }
  });
  const [syllabusProgress, setSyllabusProgressState] = useState<Record<string, boolean>>(() =>
    safeReadStorage<Record<string, boolean>>(initialUid, 'syllabus', {})
  );
  const [notes, setNotes] = useState<SubjectNote[]>(() =>
    safeReadStorage<SubjectNote[]>(initialUid, 'notes', [])
  );
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() =>
    safeReadStorage<MistakeEntry[]>(initialUid, 'mistakes', [])
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() =>
    safeReadStorage<UserProfile | null>(initialUid, 'profile', null)
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Refs to coordinate multi-target sync, conflict ordering, and latest React state
  const currentUserIdRef = useRef<string | null>(initialUid);
  const backfillDoneRef = useRef<boolean>(false);
  const lastAppliedTsRef = useRef<number>(0);
  const lastServerFetchAtRef = useRef<number>(0);

  const stateRef = useRef({
    subjects,
    targetExamDate,
    targetScoreGoal,
    syllabusProgress,
    userProfile
  });

  useEffect(() => {
    stateRef.current = {
      subjects,
      targetExamDate,
      targetScoreGoal,
      syllabusProgress,
      userProfile
    };
  }, [subjects, targetExamDate, targetScoreGoal, syllabusProgress, userProfile]);

  const applyProfileData = useCallback((data: any, uidOverride?: string) => {
    if (!data) return;
    const uid = uidOverride || currentUserIdRef.current || auth.currentUser?.uid;
    if (!uid) return;

    const rawProfile = data.profile || {};
    const incomingTs = Number(data.updatedAt || rawProfile.updatedAt || 0);

    // Reject older snapshots when we already applied a fresher state
    if (lastAppliedTsRef.current > 0 && incomingTs > 0 && incomingTs < lastAppliedTsRef.current) {
      return;
    }
    if (incomingTs > lastAppliedTsRef.current) {
      lastAppliedTsRef.current = incomingTs;
    }

    const nextDate = data.targetExamDate || rawProfile.targetExamDate;
    if (typeof nextDate === 'string' && nextDate.trim()) {
      setTargetExamDateState(nextDate);
      safeWriteStorage(uid, 'exam_date', nextDate);
    }

    const nextGoal =
      typeof data.targetScoreGoal === 'number'
        ? data.targetScoreGoal
        : typeof rawProfile.targetScoreGoal === 'number'
          ? rawProfile.targetScoreGoal
          : undefined;
    if (typeof nextGoal === 'number' && Number.isFinite(nextGoal)) {
      setTargetScoreGoalState(nextGoal);
      safeWriteStorage(uid, 'score_goal', nextGoal.toString());
    }

    if (Array.isArray(data.customSubjects) && data.customSubjects.length > 0) {
      setSubjects(data.customSubjects);
      safeWriteStorage(uid, 'subjects', data.customSubjects);
    }

    const incomingSyllabus = data.syllabusProgress || rawProfile.syllabusProgress;
    if (incomingSyllabus && typeof incomingSyllabus === 'object' && !Array.isArray(incomingSyllabus)) {
      setSyllabusProgressState(incomingSyllabus);
      safeWriteStorage(uid, 'syllabus', incomingSyllabus);
    }

    const currentAuth = auth.currentUser;

    // Determine whether photoURL was explicitly provided in Firestore (including empty string to allow clearing)
    const hasExplicitProfilePhoto = Object.prototype.hasOwnProperty.call(rawProfile, 'photoURL');
    const hasExplicitTopPhoto = Object.prototype.hasOwnProperty.call(data, 'photoURL');

    let resolvedPhoto = '';
    if (hasExplicitProfilePhoto) {
      resolvedPhoto = typeof rawProfile.photoURL === 'string' ? rawProfile.photoURL.trim() : '';
    } else if (hasExplicitTopPhoto) {
      resolvedPhoto = typeof data.photoURL === 'string' ? data.photoURL.trim() : '';
    } else {
      resolvedPhoto = currentAuth?.photoURL || '';
    }

    const mergedProfile: UserProfile = {
      displayName:
        rawProfile.displayName ??
        data.displayName ??
        currentAuth?.displayName ??
        currentAuth?.email?.split('@')[0] ??
        'Cadre Officer',
      photoURL: resolvedPhoto,
      email: rawProfile.email ?? data.email ?? currentAuth?.email ?? '',
      stream: rawProfile.stream ?? data.stream ?? 'General',
      category: rawProfile.category ?? data.category ?? 'General',
      attemptCount: rawProfile.attemptCount ?? data.attemptCount ?? '1st Attempt',
      dailyStudyHours:
        typeof rawProfile.dailyStudyHours === 'number'
          ? rawProfile.dailyStudyHours
          : typeof data.dailyStudyHours === 'number'
            ? data.dailyStudyHours
            : 4,
      educationBackground:
        rawProfile.educationBackground ?? data.educationBackground ?? 'Commerce / Economics',
      bio: rawProfile.bio ?? data.bio ?? DEFAULT_BIO,
      phone: rawProfile.phone ?? data.phone ?? '',
      targetExamYear: rawProfile.targetExamYear ?? data.targetExamYear ?? '2026-27',
      targetExamDate: nextDate || stateRef.current.targetExamDate || DEFAULT_TARGET_DATE,
      targetScoreGoal: nextGoal ?? stateRef.current.targetScoreGoal ?? DEFAULT_SCORE_GOAL,
      syllabusProgress: incomingSyllabus || stateRef.current.syllabusProgress || {},
      updatedAt: incomingTs || Date.now()
    };

    setUserProfile(mergedProfile);
    safeWriteStorage(uid, 'profile', mergedProfile);
    setLastSyncedAt(Date.now());
    setSyncStatus('synced');
  }, []);

  // Helper to fetch a doc directly from server first, falling back to cache when offline
  const fetchDocServerFirst = async (docRef: ReturnType<typeof doc>) => {
    try {
      return await getDocFromServer(docRef);
    } catch {
      return await getDoc(docRef);
    }
  };

  const fetchLatestProfileFromServer = useCallback(async (userId: string) => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastServerFetchAtRef.current < 1200) return;
    lastServerFetchAtRef.current = now;

    try {
      const [userSnap, settingsSnap, syncSnap] = await Promise.allSettled([
        fetchDocServerFirst(doc(db, 'users', userId)),
        fetchDocServerFirst(doc(db, 'userSettings', userId)),
        fetchDocServerFirst(doc(db, 'notes', 'profile_sync_' + userId))
      ]);

      const candidates: Array<{ data: any; ts: number }> = [];
      [syncSnap, settingsSnap, userSnap].forEach((res) => {
        if (res.status === 'fulfilled' && res.value.exists()) {
          const d = res.value.data();
          const ts = Number(d?.updatedAt || d?.profile?.updatedAt || 0);
          candidates.push({ data: d, ts });
        }
      });

      if (candidates.length > 0) {
        // Apply oldest -> newest so the highest updatedAt doc wins deterministically
        candidates.sort((a, b) => a.ts - b.ts);
        candidates.forEach((c) => applyProfileData(c.data, userId));
      } else if (auth.currentUser && !stateRef.current.userProfile) {
        // Bootstrap initial profile from Firebase Auth for brand new account
        const u = auth.currentUser;
        const starter: UserProfile = {
          displayName: u.displayName || u.email?.split('@')[0] || 'Cadre Officer',
          photoURL: u.photoURL || '',
          email: u.email || '',
          stream: 'General',
          category: 'General',
          attemptCount: '1st Attempt',
          dailyStudyHours: 4,
          educationBackground: 'Commerce / Economics',
          bio: DEFAULT_BIO,
          phone: '',
          targetExamYear: '2026-27',
          targetExamDate: DEFAULT_TARGET_DATE,
          targetScoreGoal: DEFAULT_SCORE_GOAL,
          syllabusProgress: {},
          updatedAt: 0
        };
        setUserProfile(starter);
      }
    } catch (e) {
      console.warn('Server profile fetch notice:', e);
    }
  }, [applyProfileData]);

  const refreshSync = useCallback(async () => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    if (!uid) return;
    lastServerFetchAtRef.current = 0;
    await fetchLatestProfileFromServer(uid);
  }, [fetchLatestProfileFromServer]);

  // Real-time Firestore synchronizer for authenticated user
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    const resetStateForSignedOut = () => {
      currentUserIdRef.current = null;
      backfillDoneRef.current = false;
      lastAppliedTsRef.current = 0;
      lastServerFetchAtRef.current = 0;
      setSubjects(INITIAL_SUBJECTS);
      setActiveSubject(null);
      setTargetExamDateState(DEFAULT_TARGET_DATE);
      setTargetScoreGoalState(DEFAULT_SCORE_GOAL);
      setSyllabusProgressState({});
      setNotes([]);
      setMistakes([]);
      setUserProfile(null);
      setSyncStatus('idle');
      setLastSyncedAt(null);
    };

    const hydrateUidLocalCacheFirst = (uid: string) => {
      clearLegacyUnscopedCaches();
      setSubjects(safeReadStorage<Subject[]>(uid, 'subjects', INITIAL_SUBJECTS));
      try {
        setTargetExamDateState(localStorage.getItem(getScopedKey(uid, 'exam_date')) || DEFAULT_TARGET_DATE);
        const savedGoal = localStorage.getItem(getScopedKey(uid, 'score_goal'));
        const parsed = savedGoal ? parseInt(savedGoal, 10) : NaN;
        setTargetScoreGoalState(Number.isFinite(parsed) ? parsed : DEFAULT_SCORE_GOAL);
      } catch {
        setTargetExamDateState(DEFAULT_TARGET_DATE);
        setTargetScoreGoalState(DEFAULT_SCORE_GOAL);
      }
      setSyllabusProgressState(safeReadStorage<Record<string, boolean>>(uid, 'syllabus', {}));
      setNotes(safeReadStorage<SubjectNote[]>(uid, 'notes', []));
      setMistakes(safeReadStorage<MistakeEntry[]>(uid, 'mistakes', []));
      const cachedProf = safeReadStorage<UserProfile | null>(uid, 'profile', null);
      setUserProfile(cachedProf);
      lastAppliedTsRef.current = Number(cachedProf?.updatedAt || 0);
    };

    const setupListeners = async (userId: string) => {
      const prevUid = currentUserIdRef.current;
      if (prevUid !== userId) {
        backfillDoneRef.current = false;
        lastServerFetchAtRef.current = 0;
        hydrateUidLocalCacheFirst(userId);
      }
      currentUserIdRef.current = userId;

      // Immediately pull fresh server state before real-time listeners settle
      await fetchLatestProfileFromServer(userId);

      // 1. Primary Users document listener
      try {
        const unsubUser = onSnapshot(
          doc(db, 'users', userId),
          (snap) => {
            if (snap.exists()) applyProfileData(snap.data(), userId);
          },
          (err) => {
            console.warn('Primary users listener notice:', err);
          }
        );
        unsubs.push(unsubUser);
      } catch (err) {
        console.warn('Error setting up user listener:', err);
      }

      // 2. Secondary UserSettings document listener
      try {
        const unsubSettings = onSnapshot(
          doc(db, 'userSettings', userId),
          (snap) => {
            if (snap.exists()) applyProfileData(snap.data(), userId);
          },
          () => {}
        );
        unsubs.push(unsubSettings);
      } catch {
        // ignore
      }

      // 3. Universal profile_sync document listener (fallback access under notes security rules)
      try {
        const unsubSyncDoc = onSnapshot(
          doc(db, 'notes', 'profile_sync_' + userId),
          (snap) => {
            if (snap.exists()) applyProfileData(snap.data(), userId);
          },
          () => {}
        );
        unsubs.push(unsubSyncDoc);
      } catch {
        // ignore
      }

      // 4. Real-time Mistakes listener
      try {
        const mistakesQuery = query(collection(db, 'mistakes'), where('userId', '==', userId));
        const unsubMistakes = onSnapshot(
          mistakesQuery,
          (snapshot) => {
            const fsMistakes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MistakeEntry[];
            const sorted = fsMistakes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setMistakes(sorted);
            safeWriteStorage(userId, 'mistakes', sorted);
          },
          (err) => {
            console.warn('Mistakes listener warning:', err);
          }
        );
        unsubs.push(unsubMistakes);
      } catch (err) {
        console.warn('Error setting up mistakes listener:', err);
      }

      // 5. Real-time Notes listener (excluding synthetic sync documents)
      try {
        const notesQuery = query(collection(db, 'notes'), where('userId', '==', userId));
        const unsubNotes = onSnapshot(
          notesQuery,
          (snapshot) => {
            const fsNotes: SubjectNote[] = [];
            snapshot.docs.forEach((d) => {
              const data = d.data();
              if (d.id === 'profile_sync_' + userId || data.type === 'profile_sync') {
                applyProfileData(data, userId);
              } else if (!isSyntheticSyncNote(d.id, data)) {
                fsNotes.push({ id: d.id, ...data } as SubjectNote);
              }
            });
            fsNotes.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
            setNotes(fsNotes);
            safeWriteStorage(userId, 'notes', fsNotes);
          },
          (err) => {
            console.warn('Notes listener warning:', err);
          }
        );
        unsubs.push(unsubNotes);
      } catch (err) {
        console.warn('Error setting up notes listener:', err);
      }

      // 6. One-time comprehensive mistake backfill from historical tests
      if (!backfillDoneRef.current) {
        backfillDoneRef.current = true;
        try {
          const testsQuery = query(collection(db, 'tests'), where('userId', '==', userId));
          const testsSnap = await getDocs(testsQuery);
          const tests = testsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TestAttempt[];

          for (const test of tests) {
            if (test.status !== 'completed' || !Array.isArray(test.questions)) continue;
            const answersMap: Record<string, string> = { ...(test.answers || {}) };
            const evals: Record<string, any> = { ...(test.evaluations || {}) };
            const subjectId = test.subjectId || 'general-awareness';
            const subjectSlug = test.subjectSlug || 'general-awareness';

            for (let idx = 0; idx < test.questions.length; idx++) {
              const q = test.questions[idx];
              const qId = q.id || idx.toString();
              const userAns = q.userAnswer || answersMap[qId] || answersMap[idx.toString()] || null;

              let isMistake = false;
              let reason = '';

              if (q.type === 'MCQ') {
                if (!userAns || userAns.trim() === '') {
                  isMistake = true;
                  reason = 'Skipped / Unattempted MCQ';
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
                const mistakeId = `mistake_${test.id}_${qId}`;
                const mistakeDoc = sanitizeForFirestore({
                  id: mistakeId,
                  userId,
                  testId: test.id,
                  subjectId,
                  subjectSlug,
                  questionId: qId,
                  type: q.type,
                  topic: q.topic || 'General Theory',
                  difficulty: q.difficulty || 'Moderate',
                  text: q.text,
                  options: q.options || null,
                  userAnswer: userAns || null,
                  correctAnswer:
                    q.correctAnswer || (q.type === 'Descriptive' ? q.modelAnswer : null) || null,
                  explanation: q.explanation || evals[qId]?.evaluationSummary || reason,
                  leitnerBox: 1,
                  reviewCount: 0,
                  createdAt: test.createdAt || Date.now(),
                  nextReviewDue: Date.now() + 24 * 60 * 60 * 1000
                });

                setDoc(doc(db, 'mistakes', mistakeId), mistakeDoc, { merge: true }).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.warn('Mistake backfill notice:', err);
        }
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubs.forEach((fn) => fn());
      unsubs = [];

      if (user) {
        setupListeners(user.uid);
      } else {
        resetStateForSignedOut();
      }
    });

    // Cross-tab instant sync + mobile tab wake-up server sync
    const handleStorageChange = (e: StorageEvent) => {
      const uid = currentUserIdRef.current;
      if (!uid || !e.newValue) return;
      if (e.key === getScopedKey(uid, 'profile')) {
        try {
          const parsed = JSON.parse(e.newValue) as UserProfile;
          if ((parsed.updatedAt || 0) >= lastAppliedTsRef.current) {
            lastAppliedTsRef.current = parsed.updatedAt || Date.now();
            setUserProfile(parsed);
          }
        } catch {}
      }
      if (e.key === getScopedKey(uid, 'exam_date')) {
        setTargetExamDateState(e.newValue);
      }
      if (e.key === getScopedKey(uid, 'score_goal')) {
        const val = parseInt(e.newValue, 10);
        if (Number.isFinite(val)) setTargetScoreGoalState(val);
      }
      if (e.key === getScopedKey(uid, 'syllabus')) {
        try {
          setSyllabusProgressState(JSON.parse(e.newValue));
        } catch {}
      }
    };

    const handleResumeSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const uid = currentUserIdRef.current || auth.currentUser?.uid;
      if (uid) {
        fetchLatestProfileFromServer(uid);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleResumeSync);
    window.addEventListener('online', handleResumeSync);
    document.addEventListener('visibilitychange', handleResumeSync);

    return () => {
      unsubscribeAuth();
      unsubs.forEach((fn) => fn());
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleResumeSync);
      window.removeEventListener('online', handleResumeSync);
      document.removeEventListener('visibilitychange', handleResumeSync);
    };
  }, [applyProfileData, fetchLatestProfileFromServer]);

  // Unified multi-target Firestore writer keeping all 3 sync documents identical
  const persistSyncedState = useCallback(
    async (
      uid: string,
      overrides: {
        profile?: UserProfile;
        targetExamDate?: string;
        targetScoreGoal?: number;
        customSubjects?: Subject[];
        syllabusProgress?: Record<string, boolean>;
      }
    ) => {
      const nowTs = Date.now();
      lastAppliedTsRef.current = nowTs;
      setSyncStatus('syncing');

      const cur = stateRef.current;
      const nextDate = overrides.targetExamDate ?? cur.targetExamDate ?? DEFAULT_TARGET_DATE;
      const nextGoal = overrides.targetScoreGoal ?? cur.targetScoreGoal ?? DEFAULT_SCORE_GOAL;
      const nextSubjects = overrides.customSubjects ?? cur.subjects ?? INITIAL_SUBJECTS;
      const nextSyllabus = overrides.syllabusProgress ?? cur.syllabusProgress ?? {};
      const currentAuth = auth.currentUser;

      const baseProfile: UserProfile = {
        displayName:
          currentAuth?.displayName || currentAuth?.email?.split('@')[0] || 'Cadre Officer',
        photoURL: currentAuth?.photoURL || '',
        email: currentAuth?.email || '',
        stream: 'General',
        category: 'General',
        attemptCount: '1st Attempt',
        dailyStudyHours: 4,
        educationBackground: 'Commerce / Economics',
        bio: DEFAULT_BIO,
        phone: '',
        targetExamYear: '2026-27',
        ...(cur.userProfile || {}),
        ...(overrides.profile || {}),
        targetExamDate: nextDate,
        targetScoreGoal: nextGoal,
        syllabusProgress: nextSyllabus,
        updatedAt: nowTs
      };

      const payload = sanitizeForFirestore({
        id: 'profile_sync_' + uid,
        userId: uid,
        type: 'profile_sync',
        profile: sanitizeForFirestore(baseProfile),
        displayName: baseProfile.displayName || 'Cadre Officer',
        photoURL: baseProfile.photoURL ?? '',
        email: baseProfile.email || '',
        stream: baseProfile.stream || 'General',
        category: baseProfile.category || 'General',
        attemptCount: baseProfile.attemptCount || '1st Attempt',
        dailyStudyHours: baseProfile.dailyStudyHours ?? 4,
        educationBackground: baseProfile.educationBackground || 'Commerce / Economics',
        bio: baseProfile.bio ?? '',
        phone: baseProfile.phone ?? '',
        targetExamDate: nextDate,
        targetScoreGoal: nextGoal,
        targetExamYear: baseProfile.targetExamYear || '2026-27',
        customSubjects: nextSubjects,
        syllabusProgress: nextSyllabus,
        updatedAt: nowTs
      });

      const writes = [
        setDoc(doc(db, 'users', uid), payload, { merge: true }),
        setDoc(doc(db, 'userSettings', uid), payload, { merge: true }),
        setDoc(doc(db, 'notes', 'profile_sync_' + uid), payload, { merge: true })
      ];

      const results = await Promise.allSettled(writes);
      const anySuccess = results.some((r) => r.status === 'fulfilled');

      if (!anySuccess) {
        setSyncStatus('error');
        const firstRejected = results.find((r) => r.status === 'rejected') as
          | PromiseRejectedResult
          | undefined;
        throw new Error(
          firstRejected?.reason?.message ||
            'Cloud sync failed. Please check your internet connection and permissions.'
        );
      }

      setLastSyncedAt(nowTs);
      setSyncStatus('synced');
    },
    []
  );

  // Save changes & broadcast to all 3 Firestore sync targets
  const setTargetExamDate = (date: string) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    setTargetExamDateState(date);
    safeWriteStorage(uid, 'exam_date', date);
    if (userProfile) {
      const updatedProf = { ...userProfile, targetExamDate: date, updatedAt: Date.now() };
      setUserProfile(updatedProf);
      safeWriteStorage(uid, 'profile', updatedProf);
    }
    if (uid) {
      persistSyncedState(uid, { targetExamDate: date }).catch((err) =>
        console.error('Exam date sync error:', err)
      );
    }
  };

  const setTargetScoreGoal = (score: number) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    setTargetScoreGoalState(score);
    safeWriteStorage(uid, 'score_goal', score.toString());
    if (userProfile) {
      const updatedProf = { ...userProfile, targetScoreGoal: score, updatedAt: Date.now() };
      setUserProfile(updatedProf);
      safeWriteStorage(uid, 'profile', updatedProf);
    }
    if (uid) {
      persistSyncedState(uid, { targetScoreGoal: score }).catch((err) =>
        console.error('Score goal sync error:', err)
      );
    }
  };

  const updateSyllabusProgress = (nextProgress: Record<string, boolean>) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    setSyllabusProgressState(nextProgress);
    safeWriteStorage(uid, 'syllabus', nextProgress);
    if (uid) {
      persistSyncedState(uid, { syllabusProgress: nextProgress }).catch((err) =>
        console.error('Syllabus progress sync error:', err)
      );
    }
  };

  const updateSubject = (updated: Subject) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    setSubjects((prev) => {
      const next = prev.map((s) => (s.id === updated.id ? updated : s));
      safeWriteStorage(uid, 'subjects', next);
      if (uid) {
        persistSyncedState(uid, { customSubjects: next }).catch((err) =>
          console.error('Subject update sync error:', err)
        );
      }
      return next;
    });
    if (activeSubject && activeSubject.id === updated.id) {
      setActiveSubject(updated);
    }
  };

  const resetSubjectsToDefault = () => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    setSubjects(INITIAL_SUBJECTS);
    safeWriteStorage(uid, 'subjects', INITIAL_SUBJECTS);
    if (uid) {
      persistSyncedState(uid, { customSubjects: INITIAL_SUBJECTS }).catch((err) =>
        console.error('Subject reset sync error:', err)
      );
    }
  };

  const addNote = (noteData: Omit<SubjectNote, 'id' | 'uploadedAt'>): SubjectNote => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid || '';
    const newNote: SubjectNote = {
      ...noteData,
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(7),
      userId: uid,
      uploadedAt: Date.now()
    };

    setNotes((prev) => {
      const next = [newNote, ...prev];
      safeWriteStorage(uid, 'notes', next);
      return next;
    });

    if (uid) {
      setDoc(doc(db, 'notes', newNote.id), sanitizeForFirestore(newNote), { merge: true }).catch(
        console.error
      );
    }

    return newNote;
  };

  const deleteNote = (id: string) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid || '';
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      safeWriteStorage(uid, 'notes', next);
      return next;
    });

    deleteDoc(doc(db, 'notes', id)).catch(console.error);
  };

  const recordMistake = (data: Omit<MistakeEntry, 'id' | 'createdAt' | 'reviewCount'>) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid || '';
    setMistakes((prev) => {
      const existingIdx = prev.findIndex(
        (m) => m.questionId === data.questionId && m.testId === data.testId
      );
      if (existingIdx !== -1) return prev;

      const newEntry: MistakeEntry = {
        ...data,
        id: 'mistake_' + Date.now() + '_' + Math.random().toString(36).substring(7),
        userId: uid,
        createdAt: Date.now(),
        reviewCount: 0,
        leitnerBox: data.leitnerBox || 1,
        nextReviewDue: Date.now() + 24 * 60 * 60 * 1000
      };
      const next = [newEntry, ...prev];
      safeWriteStorage(uid, 'mistakes', next);

      if (uid) {
        setDoc(doc(db, 'mistakes', newEntry.id), sanitizeForFirestore(newEntry), {
          merge: true
        }).catch(console.error);
      }

      return next;
    });
  };

  const updateMistakeBox = (id: string, promoted: boolean) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid || '';
    setMistakes((prev) => {
      const next = prev.map((m) => {
        if (m.id !== id) return m;
        const newBox = promoted ? Math.min(5, m.leitnerBox + 1) : 1;
        const intervals = [1, 3, 7, 14, 30];
        const days = intervals[newBox - 1] || 1;
        const updated = {
          ...m,
          userId: uid || m.userId,
          leitnerBox: newBox,
          reviewCount: m.reviewCount + 1,
          lastReviewedAt: Date.now(),
          nextReviewDue: Date.now() + days * 24 * 60 * 60 * 1000
        };

        if (uid) {
          setDoc(doc(db, 'mistakes', id), sanitizeForFirestore(updated), { merge: true }).catch(
            console.error
          );
        }

        return updated;
      });
      safeWriteStorage(uid, 'mistakes', next);
      return next;
    });
  };

  const deleteMistake = (id: string) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid || '';
    setMistakes((prev) => {
      const next = prev.filter((m) => m.id !== id);
      safeWriteStorage(uid, 'mistakes', next);
      return next;
    });

    deleteDoc(doc(db, 'mistakes', id)).catch(console.error);
  };

  const updateUserProfile = async (profileData: Partial<UserProfile>) => {
    const currentAuth = auth.currentUser;
    const uid = currentAuth?.uid || currentUserIdRef.current;
    const nowTs = Date.now();
    lastAppliedTsRef.current = nowTs;

    const merged: UserProfile = {
      displayName: currentAuth?.displayName || currentAuth?.email?.split('@')[0] || 'Cadre Officer',
      photoURL: currentAuth?.photoURL || '',
      email: currentAuth?.email || '',
      stream: 'General',
      category: 'General',
      attemptCount: '1st Attempt',
      dailyStudyHours: 4,
      educationBackground: 'Commerce / Economics',
      bio: DEFAULT_BIO,
      phone: '',
      targetExamYear: '2026-27',
      ...(userProfile || {}),
      ...profileData,
      updatedAt: nowTs
    };

    // Update local state and uid-scoped cache immediately
    setUserProfile(merged);
    safeWriteStorage(uid, 'profile', merged);

    if (profileData.targetExamDate) {
      setTargetExamDateState(profileData.targetExamDate);
      safeWriteStorage(uid, 'exam_date', profileData.targetExamDate);
    }
    if (profileData.targetScoreGoal !== undefined) {
      setTargetScoreGoalState(profileData.targetScoreGoal);
      safeWriteStorage(uid, 'score_goal', profileData.targetScoreGoal.toString());
    }

    // Safely mirror public displayName & https URL photo into Firebase Auth
    if (currentAuth) {
      const authUpdates: { displayName?: string; photoURL?: string | null } = {};
      if (merged.displayName && merged.displayName.trim() !== '') {
        authUpdates.displayName = merged.displayName.trim();
      }
      if (typeof merged.photoURL === 'string') {
        if (merged.photoURL.startsWith('http://') || merged.photoURL.startsWith('https://')) {
          if (merged.photoURL.length <= 2048) {
            authUpdates.photoURL = merged.photoURL;
          }
        }
      }

      if (Object.keys(authUpdates).length > 0) {
        try {
          await updateProfile(currentAuth, authUpdates);
        } catch (authErr) {
          console.warn('Firebase Auth updateProfile note:', authErr);
        }
      }
    }

    if (uid) {
      await persistSyncedState(uid, {
        profile: merged,
        targetExamDate: profileData.targetExamDate,
        targetScoreGoal: profileData.targetScoreGoal
      });
    }
  };

  return (
    <SubjectContext.Provider
      value={{
        subjects,
        activeSubject,
        setActiveSubject,
        targetExamDate,
        setTargetExamDate,
        targetScoreGoal,
        setTargetScoreGoal,
        userProfile,
        updateUserProfile,
        syllabusProgress,
        updateSyllabusProgress,
        notes,
        addNote,
        deleteNote,
        mistakes,
        recordMistake,
        updateMistakeBox,
        deleteMistake,
        updateSubject,
        resetSubjectsToDefault,
        syncStatus,
        lastSyncedAt,
        refreshSync
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
};

export function useSubject() {
  const context = useContext(SubjectContext);
  if (!context) {
    throw new Error('useSubject must be used within a SubjectProvider');
  }
  return context;
}
