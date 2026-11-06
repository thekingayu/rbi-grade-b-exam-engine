import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  collection, query, where, getDocs, setDoc, deleteDoc, doc, onSnapshot, getDoc 
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Subject, SubjectNote, MistakeEntry, TestAttempt, UserProfile } from '../types';
import { INITIAL_SUBJECTS } from '../data/subjects';
import { sanitizeForFirestore } from '../utils/firestore';

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
  notes: SubjectNote[];
  addNote: (note: Omit<SubjectNote, 'id' | 'uploadedAt'>) => SubjectNote;
  deleteNote: (id: string) => void;
  mistakes: MistakeEntry[];
  recordMistake: (mistake: Omit<MistakeEntry, 'id' | 'createdAt' | 'reviewCount'>) => void;
  updateMistakeBox: (id: string, promoted: boolean) => void;
  deleteMistake: (id: string) => void;
  updateSubject: (updated: Subject) => void;
  resetSubjectsToDefault: () => void;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

const STORAGE_KEYS = {
  SUBJECTS: 'rbi_subjects_custom_v1',
  EXAM_DATE: 'rbi_target_exam_date_v1',
  SCORE_GOAL: 'rbi_target_score_goal_v1',
  PROFILE: 'rbi_user_profile_v1',
  NOTES: 'rbi_subject_notes_v1',
  MISTAKES: 'rbi_mistake_entries_v1'
};

const DEFAULT_TARGET_DATE = '2026-09-12';
const DEFAULT_SCORE_GOAL = 75;

export const SubjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SUBJECTS;
  });

  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);

  const [targetExamDate, setTargetExamDateState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.EXAM_DATE) || DEFAULT_TARGET_DATE;
  });

  const [targetScoreGoal, setTargetScoreGoalState] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCORE_GOAL);
    return saved ? parseInt(saved, 10) : DEFAULT_SCORE_GOAL;
  });

  const [notes, setNotes] = useState<SubjectNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MISTAKES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Keep a reference to current userId to avoid stale closures
  const currentUserIdRef = useRef<string | null>(null);
  const backfillDoneRef = useRef<boolean>(false);

  // Real-time Firestore synchronizer for authenticated user
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    const setupListeners = async (userId: string) => {
      currentUserIdRef.current = userId;

      // 1. User document listener (targetExamDate, targetScoreGoal, customSubjects, profile)
      try {
        const userDocRef = doc(db, 'users', userId);
        const unsubUser = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.targetExamDate) {
              setTargetExamDateState(data.targetExamDate);
              localStorage.setItem(STORAGE_KEYS.EXAM_DATE, data.targetExamDate);
            }
            if (typeof data.targetScoreGoal === 'number') {
              setTargetScoreGoalState(data.targetScoreGoal);
              localStorage.setItem(STORAGE_KEYS.SCORE_GOAL, data.targetScoreGoal.toString());
            }
            if (Array.isArray(data.customSubjects) && data.customSubjects.length > 0) {
              setSubjects(data.customSubjects);
              localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(data.customSubjects));
            }
            if (data.profile) {
              setUserProfile(data.profile);
              localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(data.profile));
            } else if (data.displayName || data.photoURL) {
              const p: UserProfile = {
                displayName: data.displayName,
                photoURL: data.photoURL,
                email: auth.currentUser?.email || '',
                targetExamYear: '2026-27'
              };
              setUserProfile(p);
              localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(p));
            }
          } else {
            // First time this user document is touched: seed with current local values
            const initialData = {
              userId,
              targetExamDate: localStorage.getItem(STORAGE_KEYS.EXAM_DATE) || DEFAULT_TARGET_DATE,
              targetScoreGoal: parseInt(localStorage.getItem(STORAGE_KEYS.SCORE_GOAL) || '75', 10),
              profile: {
                displayName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Cadre Officer',
                photoURL: auth.currentUser?.photoURL || undefined,
                email: auth.currentUser?.email || '',
                stream: 'General',
                category: 'General',
                attemptCount: '1st Attempt',
                dailyStudyHours: 4,
                bio: 'Aspiring RBI Grade B Officer · Preparing for Phase 1 & Phase 2',
                targetExamYear: '2026-27'
              },
              updatedAt: Date.now()
            };
            setDoc(userDocRef, sanitizeForFirestore(initialData), { merge: true }).catch(console.error);
          }
        }, (err) => {
          console.warn('User profile sync listener error:', err);
        });
        unsubs.push(unsubUser);
      } catch (err) {
        console.warn('Error setting up user listener:', err);
      }

      // 2. Real-time Mistakes listener
      try {
        const mistakesQuery = query(collection(db, 'mistakes'), where('userId', '==', userId));
        const unsubMistakes = onSnapshot(mistakesQuery, (snapshot) => {
          const fsMistakes = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MistakeEntry[];
          
          setMistakes(prev => {
            const map = new Map<string, MistakeEntry>();
            // Keep remote as source of truth, merging any local entries if not yet saved
            prev.forEach(m => map.set(m.id, m));
            fsMistakes.forEach(m => map.set(m.id, m));
            const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(merged));
            return merged;
          });
        }, (err) => {
          console.warn('Mistakes collection listener warning:', err);
        });
        unsubs.push(unsubMistakes);
      } catch (err) {
        console.warn('Error setting up mistakes listener:', err);
      }

      // 3. Real-time Notes listener
      try {
        const notesQuery = query(collection(db, 'notes'), where('userId', '==', userId));
        const unsubNotes = onSnapshot(notesQuery, (snapshot) => {
          const fsNotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SubjectNote[];
          setNotes(fsNotes);
          localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(fsNotes));
        }, (err) => {
          console.warn('Notes collection listener warning:', err);
        });
        unsubs.push(unsubNotes);
      } catch (err) {
        console.warn('Error setting up notes listener:', err);
      }

      // 4. One-time comprehensive recovery / backfill
      // Guarantees that any past tests taken on laptop or legacy sessions
      // automatically populate their mistake entries in Firestore so mobile immediately sees them!
      if (!backfillDoneRef.current) {
        backfillDoneRef.current = true;
        try {
          // A) Backfill any existing localStorage mistakes to Firestore
          const localMistakesRaw = localStorage.getItem(STORAGE_KEYS.MISTAKES);
          if (localMistakesRaw) {
            try {
              const localArr = JSON.parse(localMistakesRaw) as MistakeEntry[];
              for (const m of localArr) {
                if (m && m.id) {
                  const payload = sanitizeForFirestore({ ...m, userId });
                  setDoc(doc(db, 'mistakes', m.id), payload, { merge: true }).catch(() => {});
                }
              }
            } catch (e) {}
          }

          // B) Scan completed tests in Firestore to extract any unindexed mistakes
          const testsQuery = query(collection(db, 'tests'), where('userId', '==', userId));
          const testsSnap = await getDocs(testsQuery);
          const tests = testsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as TestAttempt[];
          
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
                  correctAnswer: q.correctAnswer || (q.type === 'Descriptive' ? q.modelAnswer : null) || null,
                  explanation: q.explanation || evals[qId]?.evaluationSummary || reason,
                  leitnerBox: 1,
                  reviewCount: 0,
                  createdAt: test.createdAt || Date.now(),
                  nextReviewDue: Date.now() + 24 * 60 * 60 * 1000
                });

                // Write with merge so we never overwrite an existing reviewed Leitner box
                setDoc(doc(db, 'mistakes', mistakeId), mistakeDoc, { merge: true }).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.warn('Mistake backfill scan completed with note:', err);
        }
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      // Clean up previous listeners
      unsubs.forEach(fn => fn());
      unsubs = [];

      if (user) {
        setupListeners(user.uid);
      } else {
        currentUserIdRef.current = null;
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(fn => fn());
    };
  }, []);

  // Save changes & broadcast to Firestore
  const setTargetExamDate = (date: string) => {
    setTargetExamDateState(date);
    localStorage.setItem(STORAGE_KEYS.EXAM_DATE, date);

    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    if (uid) {
      setDoc(doc(db, 'users', uid), { 
        targetExamDate: date, 
        updatedAt: Date.now() 
      }, { merge: true }).catch(console.error);
    }
  };

  const setTargetScoreGoal = (score: number) => {
    setTargetScoreGoalState(score);
    localStorage.setItem(STORAGE_KEYS.SCORE_GOAL, score.toString());

    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    if (uid) {
      setDoc(doc(db, 'users', uid), { 
        targetScoreGoal: score, 
        updatedAt: Date.now() 
      }, { merge: true }).catch(console.error);
    }
  };

  const updateSubject = (updated: Subject) => {
    setSubjects(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(next));

      const uid = currentUserIdRef.current || auth.currentUser?.uid;
      if (uid) {
        setDoc(doc(db, 'users', uid), { 
          customSubjects: next, 
          updatedAt: Date.now() 
        }, { merge: true }).catch(console.error);
      }

      return next;
    });
    if (activeSubject && activeSubject.id === updated.id) {
      setActiveSubject(updated);
    }
  };

  const resetSubjectsToDefault = () => {
    setSubjects(INITIAL_SUBJECTS);
    localStorage.removeItem(STORAGE_KEYS.SUBJECTS);

    const uid = currentUserIdRef.current || auth.currentUser?.uid;
    if (uid) {
      setDoc(doc(db, 'users', uid), { 
        customSubjects: INITIAL_SUBJECTS, 
        updatedAt: Date.now() 
      }, { merge: true }).catch(console.error);
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

    setNotes(prev => {
      const next = [newNote, ...prev];
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(next));
      return next;
    });

    if (uid) {
      setDoc(doc(db, 'notes', newNote.id), sanitizeForFirestore(newNote), { merge: true }).catch(console.error);
    }

    return newNote;
  };

  const deleteNote = (id: string) => {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(next));
      return next;
    });

    deleteDoc(doc(db, 'notes', id)).catch(console.error);
  };

  const recordMistake = (data: Omit<MistakeEntry, 'id' | 'createdAt' | 'reviewCount'>) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid || '';
    setMistakes(prev => {
      const existingIdx = prev.findIndex(m => m.questionId === data.questionId && m.testId === data.testId);
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
      localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(next));

      if (uid) {
        setDoc(doc(db, 'mistakes', newEntry.id), sanitizeForFirestore(newEntry), { merge: true }).catch(console.error);
      }

      return next;
    });
  };

  const updateMistakeBox = (id: string, promoted: boolean) => {
    const uid = currentUserIdRef.current || auth.currentUser?.uid || '';
    setMistakes(prev => {
      const next = prev.map(m => {
        if (m.id !== id) return m;
        let newBox = promoted ? Math.min(5, m.leitnerBox + 1) : 1;
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
          setDoc(doc(db, 'mistakes', id), sanitizeForFirestore(updated), { merge: true }).catch(console.error);
        }

        return updated;
      });
      localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(next));
      return next;
    });
  };

  const deleteMistake = (id: string) => {
    setMistakes(prev => {
      const next = prev.filter(m => m.id !== id);
      localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(next));
      return next;
    });

    deleteDoc(doc(db, 'mistakes', id)).catch(console.error);
  };

  const updateUserProfile = async (profileData: Partial<UserProfile>) => {
    const currentAuth = auth.currentUser;
    const uid = currentAuth?.uid || currentUserIdRef.current;

    const merged: UserProfile = {
      displayName: currentAuth?.displayName || currentAuth?.email?.split('@')[0] || 'Cadre Officer',
      photoURL: currentAuth?.photoURL || '',
      email: currentAuth?.email || '',
      stream: 'General',
      category: 'General',
      attemptCount: '1st Attempt',
      dailyStudyHours: 4,
      bio: 'Aspiring RBI Grade B Officer · Preparing for Phase 1 & Phase 2',
      targetExamYear: '2026-27',
      ...(userProfile || {}),
      ...profileData,
      updatedAt: Date.now()
    };

    // Update local state and storage immediately for zero-latency UI response
    setUserProfile(merged);
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(merged));
    } catch (e) {
      console.warn('Could not cache profile in localStorage:', e);
    }

    // Update Firebase Auth user profile safely (Firebase Auth only accepts http/https URLs up to 2048 chars)
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
          console.warn('Firebase Auth updateProfile skipped/warned:', authErr);
        }
      }
    }

    // Persist to Firestore users/{uid} with full payload sanitization
    if (uid) {
      const payload = sanitizeForFirestore({
        userId: uid,
        profile: sanitizeForFirestore(merged),
        displayName: merged.displayName || null,
        photoURL: merged.photoURL || null,
        targetExamDate: merged.targetExamDate || targetExamDate,
        targetScoreGoal: merged.targetScoreGoal || targetScoreGoal,
        updatedAt: Date.now()
      });

      await setDoc(doc(db, 'users', uid), payload, { merge: true });
    }

    if (profileData.targetExamDate) {
      setTargetExamDateState(profileData.targetExamDate);
      localStorage.setItem(STORAGE_KEYS.EXAM_DATE, profileData.targetExamDate);
    }
    if (profileData.targetScoreGoal !== undefined) {
      setTargetScoreGoalState(profileData.targetScoreGoal);
      localStorage.setItem(STORAGE_KEYS.SCORE_GOAL, profileData.targetScoreGoal.toString());
    }
  };

  return (
    <SubjectContext.Provider value={{
      subjects,
      activeSubject,
      setActiveSubject,
      targetExamDate,
      setTargetExamDate,
      targetScoreGoal,
      setTargetScoreGoal,
      userProfile,
      updateUserProfile,
      notes,
      addNote,
      deleteNote,
      mistakes,
      recordMistake,
      updateMistakeBox,
      deleteMistake,
      updateSubject,
      resetSubjectsToDefault
    }}>
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
