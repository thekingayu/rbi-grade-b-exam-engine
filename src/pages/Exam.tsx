import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { TestAttempt, Question } from '../types';
import { Clock, ChevronLeft, ChevronRight, Flag, CheckCircle, Loader2 } from 'lucide-react';
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
        setTimeLeft(data.durationSeconds);
        // If it was already started, load answers. 
        // In a real app we'd calculate timeLeft based on Date.now() vs startedAt
        if (data.status === 'setup') {
          await updateDoc(docRef, { status: 'in-progress', startedAt: Date.now() });
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

  // Auto-save
  useEffect(() => {
    if (!testId || loading || Object.keys(answers).length === 0) return;
    const save = async () => {
      // Just update the test doc with answers map. Wait, we don't have answers map directly in schema, 
      // but we can just store answers inside questions or a separate field. Let's store inside the questions array.
      // Wait, let's keep a separate "answers" field on the document to make it easier.
      // We didn't declare it in the schema, but we can update it.
      await updateDoc(doc(db, 'tests', testId), { answers });
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
    
    // Auto-grade MCQs
    let mcqScore = 0;
    const evaluatedQuestions = test.questions.map((q, i) => {
      const qId = q.id || i.toString();
      const ans = answers[qId];
      if (q.type === 'MCQ') {
        let score = 0;
        if (ans) {
          if (ans === q.correctAnswer) score = q.maxMarks;
          else score = -0.25 * q.maxMarks; // negative marking
        }
        mcqScore += score;
        return { ...q, userAnswer: ans, score };
      }
      return { ...q, userAnswer: ans };
    });

    try {
      await updateDoc(doc(db, 'tests', test.id), {
        status: 'completed',
        submittedAt: Date.now(),
        questions: evaluatedQuestions,
        totalScore: mcqScore, // Initial score before descriptive grading
        answers
      });
      
      // Navigate to results
      navigate(`/results/${test.id}`);
    } catch (e) {
      console.error(e);
      alert("Error submitting. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading || !test) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900 dark:text-white">Loading exam...</div>;
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
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="font-serif font-bold text-lg text-slate-900 dark:text-white">
          RBI Grade B Prep Engine
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg font-mono text-lg font-medium text-slate-900 dark:text-white">
            <Clock className="w-5 h-5 text-teal-600 dark:text-emerald-400" />
            <span className={timeLeft < 300 ? 'text-red-500' : ''}>{formatTime(timeLeft)}</span>
          </div>
          <button 
            onClick={() => setShowConfirm(true)}
            className="bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-medium transition-colors"
          >
            Submit Test
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full">
                Question {currentIndex + 1} of {test.questions.length}
              </span>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full">
                {currentQ.sourceTag}
              </span>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full">
                {currentQ.type}
              </span>
            </div>
            
            {currentQ.type === 'Descriptive' && (
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Word limit: {currentQ.wordLimit || 250} words • {currentQ.maxMarks || 15} marks
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 border-none p-0 shadow-none mb-8">
              <p className="text-lg text-slate-900 dark:text-white leading-relaxed mb-8">
                {currentQ.text}
              </p>

              {currentQ.type === 'MCQ' && currentQ.options && (
                <div className="space-y-3">
                  {currentQ.options.map((opt, i) => (
                    <label 
                      key={i}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        answers[currentQId] === opt 
                          ? 'bg-teal-50 border-teal-500 dark:bg-emerald-900/20 dark:border-emerald-500' 
                          : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name={`q-${currentQId}`}
                        value={opt}
                        checked={answers[currentQId] === opt}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500 border-slate-300"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{opt}</span>
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
                    className="w-full h-80 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 dark:focus:ring-emerald-500 outline-none text-slate-900 dark:text-white resize-y"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {answers[currentQId]?.trim().split(/\s+/).filter(w => w.length > 0).length || 0} / {currentQ.wordLimit || 250} words
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button 
                onClick={handleMarkReview}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  markedForReview[currentQId] 
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                    : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Flag className="w-4 h-4" />
                {markedForReview[currentQId] ? 'Marked for Review' : 'Mark for Review'}
              </button>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button 
                  onClick={handleNext}
                  disabled={currentIndex === test.questions.length - 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Save & Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Palette */}
        <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">Question Palette</h3>
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-500"></div> Answered</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Marked</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-700"></div> Unanswered</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-2">
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
                      'h-10 rounded font-medium text-sm flex items-center justify-center transition-all',
                      isCurrent ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-900' : '',
                      isMarked ? 'bg-amber-500 text-white border-amber-600' : 
                      isAnswered ? 'bg-teal-500 text-white border-teal-600' : 
                      'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
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
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white mb-2">Submit Exam?</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              You have attempted {attemptedCount} out of {test.questions.length} questions. You cannot change your answers after submission.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
