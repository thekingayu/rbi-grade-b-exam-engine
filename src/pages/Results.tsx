import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, Link } from 'react-router-dom';
import { TestAttempt, Question } from '../types';
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { clsx } from 'clsx';

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600 dark:text-emerald-500" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">
          {evaluating ? 'AI is evaluating your descriptive answers...' : 'Loading results...'}
        </p>
      </div>
    );
  }

  if (!test) return <div>Test not found</div>;

  const mcqQuestions = test.questions.filter(q => q.type === 'MCQ');
  const descQuestions = test.questions.filter(q => q.type === 'Descriptive');

  // Stats for Summary
  const correctMCQs = mcqQuestions.filter(q => q.score && q.score > 0).length;
  const incorrectMCQs = mcqQuestions.filter(q => q.score && q.score < 0).length;
  const unattemptedMCQs = mcqQuestions.filter(q => q.score === 0 || q.score === undefined).length;
  
  const pieData = [
    { name: 'Correct', value: correctMCQs, color: '#10b981' }, // emerald-500
    { name: 'Incorrect', value: incorrectMCQs, color: '#ef4444' }, // red-500
    { name: 'Unattempted', value: unattemptedMCQs, color: '#f59e0b' } // amber-500
  ];

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'mcq', label: 'MCQ Review' },
    { id: 'descriptive', label: 'Descriptive Evaluation' },
    { id: 'feedback', label: 'Feedback & Suggestions' }
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">Exam Results</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review your performance and AI feedback</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                activeTab === tab.id 
                  ? 'border-teal-600 text-teal-700 dark:border-emerald-500 dark:text-emerald-400 bg-teal-50/50 dark:bg-emerald-900/10' 
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <>
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-4xl font-bold text-slate-900 dark:text-white">{test.totalScore?.toFixed(1) || 0}</span>
                        <span className="text-xl text-slate-400">/ {getMax(test.questions)}</span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{overallPercentage}% overall</p>
                    </div>

                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-center space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-700 dark:text-slate-300">MCQ correct</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{correctMCQs}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-700 dark:text-slate-300">MCQ incorrect</span>
                        <span className="font-bold text-red-600 dark:text-red-400">{incorrectMCQs}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Unattempted</span>
                        <span className="font-bold text-slate-900 dark:text-white">{unattemptedMCQs}</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-center space-y-4">
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300">Static MCQ</span>
                          <span className="font-bold text-slate-900 dark:text-white">{mcqStaticScore}/{mcqStaticMax}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#9A7D3C] h-full" style={{ width: `${mcqStaticMax > 0 ? (mcqStaticScore / mcqStaticMax) * 100 : 0}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300">Dynamic MCQ</span>
                          <span className="font-bold text-slate-900 dark:text-white">{mcqDynamicScore}/{mcqDynamicMax}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#9A7D3C] h-full" style={{ width: `${mcqDynamicMax > 0 ? (mcqDynamicScore / mcqDynamicMax) * 100 : 0}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-center space-y-4">
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300">Static descriptive</span>
                          <span className="font-bold text-slate-900 dark:text-white">{descStaticScore}/{descStaticMax}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-300 dark:bg-slate-600 h-full" style={{ width: `${descStaticMax > 0 ? (descStaticScore / descStaticMax) * 100 : 0}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300">Dynamic descriptive</span>
                          <span className="font-bold text-slate-900 dark:text-white">{descDynamicScore}/{descDynamicMax}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-300 dark:bg-slate-600 h-full" style={{ width: `${descDynamicMax > 0 ? (descDynamicScore / descDynamicMax) * 100 : 0}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === 'mcq' && (
            <div className="space-y-6">
              {mcqQuestions.map((q, i) => {
                const isCorrect = q.userAnswer === q.correctAnswer;
                const isUnattempted = !q.userAnswer;
                
                return (
                  <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 p-6">
                    <div className="mb-4">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full">
                        {q.sourceTag}
                      </span>
                    </div>
                    
                    <p className="text-slate-900 dark:text-white font-medium mb-6 leading-relaxed">
                      {q.text}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Your Answer */}
                      <div className={`p-4 rounded-xl border ${
                        isCorrect 
                          ? 'bg-emerald-50 border-emerald-500/30 dark:bg-emerald-900/10 dark:border-emerald-500/30' 
                          : isUnattempted 
                            ? 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                            : 'bg-red-50 border-red-500/30 dark:bg-red-900/10 dark:border-red-500/30'
                      }`}>
                        <p className="text-xs text-slate-500 mb-1 font-medium">Your answer</p>
                        <p className={
                          isCorrect 
                            ? 'text-emerald-700 dark:text-emerald-400' 
                            : isUnattempted 
                              ? 'text-slate-500 dark:text-slate-400 italic'
                              : 'text-red-700 dark:text-red-400'
                        }>
                          {q.userAnswer || 'Not attempted'}
                        </p>
                      </div>

                      {/* Correct Answer */}
                      <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-500/30 dark:bg-emerald-900/10 dark:border-emerald-500/30">
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mb-1 font-medium">Correct answer</p>
                        <p className="text-emerald-700 dark:text-emerald-400">
                          {q.correctAnswer}
                        </p>
                      </div>
                    </div>

                    {(q as any).explanation && (
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {(q as any).explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'descriptive' && (
            <div className="space-y-8">
              {descQuestions.map((q, i) => {
                const qId = q.id || (test.questions.indexOf(q)).toString();
                const evalData = test.evaluations?.[qId];
                
                return (
                  <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 p-6">
                    <div className="mb-4">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full">
                        {q.sourceTag}
                      </span>
                    </div>
                    
                    <p className="text-slate-900 dark:text-white font-medium mb-6 leading-relaxed">
                      {q.text}
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Your Answer Column */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your Answer</h4>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm h-80 overflow-y-auto">
                          {q.userAnswer || <span className="italic text-slate-400">No answer provided.</span>}
                        </div>
                      </div>
                      
                      {/* AI Evaluation Column */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Evaluation</h4>
                          <span className="font-bold text-lg text-slate-900 dark:text-white">
                            {evalData?.totalScore || 0} <span className="text-sm text-slate-400 font-normal">/ {q.maxMarks}</span>
                          </span>
                        </div>
                        
                        {evalData && (
                          <div className="space-y-4">
                            {Object.entries(evalData.scoreBreakdown || {}).map(([criterion, score], idx) => {
                              const maxForCrit = q.markingScheme?.[criterion] || 5;
                              return (
                                <div key={idx}>
                                  <div className="flex justify-between items-center text-sm mb-1.5">
                                    <span className="text-slate-600 dark:text-slate-400">{criterion}</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{score as number}/{maxForCrit}</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-[#9A7D3C] h-full" style={{ width: `${maxForCrit > 0 ? ((score as number) / maxForCrit) * 100 : 0}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-500" /> Areas for Improvement
                              </h5>
                              <ul className="space-y-2">
                                {evalData.feedbackPoints?.map((pt: string, idx: number) => (
                                  <li key={idx} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="text-red-500 shrink-0">•</span>
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
                      <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" /> Ideal / Model Answer
                        </h4>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                          {q.modelAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'feedback' && test.overallFeedback && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
                
                <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" /> Strengths
                    </h4>
                    <ul className="space-y-3">
                      {test.overallFeedback.strengths.map((pt, idx) => (
                        <li key={idx} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-2">
                      <MinusCircle className="w-5 h-5" /> Weaknesses
                    </h4>
                    <ul className="space-y-3">
                      {test.overallFeedback.weaknesses.map((pt, idx) => (
                        <li key={idx} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    Actionable Next Steps
                  </h4>
                  <div className="grid gap-4">
                    {test.overallFeedback.nextSteps.map((pt, idx) => (
                      <div key={idx} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
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
