import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, Link } from 'react-router-dom';
import { TestAttempt, Question } from '../types';
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, Loader2, Sparkles, Award, BarChart3, FileText, CheckCircle2, TrendingUp, SlidersHorizontal, FileEdit, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { clsx } from 'clsx';
import { checkMCQCorrect } from '../utils/exam';

export function Results({ user }: { user: User }) {
  const { testId } = useParams();
  const [test, setTest] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'mcq' | 'descriptive' | 'feedback'>('summary');

  useEffect(() => {
    const fetchAndEvaluate = async () => {
      if (!testId) return;
      try {
        const docRef = doc(db, 'tests', testId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as TestAttempt;
          
          // Reconcile and heal MCQ answers and scores if missing or inconsistent
          let questionsModified = false;
          const updatedQuestions = (data.questions || []).map((q, i) => {
            const qId = q.id || i.toString();
            // Reconcile user answer from q.userAnswer OR data.answers map
            const rawUserAnswer = q.userAnswer || data.answers?.[qId] || data.answers?.[i.toString()] || null;
            const cleanUserAnswer = (rawUserAnswer && rawUserAnswer.trim() !== '') ? rawUserAnswer.trim() : null;
            
            if (q.type === 'MCQ') {
              const maxMarks = (typeof q.maxMarks === 'number' && q.maxMarks > 0) ? q.maxMarks : 1;
              const isCorrect = cleanUserAnswer ? checkMCQCorrect(cleanUserAnswer, q.correctAnswer, q.options) : false;
              let score = 0;
              if (cleanUserAnswer) {
                score = isCorrect ? maxMarks : -0.25 * maxMarks;
              }
              
              if (q.userAnswer !== cleanUserAnswer || q.score !== score || q.maxMarks !== maxMarks || q.isCorrect !== isCorrect || !q.id) {
                questionsModified = true;
                return {
                  ...q,
                  id: qId,
                  maxMarks,
                  userAnswer: cleanUserAnswer,
                  score,
                  isCorrect
                };
              }
            } else {
              if (q.userAnswer !== cleanUserAnswer || !q.id) {
                questionsModified = true;
                return {
                  ...q,
                  id: qId,
                  userAnswer: cleanUserAnswer
                };
              }
            }
            return q;
          });

          if (questionsModified) {
            data.questions = updatedQuestions;
            const totalMcqScore = data.questions
              .filter(q => q.type === 'MCQ')
              .reduce((sum, q) => sum + (q.score || 0), 0);
            const totalDescScore = Object.values(data.evaluations || {}).reduce((sum, ev) => sum + (ev.totalScore || 0), 0);
            data.totalScore = Number((totalMcqScore + totalDescScore).toFixed(2));
            try {
              await updateDoc(docRef, { questions: updatedQuestions, totalScore: data.totalScore });
            } catch (err) {
              console.error("Auto-heal update failed", err);
            }
          }

          // Check if descriptive answers need evaluation
          const descQuestions = data.questions.filter(q => q.type === 'Descriptive');
          const needsEval = descQuestions.some(q => q.userAnswer && (!data.evaluations || !data.evaluations[q.id || '']));
          
          if (needsEval && !evaluating) {
            setEvaluating(true);
            const evals = data.evaluations || {};
            let newTotalScore = data.totalScore || 0;
            
            for (let i = 0; i < data.questions.length; i++) {
              const q = data.questions[i];
              const qId = q.id || i.toString();
              
              if (q.type === 'Descriptive' && q.userAnswer && !evals[qId]) {
                try {
                  const res = await fetch('/api/evaluate-descriptive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: q, userAnswer: q.userAnswer })
                  });
                  if (res.ok) {
                    const evalData = await res.json();
                    evals[qId] = evalData;
                    newTotalScore += evalData.totalScore || 0;
                  }
                } catch (e) {
                  console.error("Eval error", e);
                }
              }
            }
            
            let overallFeedback = data.overallFeedback;
            if (!overallFeedback) {
              try {
                const res = await fetch('/api/generate-overall-feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ test: { ...data, evaluations: evals } })
                });
                if (res.ok) {
                  overallFeedback = await res.json();
                }
              } catch (e) {
                console.error("Overall feedback error", e);
              }
            }

            await updateDoc(docRef, { evaluations: evals, totalScore: newTotalScore, overallFeedback });
            data.evaluations = evals;
            data.totalScore = newTotalScore;
            data.overallFeedback = overallFeedback;
            setEvaluating(false);
          } else if (!data.overallFeedback && !evaluating) {
            setEvaluating(true);
            try {
              const res = await fetch('/api/generate-overall-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: data })
              });
              if (res.ok) {
                const overallFeedback = await res.json();
                await updateDoc(docRef, { overallFeedback });
                data.overallFeedback = overallFeedback;
              }
            } catch (e) {
              console.error("Overall feedback error", e);
            }
            setEvaluating(false);
          }
          
          setTest({ ...data, id: snap.id });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAndEvaluate();
  }, [testId]);

  if (loading || evaluating) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[#9A7D3C] dark:text-[#E5C378] shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#9A7D3C] to-amber-500 opacity-20 blur-lg animate-pulse" />
        </div>
        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {evaluating ? 'AI Evaluation in Progress' : 'Synthesizing Results...'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            {evaluating 
              ? 'Gemini is rigorously grading your descriptive answers against RBI Grade B rubrics...' 
              : 'Compiling your score breakdown and performance analytics...'}
          </p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="max-w-md mx-auto text-center py-16 bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/10 p-8 shadow-2xl">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Test Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">The requested test record could not be loaded.</p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#9A7D3C] to-amber-500 text-white font-bold text-sm shadow-md"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const mcqQuestions = test.questions.filter(q => q.type === 'MCQ');
  const descQuestions = test.questions.filter(q => q.type === 'Descriptive');

  // Stats for Summary: Strictly determine status based on presence of answer and correctness
  const isQuestionAttempted = (q: Question) => {
    if (q.userAnswer && q.userAnswer.trim() !== '') return true;
    const qId = q.id || test.questions.indexOf(q).toString();
    const mapAns = test.answers?.[qId] || test.answers?.[test.questions.indexOf(q).toString()];
    return !!(mapAns && mapAns.trim() !== '');
  };

  const getQuestionUserAnswer = (q: Question) => {
    if (q.userAnswer && q.userAnswer.trim() !== '') return q.userAnswer;
    const qId = q.id || test.questions.indexOf(q).toString();
    return test.answers?.[qId] || test.answers?.[test.questions.indexOf(q).toString()] || null;
  };

  const isQuestionCorrect = (q: Question) => {
    const userAns = getQuestionUserAnswer(q);
    if (!userAns) return false;
    return checkMCQCorrect(userAns, q.correctAnswer, q.options);
  };

  const correctMCQs = mcqQuestions.filter(q => isQuestionAttempted(q) && isQuestionCorrect(q)).length;
  const incorrectMCQs = mcqQuestions.filter(q => isQuestionAttempted(q) && !isQuestionCorrect(q)).length;
  const unattemptedMCQs = mcqQuestions.filter(q => !isQuestionAttempted(q)).length;
  
  const pieData = [
    { name: 'Correct', value: correctMCQs, color: '#10b981' }, // emerald-500
    { name: 'Incorrect', value: incorrectMCQs, color: '#ef4444' }, // red-500
    { name: 'Unattempted', value: unattemptedMCQs, color: '#f59e0b' } // amber-500
  ];

  const tabs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'mcq', label: 'MCQ Review', icon: CheckCircle2 },
    { id: 'descriptive', label: 'Descriptive Evaluation', icon: FileText },
    { id: 'feedback', label: 'Feedback & Suggestions', icon: Sparkles }
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-3">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl rounded-xl border border-slate-200/80 dark:border-white/10 hover:border-[#9A7D3C]/60 dark:hover:border-[#9A7D3C]/60 hover:bg-white/90 dark:hover:bg-white/10 transition-all shadow-xs hover:shadow-sm group cursor-pointer text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#9A7D3C] group-hover:-translate-x-1 transition-transform cursor-pointer" />
            <span className="cursor-pointer">Back to Dashboard</span>
          </Link>
          
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9A7D3C]/10 dark:bg-[#9A7D3C]/20 border border-[#9A7D3C]/30 dark:border-[#9A7D3C]/40 backdrop-blur-md mb-2">
              <Award className="w-3.5 h-3.5 text-[#9A7D3C] dark:text-[#E5C378]" />
              <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-amber-200 tracking-wider uppercase">
                EXAM EVALUATION & PERFORMANCE REPORT
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-serif font-black text-slate-900 dark:text-white">
              Exam <span className="bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-500 dark:from-[#F3E5AB] dark:via-amber-400 dark:to-emerald-400 bg-clip-text text-transparent">Results</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm mt-1">
              Review your comprehensive performance analytics, answer keys, and AI rubrics.
            </p>
          </div>
        </div>
      </div>

      {/* Main Container with Futuristic Glass Tabs */}
      <div className="bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-[0_0_40px_-15px_rgba(0,0,0,0.8)]">
        {/* Futuristic Navigation Bar */}
        <div className="flex overflow-x-auto border-b border-slate-200/80 dark:border-white/10 p-2 sm:p-2.5 gap-1.5 bg-slate-100/50 dark:bg-black/20">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 cursor-pointer',
                  isActive 
                    ? 'bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-600 text-white shadow-lg shadow-[#9A7D3C]/25 dark:shadow-[0_0_20px_rgba(245,158,11,0.25)]' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                )}
              >
                <Icon className={clsx("w-4 h-4", isActive ? "text-white" : "text-slate-500 dark:text-slate-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-8">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {(() => {
                const mcqStaticQs = mcqQuestions.filter(q => q.sourceTag === 'Static');
                const mcqDynamicQs = mcqQuestions.filter(q => q.sourceTag === 'Dynamic');
                const descStaticQs = descQuestions.filter(q => q.sourceTag === 'Static');
                const descDynamicQs = descQuestions.filter(q => q.sourceTag === 'Dynamic');
                
                const getScore = (qs: typeof test.questions) => qs.reduce((sum, q) => {
                  if (q.type === 'Descriptive') {
                    const qId = q.id || test.questions.indexOf(q).toString();
                    return sum + (test.evaluations?.[qId]?.totalScore || 0);
                  }
                  return sum + Math.max(0, q.score || 0);
                }, 0);
                const getMax = (qs: typeof test.questions) => qs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
                
                const mcqStaticScore = getScore(mcqStaticQs);
                const mcqStaticMax = getMax(mcqStaticQs);
                const mcqDynamicScore = getScore(mcqDynamicQs);
                const mcqDynamicMax = getMax(mcqDynamicQs);
                
                const descStaticScore = getScore(descStaticQs);
                const descStaticMax = getMax(descStaticQs);
                const descDynamicScore = getScore(descDynamicQs);
                const descDynamicMax = getMax(descDynamicQs);

                const overallPercentage = test.totalScore && getMax(test.questions) > 0 
                  ? Math.round((test.totalScore / getMax(test.questions)) * 100) 
                  : 0;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {/* Card 1: Overall Score - Gold Lighted */}
                    <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-slate-200/80 dark:border-amber-500/25 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(245,158,11,0.15)] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total Score
                          </span>
                          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#9A7D3C] dark:text-[#E5C378] border border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center justify-center shrink-0">
                            <Award className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-4xl font-serif font-black text-slate-900 dark:text-white">
                            {test.totalScore?.toFixed(1) || 0}
                          </span>
                          <span className="text-lg font-mono text-slate-400 dark:text-slate-500">
                            / {getMax(test.questions)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aggregate Accuracy</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-[#E5C378] border border-amber-500/25">
                          {overallPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Card 2: MCQ Accuracy Breakdown */}
                    <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-slate-200/80 dark:border-emerald-500/25 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(16,185,129,0.15)] flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          MCQ Tally
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.2)] flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" /> Correct
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{correctMCQs}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" /> Incorrect
                          </span>
                          <span className="font-mono font-bold text-red-600 dark:text-red-400">{incorrectMCQs}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]" /> Skipped
                          </span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{unattemptedMCQs}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: MCQ Static vs Dynamic - Cyan Lighted */}
                    <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-slate-200/80 dark:border-cyan-500/25 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(6,182,212,0.15)] flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          MCQ Modules
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shadow-[0_0_10px_rgba(6,182,212,0.2)] flex items-center justify-center shrink-0">
                          <SlidersHorizontal className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-3.5">
                        <div>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Static MCQ</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{mcqStaticScore}/{mcqStaticMax}</span>
                          </div>
                          <div className="w-full bg-slate-200/60 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]" style={{ width: `${mcqStaticMax > 0 ? (mcqStaticScore / mcqStaticMax) * 100 : 0}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Dynamic MCQ</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{mcqDynamicScore}/{mcqDynamicMax}</span>
                          </div>
                          <div className="w-full bg-slate-200/60 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${mcqDynamicMax > 0 ? (mcqDynamicScore / mcqDynamicMax) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Descriptive Modules - Purple Lighted */}
                    <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-slate-200/80 dark:border-purple-500/25 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(168,85,247,0.15)] flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Descriptive Rubric
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 shadow-[0_0_10px_rgba(168,85,247,0.2)] flex items-center justify-center shrink-0">
                          <FileEdit className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-3.5">
                        <div>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Static Desc.</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{descStaticScore}/{descStaticMax}</span>
                          </div>
                          <div className="w-full bg-slate-200/60 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" style={{ width: `${descStaticMax > 0 ? (descStaticScore / descStaticMax) * 100 : 0}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Dynamic Desc.</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{descDynamicScore}/{descDynamicMax}</span>
                          </div>
                          <div className="w-full bg-slate-200/60 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-500 to-pink-500 h-full rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" style={{ width: `${descDynamicMax > 0 ? (descDynamicScore / descDynamicMax) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MCQ Tab Review */}
          {activeTab === 'mcq' && (
            <div className="space-y-6">
              {mcqQuestions.map((q, i) => {
                const userAns = getQuestionUserAnswer(q);
                const isAttempted = !!(userAns && userAns.trim() !== '');
                const isCorrect = isAttempted && checkMCQCorrect(userAns, q.correctAnswer, q.options);
                const isUnattempted = !isAttempted;
                const scoreDisplay = isCorrect ? `+${q.maxMarks || 1} Marks` : isUnattempted ? '0 Marks' : '-0.25 Marks';
                
                return (
                  <div key={i} className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl p-5 sm:p-6 shadow-lg shadow-slate-200/30 dark:shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-[#E5C378] border border-amber-500/25 text-xs font-mono font-bold rounded-full">
                          {q.sourceTag}
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                          QUESTION {i + 1} OF {mcqQuestions.length}
                        </span>
                      </div>
                      <span className={clsx(
                        "px-3 py-1 text-xs font-bold rounded-full border shadow-xs",
                        isCorrect
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : isUnattempted
                            ? "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                            : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                      )}>
                        {isCorrect ? '✓ Correct' : isUnattempted ? '○ Unattempted' : '✗ Incorrect'} ({scoreDisplay})
                      </span>
                    </div>
                    
                    <p className="text-slate-900 dark:text-white font-medium mb-5 text-sm sm:text-base leading-relaxed">
                      {q.text}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                      {/* Your Answer */}
                      <div className={clsx(
                        'p-4 rounded-xl border backdrop-blur-md',
                        isCorrect 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300' 
                          : isUnattempted 
                            ? 'bg-slate-100/50 border-slate-200/80 dark:bg-white/5 dark:border-white/10'
                            : 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-300'
                      )}>
                        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Your Answer</p>
                        <p className="font-semibold text-sm">
                          {userAns || <span className="italic text-slate-400">Not attempted</span>}
                        </p>
                      </div>

                      {/* Correct Answer */}
                      <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300 backdrop-blur-md">
                        <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 mb-1">Correct Answer</p>
                        <p className="font-semibold text-sm">
                          {q.correctAnswer}
                        </p>
                      </div>
                    </div>

                    {q.options && q.options.length > 0 && (
                      <div className="mb-4 pt-3 border-t border-slate-200/60 dark:border-white/10">
                        <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Options Review</p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, optIdx) => {
                            const optLetter = ['A', 'B', 'C', 'D', 'E'][optIdx] || String.fromCharCode(65 + optIdx);
                            const isUserPick = userAns ? (userAns === opt || userAns.toLowerCase() === opt.toLowerCase()) : false;
                            const isCorrectPick = q.correctAnswer ? checkMCQCorrect(opt, q.correctAnswer, q.options) : false;
                            return (
                              <div 
                                key={optIdx}
                                className={clsx(
                                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border transition-colors",
                                  isCorrectPick
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-300 font-medium"
                                    : isUserPick && !isCorrectPick
                                      ? "bg-red-500/15 border-red-500/40 text-red-900 dark:text-red-300 font-medium"
                                      : "bg-white/40 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300"
                                )}
                              >
                                <span className={clsx(
                                  "w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center font-mono shrink-0",
                                  isCorrectPick
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : isUserPick && !isCorrectPick
                                      ? "bg-red-600 text-white shadow-xs"
                                      : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                                )}>
                                  {optLetter}
                                </span>
                                <span className="flex-1">{opt}</span>
                                {isCorrectPick && (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold ml-2">✓ Correct Answer</span>
                                )}
                                {isUserPick && !isCorrectPick && (
                                  <span className="text-xs text-red-600 dark:text-red-400 font-bold ml-2">✗ Your Choice</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(q as any).explanation && (
                      <div className="border-t border-slate-200/60 dark:border-white/10 pt-4 mt-4">
                        <p className="text-[11px] font-mono font-bold text-amber-700 dark:text-[#E5C378] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" /> Explanation & Rationale
                        </p>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {(q as any).explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Descriptive Tab Evaluation */}
          {activeTab === 'descriptive' && (
            <div className="space-y-8">
              {descQuestions.map((q, i) => {
                const qId = q.id || (test.questions.indexOf(q)).toString();
                const evalData = test.evaluations?.[qId];
                
                return (
                  <div key={i} className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl p-6 shadow-xl shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(0,0,0,0.5)]">
                    <div className="mb-4">
                      <span className="px-3 py-1 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25 text-xs font-mono font-bold rounded-full">
                        {q.sourceTag} DESCRIPTIVE
                      </span>
                    </div>
                    
                    <p className="text-slate-900 dark:text-white font-medium mb-6 text-sm sm:text-base leading-relaxed">
                      {q.text}
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
                      {/* Your Answer Column */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Submitted Answer</h4>
                        <div className="p-4 bg-white/60 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm h-80 overflow-y-auto leading-relaxed shadow-inner">
                          {q.userAnswer || <span className="italic text-slate-400">No answer provided.</span>}
                        </div>
                      </div>
                      
                      {/* AI Evaluation Column */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">AI Grading Rubric</h4>
                          <span className="font-mono font-bold text-lg text-[#9A7D3C] dark:text-[#E5C378]">
                            {evalData?.totalScore || 0} <span className="text-sm text-slate-400 font-normal">/ {q.maxMarks} Marks</span>
                          </span>
                        </div>
                        
                        {evalData && (
                          <div className="space-y-4">
                            {Object.entries(evalData.scoreBreakdown || {}).map(([criterion, score], idx) => {
                              const maxForCrit = q.markingScheme?.[criterion] || 5;
                              return (
                                <div key={idx}>
                                  <div className="flex justify-between items-center text-xs sm:text-sm mb-1.5">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">{criterion}</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-white">{score as number}/{maxForCrit}</span>
                                  </div>
                                  <div className="w-full bg-slate-200/60 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                                    <div className="bg-gradient-to-r from-[#9A7D3C] to-amber-500 h-full rounded-full shadow-[0_0_8px_rgba(245,158,11,0.4)]" style={{ width: `${maxForCrit > 0 ? ((score as number) / maxForCrit) * 100 : 0}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="pt-4 border-t border-slate-200/60 dark:border-white/10 mt-6">
                              <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" /> Areas for Improvement
                              </h5>
                              <ul className="space-y-2">
                                {evalData.feedbackPoints?.map((pt: string, idx: number) => (
                                  <li key={idx} className="flex gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                    <span className="text-amber-500 shrink-0">•</span>
                                    <span>{pt}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Model Answer Section */}
                    {q.modelAnswer && (
                      <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-white/10">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" /> Ideal / Benchmark Model Answer
                        </h4>
                        <div className="p-4 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 rounded-2xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-xs sm:text-sm leading-relaxed shadow-xs">
                          {q.modelAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && test.overallFeedback && (
            <div className="space-y-6">
              <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(0,0,0,0.5)]">
                
                <div className="grid md:grid-cols-2 gap-8 sm:gap-10">
                  <div className="space-y-4">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" /> Key Conceptual Strengths
                    </h4>
                    <ul className="space-y-3">
                      {test.overallFeedback.strengths.map((pt, idx) => (
                        <li key={idx} className="flex gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <MinusCircle className="w-4 h-4 text-amber-500" /> High-Priority Knowledge Gaps
                    </h4>
                    <ul className="space-y-3">
                      {test.overallFeedback.weaknesses.map((pt, idx) => (
                        <li key={idx} className="flex gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200/60 dark:border-white/10">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#9A7D3C]" /> Actionable Recommended Steps
                  </h4>
                  <div className="grid gap-3.5">
                    {test.overallFeedback.nextSteps.map((pt, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 bg-white/60 dark:bg-white/[0.02] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:border-[#9A7D3C]/40 transition-colors">
                        <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-r from-[#9A7D3C] to-amber-500 text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs">
                          {idx + 1}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                          {pt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
