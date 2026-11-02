import React, { createContext, useContext, useState, useEffect } from 'react';
import { Subject, SubjectNote, MistakeEntry } from '../types';
import { INITIAL_SUBJECTS } from '../data/subjects';

interface SubjectContextType {
  subjects: Subject[];
  activeSubject: Subject | null;
  setActiveSubject: (subject: Subject | null) => void;
  targetExamDate: string;
  setTargetExamDate: (date: string) => void;
  targetScoreGoal: number;
  setTargetScoreGoal: (score: number) => void;
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
  NOTES: 'rbi_subject_notes_v1',
  MISTAKES: 'rbi_mistake_entries_v1'
};

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
    return localStorage.getItem(STORAGE_KEYS.EXAM_DATE) || '2026-09-12';
  });

  const [targetScoreGoal, setTargetScoreGoalState] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCORE_GOAL);
    return saved ? parseInt(saved, 10) : 75;
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

  // Save changes
  const setTargetExamDate = (date: string) => {
    setTargetExamDateState(date);
    localStorage.setItem(STORAGE_KEYS.EXAM_DATE, date);
  };

  const setTargetScoreGoal = (score: number) => {
    setTargetScoreGoalState(score);
    localStorage.setItem(STORAGE_KEYS.SCORE_GOAL, score.toString());
  };

  const updateSubject = (updated: Subject) => {
    setSubjects(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(next));
      return next;
    });
    if (activeSubject && activeSubject.id === updated.id) {
      setActiveSubject(updated);
    }
  };

  const resetSubjectsToDefault = () => {
    setSubjects(INITIAL_SUBJECTS);
    localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
  };

  const addNote = (noteData: Omit<SubjectNote, 'id' | 'uploadedAt'>): SubjectNote => {
    const newNote: SubjectNote = {
      ...noteData,
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(7),
      uploadedAt: Date.now()
    };
    setNotes(prev => {
      const next = [newNote, ...prev];
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(next));
      return next;
    });
    return newNote;
  };

  const deleteNote = (id: string) => {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(next));
      return next;
    });
  };

  const recordMistake = (data: Omit<MistakeEntry, 'id' | 'createdAt' | 'reviewCount'>) => {
    setMistakes(prev => {
      // Check if duplicate question already exists
      const existingIdx = prev.findIndex(m => m.questionId === data.questionId && m.testId === data.testId);
      if (existingIdx !== -1) return prev;

      const newEntry: MistakeEntry = {
        ...data,
        id: 'mistake_' + Date.now() + '_' + Math.random().toString(36).substring(7),
        createdAt: Date.now(),
        reviewCount: 0,
        leitnerBox: data.leitnerBox || 1,
        nextReviewDue: Date.now() + 24 * 60 * 60 * 1000 // 1 day
      };
      const next = [newEntry, ...prev];
      localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(next));
      return next;
    });
  };

  const updateMistakeBox = (id: string, promoted: boolean) => {
    setMistakes(prev => {
      const next = prev.map(m => {
        if (m.id !== id) return m;
        let newBox = promoted ? Math.min(5, m.leitnerBox + 1) : 1;
        // Spaced repetition intervals: Box 1: 1d, Box 2: 3d, Box 3: 7d, Box 4: 14d, Box 5: 30d
        const intervals = [1, 3, 7, 14, 30];
        const days = intervals[newBox - 1] || 1;
        return {
          ...m,
          leitnerBox: newBox,
          reviewCount: m.reviewCount + 1,
          lastReviewedAt: Date.now(),
          nextReviewDue: Date.now() + days * 24 * 60 * 60 * 1000
        };
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
