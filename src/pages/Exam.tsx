import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { TestAttempt, Question } from '../types';
import { Clock, ChevronLeft, ChevronRight, Flag, Loader2, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';

export function Exam({ user }: { user: User }) {
  const { testId } = useParams();
  const navigate = useNavigate();
  
  const [test, setTest] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
        }
        
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
    if (!testId || loading || Object.keys(answers).length === 0) return;
    const save = async () => {
      await updateDoc(doc(db, 'tests', testId), { answers, userId: user.uid });
    };
    const t = setTimeout(save, 2000);
    return () => clearTimeout(t);
  }, [answers, testId, loading]);

  const handleAnswerChange = (val: string) => {
    if (!test) return;
    const qId = test.questions[currentIndex].id || currentIndex.toString();
    setAnswers(prev => ({ ...prev, [qId]: val }));
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
    
    // Clean answers to remove any undefined values which Firestore rejects
    const cleanAnswers: Record<string, string> = {};
    Object.entries(answers).forEach(([k, v]) => {
      if (v !== undefined) cleanAnswers[k] = v as string;
    });
    
    let mcqScore = 0;
    const evaluatedQuestions = test.questions.map((q, i) => {
      const qId = q.id || i.toString();
      const ans = cleanAnswers[qId] || null;
      
      // Clean up the question object to ensure no undefined values
      const cleanQ = { ...q };
      Object.keys(cleanQ).forEach(key => {
        const k = key as keyof typeof cleanQ;
        if (cleanQ[k] === undefined) {
          delete cleanQ[k];
        }
      });
      
      if (cleanQ.type === 'MCQ') {
        let score = 0;
        if (ans) {
          if (ans === cleanQ.correctAnswer) score = cleanQ.maxMarks || 0;
          else score = -0.25 * (cleanQ.maxMarks || 0);
        }
        mcqScore += score;
        return { ...cleanQ, userAnswer: ans, score };
      }
      return { ...cleanQ, userAnswer: ans };
    });

    try {
      await updateDoc(doc(db, 'tests', test.id), {
        status: 'completed',
        submittedAt: Date.now(),
        questions: evaluatedQuestions,
        totalScore: mcqScore,
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
  const attemptedCount = Object.keys(answers).filter(k => answers[k] && answers[k].trim() !== '').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50/80 dark:bg-[#05050A] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#9A7D3C] selection:text-white flex flex-col overflow-hidden">
      
      {/* Ambient background blobs for Liquid Glass effect */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 dark:bg-indigo-600/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-400/20 dark:bg-fuchsia-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-400/15 dark:bg-cyan-500/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-purple-400/10 dark:bg-[#9A7D3C]/30 blur-[120px] pointer-events-none" />

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

      <div className="relative z-10 flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
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
                <div className="space-y-4">
                  {currentQ.options.map((opt, i) => (
                    <label 
                      key={i}
                      className={clsx(
                        "flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all backdrop-blur-md group hover:shadow-md hover:-translate-y-0.5",
                        answers[currentQId] === opt 
                          ? "bg-white/90 border-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:border-[#9A7D3C]/50 shadow-md" 
                          : "bg-white/40 border-white/60 hover:bg-white/70 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
                      )}
                    >
                      <input 
                        type="radio" 
                        name={`q-${currentQId}`}
                        value={opt}
                        checked={answers[currentQId] === opt}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        className="mt-1 w-5 h-5 text-[#9A7D3C] focus:ring-[#9A7D3C] border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-offset-0"
                      />
                      <span className="text-slate-800 dark:text-slate-200 text-lg leading-snug">{opt}</span>
                    </label>
                  ))}
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
              <button 
                onClick={handleMarkReview}
                className={clsx(
                  "flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all backdrop-blur-md border shadow-sm",
                  markedForReview[currentQId] 
                    ? "bg-amber-100/80 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30" 
                    : "bg-white/60 text-slate-700 border-white/60 hover:bg-white/90 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10"
                )}
              >
                <Flag className="w-5 h-5" />
                {markedForReview[currentQId] ? 'Marked for Review' : 'Mark for Review'}
              </button>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center justify-center w-14 h-14 rounded-2xl font-bold text-slate-700 bg-white/60 border border-white/60 hover:bg-white/90 disabled:opacity-50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 backdrop-blur-md shadow-sm transition-all hover:-translate-y-0.5"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleNext}
                  disabled={currentIndex === test.questions.length - 1}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-xl shadow-slate-900/20 dark:shadow-white/20 transition-all hover:-translate-y-0.5"
                >
                  Save & Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Sidebar Palette */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#0A0F1C]/40 backdrop-blur-2xl flex flex-col shrink-0 z-20 max-h-64 lg:max-h-none overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-white/60 dark:border-white/10 shrink-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Question Palette</h3>
            <div className="flex flex-wrap lg:grid lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-6 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#9A7D3C] shadow-sm"></div> Answered</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-amber-500 shadow-sm"></div> Marked</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div> Unanswered</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-2 sm:gap-3">
              {test.questions.map((q, i) => {
                const qId = q.id || i.toString();
                const isAnswered = !!answers[qId] && answers[qId].trim() !== '';
                const isMarked = markedForReview[qId];
                const isCurrent = i === currentIndex;
                
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={clsx(
                      'h-10 w-10 sm:h-12 sm:w-12 lg:h-12 lg:w-12 rounded-xl sm:rounded-2xl font-bold text-sm flex items-center justify-center transition-all shadow-sm backdrop-blur-md',
                      isCurrent ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-[#0A0F1C] scale-110 shadow-md' : 'hover:-translate-y-0.5',
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
    </div>
  );
}
