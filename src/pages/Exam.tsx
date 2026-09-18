import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { TestAttempt, Question } from '../types';
import { Clock, ChevronLeft, ChevronRight, Flag, Loader2, BookOpen, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { checkMCQCorrect } from '../utils/exam';
import { motion } from 'motion/react';

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
    
    let mcqScore = 0;
    const evaluatedQuestions = test.questions.map((q, i) => {
      const qId = q.id || i.toString();
      const ans = cleanAnswers[qId] || cleanAnswers[i.toString()] || (q.id ? cleanAnswers[q.id] : null) || null;
      
      // Clean up the question object to ensure no undefined values
      const cleanQ = { ...q };
      Object.keys(cleanQ).forEach(key => {
        const k = key as keyof typeof cleanQ;
        if (cleanQ[k] === undefined) {
          delete cleanQ[k];
        }
      });
      
      if (cleanQ.type === 'MCQ') {
        const maxMarks = (typeof cleanQ.maxMarks === 'number' && cleanQ.maxMarks > 0) ? cleanQ.maxMarks : 1;
        let score = 0;
        let isCorrect = false;
        if (ans && ans.trim() !== '') {
          isCorrect = checkMCQCorrect(ans, cleanQ.correctAnswer, cleanQ.options);
          score = isCorrect ? maxMarks : -0.25 * maxMarks;
        }
        mcqScore += score;
        return { 
          ...cleanQ, 
          id: cleanQ.id || i.toString(),
          maxMarks,
          userAnswer: ans || null, 
          score,
          isCorrect
        };
      }
      return { 
        ...cleanQ, 
        id: cleanQ.id || i.toString(),
        userAnswer: ans || null 
      };
    });

    try {
      await updateDoc(doc(db, 'tests', test.id), {
        status: 'completed',
        submittedAt: Date.now(),
        questions: evaluatedQuestions,
        totalScore: Number(mcqScore.toFixed(2)),
        answers: cleanAnswers,
        userId: user.uid
      });
      navigate(`/results/${test.id}`);
    } catch (e) {
      console.error(e);
      alert("Error submitting. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading || !test) {
    return <div className="fixed inset-0 z-50 min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#05050A] text-slate-500 dark:text-slate-400 font-medium">Loading exam...</div>;
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
      className="fixed inset-0 z-50 bg-slate-50/80 dark:bg-[#05050A] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#9A7D3C] selection:text-white flex flex-col overflow-hidden"
    >
      
      {/* GPU-Isolated Ambient background blobs for Liquid Glass effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 transform-gpu will-change-transform">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 dark:bg-indigo-600/30 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-400/20 dark:bg-fuchsia-600/20 blur-[120px]" />
        <div className="absolute top-[30%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-400/15 dark:bg-cyan-500/20 blur-[100px]" />
        <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-purple-400/10 dark:bg-[#9A7D3C]/30 blur-[120px]" />
      </div>

      {/* Top Bar */}
      <header className="relative z-20 h-auto lg:h-20 py-4 lg:py-0 bg-white/40 dark:bg-[#0A0F1C]/40 backdrop-blur-2xl border-b border-white/60 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm gap-4 sm:gap-0">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 flex items-center justify-center text-[#9A7D3C] dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-black/20 shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
            RBI Grade B <span className="text-[#9A7D3C]">Engine</span>
          </span>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-white transition-colors">
            <Clock className="w-4 h-4 sm:w-5 h-5 text-[#9A7D3C]" />
            <span className={timeLeft < 300 ? 'text-red-600 dark:text-red-400' : ''}>{formatTime(timeLeft)}</span>
          </div>
          <button 
            onClick={() => setShowConfirm(true)}
            className="bg-[#9A7D3C] hover:bg-[#806630] text-white px-6 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all shadow-md shadow-[#9A7D3C]/20 hover:shadow-[#9A7D3C]/40 hover:-translate-y-0.5 whitespace-nowrap text-sm sm:text-base flex-1 sm:flex-none"
          >
            Submit Test
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
          <div className="max-w-4xl mx-auto space-y-8 pb-32">
            
            {/* Badges */}
            <div className="flex items-center gap-3">
              <span className="px-4 py-1.5 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                Question {currentIndex + 1} of {test.questions.length}
              </span>
              <span className="px-4 py-1.5 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                {currentQ.sourceTag}
              </span>
              <span className="px-4 py-1.5 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                {currentQ.type}
              </span>
            </div>
            
            {currentQ.type === 'Descriptive' && (
              <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20 backdrop-blur-md text-sm font-semibold text-blue-800 dark:text-blue-300 rounded-2xl">
                Word limit: {currentQ.wordLimit || 250} words • {currentQ.maxMarks || 15} marks
              </div>
            )}

            {/* Question Card */}
            <div className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/50">
              <p className="text-xl font-medium text-slate-900 dark:text-white leading-relaxed mb-8 font-serif">
                {currentQ.text}
              </p>

              {currentQ.type === 'MCQ' && currentQ.options && (
                <div className="space-y-3.5">
                  {currentQ.options.map((opt, i) => {
                    const isSelected = answers[currentQId] === opt || answers[currentIndex.toString()] === opt;
                    const optionLetter = ['A', 'B', 'C', 'D', 'E'][i] || String.fromCharCode(65 + i);
                    return (
                      <label 
                        key={i}
                        onClick={() => handleAnswerChange(opt)}
                        className={clsx(
                          "flex items-start gap-4 p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all backdrop-blur-md group hover:shadow-md hover:-translate-y-0.5",
                          isSelected 
                            ? "bg-white/95 border-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:border-[#9A7D3C]/60 shadow-md ring-1 ring-[#9A7D3C]/40" 
                            : "bg-white/40 border-white/60 hover:bg-white/70 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center gap-3 shrink-0 pt-0.5">
                          <input 
                            type="radio" 
                            name={`q-${currentQId}`}
                            value={opt}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(opt)}
                            className="w-5 h-5 text-[#9A7D3C] focus:ring-[#9A7D3C] border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className={clsx(
                            "w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center transition-colors font-mono",
                            isSelected
                              ? "bg-[#9A7D3C] text-white"
                              : "bg-slate-200/70 text-slate-700 dark:bg-white/10 dark:text-slate-300 group-hover:bg-[#9A7D3C]/20 group-hover:text-[#9A7D3C]"
                          )}>
                            {optionLetter}
                          </span>
                        </div>
                        <span className="text-slate-800 dark:text-slate-200 text-base sm:text-lg leading-snug flex-1">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'Descriptive' && (
                <div>
                  <textarea 
                    value={answers[currentQId] || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full h-96 p-6 bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-[#9A7D3C] outline-none text-slate-900 dark:text-white resize-y backdrop-blur-md text-lg leading-relaxed shadow-inner dark:shadow-none"
                  />
                  <div className="flex justify-end items-center mt-3">
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-white/10 backdrop-blur-md px-3 py-1 rounded-full shadow-sm">
                      {answers[currentQId]?.trim().split(/\s+/).filter(w => w.length > 0).length || 0} / {currentQ.wordLimit || 250} words
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={handleMarkReview}
                  className={clsx(
                    "flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all backdrop-blur-md border shadow-sm cursor-pointer hover:-translate-y-0.5",
                    markedForReview[currentQId] 
                      ? "bg-amber-100/80 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30" 
                      : "bg-white/60 text-slate-700 border-white/60 hover:bg-white/90 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10"
                  )}
                >
                  <Flag className="w-4 h-4" />
                  {markedForReview[currentQId] ? 'Marked for Review' : 'Mark for Review'}
                </button>

                <button 
                  onClick={handleClearResponse}
                  disabled={!answers[currentQId] || answers[currentQId].trim() === ''}
                  className={clsx(
                    "flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all backdrop-blur-md border shadow-sm",
                    answers[currentQId] && answers[currentQId].trim() !== ''
                      ? "bg-white/60 text-slate-700 border-white/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-red-500/20 dark:hover:text-red-300 dark:hover:border-red-500/30 cursor-pointer hover:-translate-y-0.5"
                      : "opacity-40 cursor-not-allowed bg-white/30 text-slate-400 border-white/40 dark:bg-white/[0.02] dark:text-slate-600 dark:border-white/5"
                  )}
                  title="Clear your response for this question"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear Response
                </button>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <button 
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl font-bold text-slate-700 bg-white/60 border border-white/60 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 backdrop-blur-md shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <button 
                  onClick={handleNext}
                  disabled={currentIndex === test.questions.length - 1}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-2xl font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-xl shadow-slate-900/20 dark:shadow-white/20 transition-all hover:-translate-y-0.5 cursor-pointer text-sm sm:text-base"
                >
                  Save & Next <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Sidebar Palette */}
        <div className={clsx(
          "w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#0A0F1C]/40 backdrop-blur-2xl flex flex-col shrink-0 z-20 transition-all duration-300 min-h-0",
          showMobilePalette ? "max-h-72 lg:max-h-none" : "max-h-16 lg:max-h-none"
        )}>
          <div 
            onClick={() => setShowMobilePalette(!showMobilePalette)}
            className="p-3.5 sm:p-5 lg:p-6 border-b border-white/60 dark:border-white/10 shrink-0 flex items-center justify-between cursor-pointer lg:cursor-default select-none"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 dark:text-white">Question Palette</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 dark:bg-white/10 font-bold font-mono text-slate-700 dark:text-slate-300 border border-white/50 dark:border-white/10">
                  {currentIndex + 1} / {test.questions.length}
                </span>
              </div>
              <div className="hidden lg:flex lg:grid lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-6 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#9A7D3C] shadow-sm"></div> Answered</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-amber-500 shadow-sm"></div> Marked</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div> Unanswered</div>
              </div>
            </div>
            
            <button 
              type="button" 
              className="lg:hidden text-xs font-bold px-3 py-1.5 rounded-xl bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10 flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
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
                      'h-10 w-10 sm:h-12 sm:w-12 lg:h-12 lg:w-12 rounded-xl sm:rounded-2xl font-bold text-sm flex items-center justify-center transition-all shadow-sm backdrop-blur-md cursor-pointer',
                      isCurrent ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-[#0A0F1C] scale-110 shadow-md z-10' : 'hover:-translate-y-0.5',
                      isMarked ? 'bg-amber-500 text-white' : 
                      isAnswered ? 'bg-[#9A7D3C] text-white' : 
                      'bg-white/60 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-white/60 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/10'
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
      {showConfirm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-[#05050A]/60 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white/80 dark:bg-[#0A0F1C]/80 backdrop-blur-3xl rounded-3xl max-w-sm w-full p-8 shadow-2xl border border-white/60 dark:border-white/10">
            <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-3">Submit Exam?</h3>
            <p className="text-slate-600 dark:text-slate-300 font-medium mb-8 leading-relaxed">
              You have attempted {attemptedCount} out of {test.questions.length} questions. You cannot change your answers after submission.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 font-bold bg-[#9A7D3C] text-white rounded-2xl hover:bg-[#806630] flex items-center justify-center gap-2 shadow-lg shadow-[#9A7D3C]/20 transition-all hover:-translate-y-0.5"
              >
                {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Confirm Submit
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                className="w-full py-4 font-bold text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/10 rounded-2xl backdrop-blur-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
