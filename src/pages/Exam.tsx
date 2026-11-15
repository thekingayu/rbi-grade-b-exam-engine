import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { TestAttempt } from '../types';
import { Clock, ChevronLeft, ChevronRight, Flag, BookOpen, RotateCcw, ChevronUp, ChevronDown, Award } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { evaluateAndPersistTest } from '../services/evaluation';
import { AtmosphericBackground } from '../components/AtmosphericBackground';
import { FuturisticSpinner, FuturisticProgressBar, FuturisticScreenLoader } from '../components/FuturisticLoader';
import { MotionModal, SPRING_SNAPPY, EASE_OUT_EXPO } from '../components/MotionPrimitives';

export function Exam({ user }: { user: User }) {
  const { testId } = useParams();
  const navigate = useNavigate();
  
  const [test, setTest] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef(answers);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [evalProgress, setEvalProgress] = useState<{ message: string; percent: number } | null>(null);
  
  // Keep ref up to date
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Scroll to top when question changes
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentIndex]);
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchTest = async () => {
      if (!testId) return;
      const docRef = doc(db, 'tests', testId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as TestAttempt;
        setTest({ ...data, id: snap.id });
        if (data.answers) {
          setAnswers(data.answers);
          answersRef.current = data.answers;
        }
        hasLoadedRef.current = true;
        
        let currentLeft = data.durationSeconds;
        if (data.status === 'in-progress' && data.startedAt) {
          const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
          currentLeft = Math.max(0, data.durationSeconds - elapsed);
        }
        setTimeLeft(currentLeft);

        if (data.status === 'setup') {
          await updateDoc(docRef, { status: 'in-progress', startedAt: Date.now(), userId: user.uid });
        }
      }
      setLoading(false);
    };
    fetchTest();
  }, [testId]);

  useEffect(() => {
    if (timeLeft <= 0 || loading || !test) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading, test]);

  useEffect(() => {
    if (!testId || loading || !hasLoadedRef.current) return;
    const save = async () => {
      await updateDoc(doc(db, 'tests', testId), { answers, userId: user.uid });
    };
    const t = setTimeout(save, 1500);
    return () => clearTimeout(t);
  }, [answers, testId, loading]);

  const handleAnswerChange = (val: string) => {
    if (!test) return;
    const q = test.questions[currentIndex];
    const qId = q.id || currentIndex.toString();
    const nextAnswers = { 
      ...answers, 
      [qId]: val
    };
    if (q.id && q.id !== currentIndex.toString()) {
      delete nextAnswers[currentIndex.toString()];
    }
    setAnswers(nextAnswers);
    answersRef.current = nextAnswers;
  };

  const handleClearResponse = async () => {
    if (!test) return;
    const q = test.questions[currentIndex];
    const qId = q.id || currentIndex.toString();
    const nextAnswers = { ...answers };
    delete nextAnswers[qId];
    delete nextAnswers[currentIndex.toString()];
    setAnswers(nextAnswers);
    answersRef.current = nextAnswers;
    if (testId) {
      try {
        await updateDoc(doc(db, 'tests', testId), { answers: nextAnswers, userId: user.uid });
      } catch (err) {
        console.error('Failed to sync cleared answer to Firestore:', err);
      }
    }
  };

  const handleMarkReview = () => {
    if (!test) return;
    const qId = test.questions[currentIndex].id || currentIndex.toString();
    setMarkedForReview(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleNext = () => {
    if (test && currentIndex < test.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!test || submitting) return;
    setSubmitting(true);
    setShowConfirm(false);
    setEvalProgress({ message: 'Scoring multiple-choice questions...', percent: 15 });
    
    // Combine answers from test.answers, current answers state, and answersRef to ensure 0 lost answers
    const cleanAnswers: Record<string, string> = {};
    if (test.answers) {
      Object.entries(test.answers).forEach(([k, v]) => {
        if (v !== undefined && v !== null && typeof v === 'string') cleanAnswers[k] = v;
      });
    }
    Object.entries(answers).forEach(([k, v]) => {
      if (v !== undefined && v !== null && typeof v === 'string') cleanAnswers[k] = v;
    });
    Object.entries(answersRef.current).forEach(([k, v]) => {
      if (v !== undefined && v !== null && typeof v === 'string') cleanAnswers[k] = v;
    });
    
    const initialQuestions = test.questions.map((q, i) => {
      const qId = q.id || i.toString();
      const ans = cleanAnswers[qId] || cleanAnswers[i.toString()] || (q.id ? cleanAnswers[q.id] : null) || null;
      return { 
        ...q, 
        id: qId,
        userAnswer: ans || null 
      };
    });

    const pendingAttempt: TestAttempt = {
      ...test,
      status: 'completed',
      submittedAt: Date.now(),
      answers: cleanAnswers,
      questions: initialQuestions,
      userId: user.uid
    };

    try {
      await evaluateAndPersistTest(
        test.id,
        pendingAttempt,
        user.uid,
        (msg, pct) => {
          setEvalProgress({ message: msg, percent: pct || 50 });
        }
      );
      navigate(`/results/${test.id}`);
    } catch (e) {
      console.error("Submission evaluation error:", e);
      // Fallback update to guarantee test status is saved as completed
      try {
        await updateDoc(doc(db, 'tests', test.id), {
          status: 'completed',
          submittedAt: Date.now(),
          answers: cleanAnswers,
          userId: user.uid
        });
      } catch (innerErr) {
        console.error("Fallback update failed:", innerErr);
      }
      navigate(`/results/${test.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !test) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen flex items-center justify-center bg-[#FAF8EC] dark:bg-[#141413]">
        <FuturisticScreenLoader
          title="RBI Grade B Examination"
          subtitle="INITIALIZING QUESTION CARDS & SECURE ENVIRONMENT..."
          color="teal"
        />
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = test.questions[currentIndex];
  const currentQId = currentQ.id || currentIndex.toString();

  const isQuestionAnswered = (idx: number) => {
    if (!test || !test.questions[idx]) return false;
    const q = test.questions[idx];
    const qId = q.id || idx.toString();
    const val = answers[qId] || (q.id ? answers[idx.toString()] : undefined);
    return typeof val === 'string' && val.trim() !== '';
  };

  const attemptedCount = test.questions.filter((_, i) => isQuestionAnswered(i)).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.995 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      data-lenis-prevent
      className="fixed inset-0 z-50 bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] font-sans selection:bg-[#ECD5FF] selection:text-[#141413] flex flex-col overflow-hidden transition-colors duration-300"
    >
      
      {/* Editorial Atmospheric Grid */}
      <AtmosphericBackground />

      {/* Top Bar */}
      <header className="relative z-20 h-16 sm:h-[72px] bg-[#FAF8EC]/95 dark:bg-[#141413]/95 border-b border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between px-3 sm:px-6 shrink-0 gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#ECD5FF] border-[1.5px] border-[#141413] flex items-center justify-center text-[#141413] shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-heading text-sm sm:text-xl font-black tracking-tight text-[#141413] dark:text-[#FAF8EC] truncate">
            RBI GRADE B <span className="text-[#0D47FF] dark:text-[#ECD5FF]">× Engine</span>
          </span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#2E2E2A] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono text-xs sm:text-base font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
            <span className={timeLeft < 300 ? 'text-rose-600 dark:text-rose-400' : ''}>{formatTime(timeLeft)}</span>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] dark:shadow-[3px_3px_0px_#ECD5FF] active:translate-y-[1px] px-3.5 sm:px-6 py-1.5 sm:py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer"
          >
            Submit
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Main Content */}
        <div
          ref={mainScrollRef}
          data-lenis-prevent
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 pb-32">
            
            <AnimatePresence mode="wait">
              <motion.div
                key={`q-panel-${currentIndex}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                className="space-y-5"
              >
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] text-xs font-mono font-bold uppercase tracking-wider rounded-md tabular-nums">
                    Question {currentIndex + 1} of {test.questions.length}
                  </span>
                  <span className="px-3 py-1 bg-[#ECD5FF] border-[1.5px] border-[#141413] text-[#141413] text-xs font-mono font-bold uppercase tracking-wider rounded-md">
                    {currentQ.sourceTag}
                  </span>
                  <span className="px-3 py-1 bg-[#FAF8EC] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399] text-xs font-mono font-bold uppercase tracking-wider rounded-md">
                    {currentQ.type}
                  </span>
                  {currentQ.isPyq && (
                    <span className="px-3 py-1 bg-[#FFD426] border-[1.5px] border-[#141413] text-[#141413] text-xs font-mono font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#141413] shrink-0" />
                      <span>{currentQ.pyqYear || 'RBI Grade B PYQ'}</span>
                    </span>
                  )}
                </div>
                
                {currentQ.type === 'Descriptive' && (
                  <div className="px-4 py-3 bg-[#ECD5FF]/45 dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#ECD5FF]/50 text-xs sm:text-sm font-mono font-bold text-[#141413] dark:text-[#ECD5FF] rounded-xl tabular-nums">
                    Word limit: {currentQ.wordLimit || 250} words • {currentQ.maxMarks || 15} marks
                  </div>
                )}

                {/* Question Card */}
                <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl p-5 sm:p-8">
                  <div className="text-base sm:text-xl font-medium text-[#141413] dark:text-[#FAF8EC] leading-relaxed mb-6 sm:mb-8 whitespace-pre-wrap">
                    {currentQ.text}
                  </div>

                  {currentQ.type === 'MCQ' && currentQ.options && (
                    <div className="space-y-3">
                      {currentQ.options.map((opt, i) => {
                        const isSelected = answers[currentQId] === opt || answers[currentIndex.toString()] === opt;
                        const optionLetter = ['A', 'B', 'C', 'D', 'E'][i] || String.fromCharCode(65 + i);
                        return (
                          <motion.label
                            key={i}
                            whileTap={{ scale: 0.99 }}
                            transition={SPRING_SNAPPY}
                            onClick={() => handleAnswerChange(opt)}
                            className={clsx(
                              "flex items-start gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl border-[1.5px] cursor-pointer transition-colors group",
                              isSelected
                                ? "bg-[#ECD5FF]/35 dark:bg-[#ECD5FF]/15 border-[#141413] dark:border-[#ECD5FF] shadow-[3px_3px_0px_#141413] dark:shadow-[3px_3px_0px_#ECD5FF]"
                                : "bg-[#FAF8EC] dark:bg-[#141413] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60"
                            )}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 pt-0.5">
                              <input
                                type="radio"
                                name={`q-${currentQId}`}
                                value={opt}
                                checked={isSelected}
                                onChange={() => handleAnswerChange(opt)}
                                className="w-5 h-5 accent-[#0D47FF] border-[#141413] cursor-pointer"
                              />
                              <span className={clsx(
                                "w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-colors font-mono border",
                                isSelected
                                  ? "bg-[#0D47FF] text-white border-[#141413]"
                                  : "bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#141413] dark:text-[#FAF8EC] border-[#E5E1CE] dark:border-[#2E2E2A] group-hover:border-[#141413]"
                              )}>
                                {optionLetter}
                              </span>
                            </div>
                            <span className="text-[#141413] dark:text-[#FAF8EC] text-sm sm:text-lg leading-snug flex-1">{opt}</span>
                          </motion.label>
                        );
                      })}
                    </div>
                  )}

                  {currentQ.type === 'Descriptive' && (
                    <div>
                      <textarea
                        value={answers[currentQId] || ''}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder="Type your structured answer here adhering to RBI Grade B Phase II guidelines..."
                        className="w-full h-72 sm:h-96 p-4 sm:p-6 bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] outline-none text-[#141413] dark:text-[#FAF8EC] resize-y text-sm sm:text-lg leading-relaxed"
                      />
                      <div className="flex flex-wrap justify-between items-center gap-2 mt-3">
                        <span className="text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
                          Phase II Standard: Statutory provisions • Regulatory circulars • Policy implications
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#141413] dark:text-[#FAF8EC] bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] px-3 py-1 rounded-md font-mono tabular-nums">
                          {answers[currentQId]?.trim().split(/\s+/).filter(w => w.length > 0).length || 0} / {currentQ.wordLimit || 250} words
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mt-6">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleMarkReview}
                  className={clsx(
                    "flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors border-[1.5px] cursor-pointer",
                    markedForReview[currentQId]
                      ? "bg-[#FFD426] text-[#141413] border-[#141413] shadow-[3px_3px_0px_#141413]"
                      : "bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#141413] dark:text-[#FAF8EC] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]"
                  )}
                >
                  <Flag className="w-4 h-4 shrink-0" />
                  <span>{markedForReview[currentQId] ? 'Marked for Review' : 'Mark for Review'}</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleClearResponse}
                  disabled={!answers[currentQId] || answers[currentQId].trim() === ''}
                  className={clsx(
                    "flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors border-[1.5px]",
                    answers[currentQId] && answers[currentQId].trim() !== ''
                      ? "bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#141413] dark:text-[#FAF8EC] border-[#E5E1CE] dark:border-[#2E2E2A] hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/40 cursor-pointer"
                      : "opacity-40 cursor-not-allowed bg-[#FAF8EC] dark:bg-[#141413] text-[#66665E] border-[#E5E1CE] dark:border-[#2E2E2A]"
                  )}
                  title="Clear your response for this question"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Clear</span>
                </motion.button>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  aria-label="Previous question"
                  className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl font-bold text-[#141413] dark:text-[#FAF8EC] bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </motion.button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNext}
                  disabled={currentIndex === test.questions.length - 1}
                  className="flex-1 sm:flex-none min-h-[48px] sm:min-h-[54px] flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-xl font-bold text-[#FAF8EC] bg-[#141413] hover:bg-[#0D47FF] dark:bg-[#0D47FF] dark:hover:bg-[#0936CC] border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#0D47FF] dark:shadow-[3px_3px_0px_#ECD5FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-sm sm:text-base"
                >
                  <span>Save & Next</span>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
              </div>
            </div>

          </div>
        </div>

        {/* Sidebar Palette */}
        <div className={clsx(
          "w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#1C1C1A] flex flex-col shrink-0 z-20 transition-all duration-300 min-h-0",
          showMobilePalette ? "max-h-72 lg:max-h-none" : "max-h-16 lg:max-h-none"
        )}>
          <div
            onClick={() => setShowMobilePalette(!showMobilePalette)}
            className="p-3.5 sm:p-5 lg:p-6 border-b border-[#E5E1CE] dark:border-[#2E2E2A] shrink-0 flex items-center justify-between cursor-pointer lg:cursor-default select-none"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base lg:text-lg font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">Question Palette</h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#ECD5FF] font-bold font-mono text-[#141413] border border-[#141413] tabular-nums">
                  {currentIndex + 1} / {test.questions.length}
                </span>
              </div>
              <div className="hidden lg:grid lg:grid-cols-2 gap-3 sm:gap-4 mt-5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-sm bg-[#0D47FF] border border-[#141413]"></div> Answered</div>
                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-sm bg-[#FFD426] border border-[#141413]"></div> Marked</div>
                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-sm bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#141413] dark:border-[#A3A399]"></div> Unanswered</div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setShowMobilePalette(!showMobilePalette)}
              className="lg:hidden text-xs font-bold px-3 py-1.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center gap-1.5 text-[#141413] dark:text-[#FAF8EC] cursor-pointer"
            >
              {showMobilePalette ? 'Collapse' : 'Expand Grid'}
              {showMobilePalette ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div
            data-lenis-prevent
            className={clsx(
              "flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 overscroll-contain",
              !showMobilePalette && "hidden lg:block"
            )}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-2 sm:gap-3">
              {test.questions.map((q, i) => {
                const qId = q.id || i.toString();
                const isAnswered = isQuestionAnswered(i);
                const isMarked = !!markedForReview[qId] || (q.id ? !!markedForReview[i.toString()] : false);
                const isCurrent = i === currentIndex;
                
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentIndex(i);
                      if (window.innerWidth < 1024) {
                        setShowMobilePalette(false);
                      }
                    }}
                    className={clsx(
                      'h-10 w-10 sm:h-11 sm:w-11 rounded-xl font-mono font-bold text-sm flex items-center justify-center transition-all cursor-pointer tabular-nums border-[1.5px]',
                      isCurrent ? 'ring-2 ring-[#141413] ring-offset-2 dark:ring-[#ECD5FF] dark:ring-offset-[#1C1C1A] scale-105 z-10' : '',
                      isMarked ? 'bg-[#FFD426] text-[#141413] border-[#141413]' :
                      isAnswered ? 'bg-[#0D47FF] text-white border-[#141413]' :
                      'bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]'
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <MotionModal
        isOpen={showConfirm}
        onClose={() => !submitting && setShowConfirm(false)}
        maxWidthClass="max-w-sm"
      >
        <div className="bg-[#FAF8EC] dark:bg-[#1C1C1A] rounded-3xl w-full p-6 sm:p-8 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/40 border-[2px] border-[#141413] dark:border-[#ECD5FF]">
          <h3 className="text-2xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] mb-3">Submit Exam?</h3>
          <p className="text-[#40403B] dark:text-[#A3A399] font-medium mb-7 leading-relaxed text-sm tabular-nums">
            You have attempted {attemptedCount} out of {test.questions.length} questions. You cannot change your answers after submission.
          </p>
          <div className="flex flex-col gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full min-h-[46px] py-3.5 font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              {submitting && <FuturisticSpinner size="xs" color="white" />}
              <span>Confirm Submit</span>
            </motion.button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={submitting}
              className="w-full min-h-[44px] py-3 font-bold text-[#141413] dark:text-[#FAF8EC] bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </MotionModal>

      {/* Evaluation & Persistence Progress Overlay */}
      <AnimatePresence>
        {evalProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#141413]/85 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={SPRING_SNAPPY}
              className="relative bg-[#FAF8EC] dark:bg-[#1C1C1A] rounded-3xl max-w-md w-full p-7 sm:p-8 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/40 border-[2px] border-[#141413] dark:border-[#ECD5FF] text-center space-y-6"
            >
              <div className="flex items-center justify-center mx-auto">
                <FuturisticSpinner size="xl" color="teal" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-heading text-[#141413] dark:text-[#FAF8EC] mb-2">Grading & Storing Results</h3>
                <p className="text-sm font-medium text-[#40403B] dark:text-[#A3A399] min-h-[44px] flex items-center justify-center px-2">
                  {evalProgress.message}
                </p>
              </div>
              <div className="w-full">
                <FuturisticProgressBar
                  progress={evalProgress.percent}
                  color="teal"
                  height={7}
                  label="SYNCHRONIZING MARKS & RUBRICS"
                />
              </div>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
                Evaluating your answers against official RBI Grade B criteria and saving permanent records...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
