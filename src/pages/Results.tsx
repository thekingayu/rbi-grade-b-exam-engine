import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, Link } from 'react-router-dom';
import { TestAttempt, Question } from '../types';
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, Sparkles, Award, BarChart3, FileText, CheckCircle2, SlidersHorizontal, FileEdit, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { clsx } from 'clsx';
import { checkMCQCorrect } from '../utils/exam';
import { evaluateAndPersistTest, evaluateSingleDescriptiveQuestion, isDescriptiveEvaluationValid } from '../services/evaluation';
import { FuturisticSpinner, FuturisticProgressBar } from '../components/FuturisticLoader';
import { getSubjectBySlug } from '../data/subjects';
import { motion, AnimatePresence } from 'motion/react';
import {
  MotionPage,
  MotionStaggerGrid,
  MotionStaggerItem,
  AnimatedNumber,
  SPRING_SNAPPY,
  EASE_OUT_EXPO,
} from '../components/MotionPrimitives';

export function Results({ user }: { user: User }) {
  const { testId } = useParams();
  const [test, setTest] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ message: 'Loading results...', percent: 10 });
  const [activeTab, setActiveTab] = useState<'summary' | 'mcq' | 'descriptive' | 'feedback'>('summary');
  const [mcqSectionFilter, setMcqSectionFilter] = useState<string>('all');
  const [descSectionFilter, setDescSectionFilter] = useState<string>('all');
  const [mcqPage, setMcqPage] = useState<number>(1);
  const [reEvaluatingQId, setReEvaluatingQId] = useState<string | null>(null);
  const [reEvaluatingAll, setReEvaluatingAll] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadOrEvaluate = async () => {
      if (!testId) return;
      try {
        setLoading(true);
        const docRef = doc(db, 'tests', testId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          if (!isCancelled) {
            setTest(null);
            setLoading(false);
          }
          return;
        }

        const data = { ...snap.data(), id: snap.id } as TestAttempt;

        // Check if any descriptive answer is missing genuine evaluation
        const pendingDescQuestions = (data.questions || []).filter((q, idx) => {
          if (q.type !== 'Descriptive') return false;
          const ans = q.userAnswer || data.answers?.[q.id || idx.toString()] || data.answers?.[idx.toString()];
          if (!ans || ans.trim() === '') return false; // unattempted
          const qId = q.id || idx.toString();
          const ev = data.evaluations?.[qId];
          return !isDescriptiveEvaluationValid(ev);
        });

        const hasEvals = !!data.evaluations && Object.keys(data.evaluations).length > 0;
        const hasFeedback = !!data.overallFeedback && Array.isArray(data.overallFeedback.strengths) && data.overallFeedback.strengths.length > 0;
        const isCompletedAndEvaluated = (data.isEvaluated === true && pendingDescQuestions.length === 0) || (hasEvals && hasFeedback && pendingDescQuestions.length === 0);

        if (isCompletedAndEvaluated) {
          // This test's evaluation is already stored in the database and complete!
          if (!data.isEvaluated) {
            updateDoc(docRef, { isEvaluated: true, userId: user.uid }).catch(() => {});
          }

          if (!isCancelled) {
            setTest(data);
            setLoading(false);
            setEvaluating(false);
          }
          return;
        }

        // Test has not been evaluated or has pending descriptive questions
        if (!isCancelled) {
          setEvaluating(true);
          setEvalProgress({ message: 'Grading descriptive answers with RBI Grade B rubrics...', percent: 25 });
        }

        const evaluatedData = await evaluateAndPersistTest(
          testId,
          data,
          user.uid,
          (message, percent) => {
            if (!isCancelled) {
              setEvalProgress({ message, percent: percent || 50 });
            }
          }
        );

        if (!isCancelled) {
          setTest(evaluatedData);
          setEvaluating(false);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading/evaluating test:", err);
        if (!isCancelled) {
          setEvaluating(false);
          setLoading(false);
        }
      }
    };

    loadOrEvaluate();

    return () => {
      isCancelled = true;
    };
  }, [testId, user.uid]);

  const handleReEvaluateQuestion = async (qId: string) => {
    if (!test || !testId || reEvaluatingQId) return;
    try {
      setReEvaluatingQId(qId);
      const updated = await evaluateSingleDescriptiveQuestion(testId, test, qId, user.uid);
      setTest(updated);
    } catch (err) {
      console.error("Failed to re-evaluate question:", err);
    } finally {
      setReEvaluatingQId(null);
    }
  };

  const handleReEvaluateAllDescriptive = async () => {
    if (!test || !testId || reEvaluatingAll) return;
    try {
      setReEvaluatingAll(true);
      setEvaluating(true);
      setEvalProgress({ message: 'Re-evaluating all descriptive answers against RBI Grade B standards...', percent: 20 });
      
      // Clear descriptive evaluations to force full recalculation
      const clearedTest = {
        ...test,
        evaluations: Object.fromEntries(
          Object.entries(test.evaluations || {}).filter(([k]) => {
            const q = test.questions.find((quest, i) => (quest.id || i.toString()) === k);
            return q && q.type !== 'Descriptive';
          })
        )
      };

      const updated = await evaluateAndPersistTest(testId, clearedTest, user.uid, (message, percent) => {
        setEvalProgress({ message, percent: percent || 50 });
      });
      setTest(updated);
    } catch (err) {
      console.error("Failed to re-evaluate all descriptive answers:", err);
    } finally {
      setReEvaluatingAll(false);
      setEvaluating(false);
    }
  };

  if (loading || evaluating) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 px-4">
        <div className="w-20 h-20 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] flex items-center justify-center text-[#0D47FF] dark:text-[#ECD5FF]">
          <FuturisticSpinner size="xl" color="cobalt" />
        </div>
        <div className="text-center space-y-3 max-w-md w-full bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-6">
          <h3 className="text-xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
            {evaluating ? 'Grading & Storing Descriptive Rubrics' : 'Loading Results...'}
          </h3>
          <p className="text-sm font-medium text-[#5C5A52] dark:text-[#A8A396]">
            {evalProgress.message}
          </p>
          {evaluating && (
            <div className="w-full pt-2">
              <FuturisticProgressBar 
                progress={evalProgress.percent}
                color="cobalt"
                height={7}
                label="SYNCHRONIZING BENCHMARK MARKS"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="max-w-md mx-auto text-center py-14 bg-[#FFFFFF] dark:bg-[#1C1C1A] rounded-2xl border-[1.5px] border-[#141413] dark:border-[#FAF8EC] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-8 mt-8">
        <div className="w-12 h-12 rounded-xl bg-[#FFD426] border-[1.5px] border-[#141413] flex items-center justify-center mx-auto mb-4 text-[#141413]">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">Test Not Found</h2>
        <p className="text-sm text-[#5C5A52] dark:text-[#A8A396] mt-1 mb-6">The requested test record could not be loaded.</p>
        <Link 
          to="/history" 
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47FF] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] font-bold text-sm hover:bg-[#0B3CD9] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Examination Archive
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

  const tabs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'mcq', label: 'MCQ Review', icon: CheckCircle2 },
    { id: 'descriptive', label: 'Descriptive Evaluation', icon: FileText },
    { id: 'feedback', label: 'Feedback & Suggestions', icon: Sparkles }
  ] as const;

  return (
    <MotionPage className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link 
              to="/history" 
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FFFFFF] dark:bg-[#1C1C1A] rounded-xl border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] transition-colors group text-[#141413] dark:text-[#FAF8EC] font-semibold text-xs sm:text-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#0D47FF] dark:text-[#ECD5FF] group-hover:-translate-x-1 transition-transform" />
              <span>Back to Examination Archive</span>
            </Link>
            <Link 
              to="/" 
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#FAF8EC] dark:bg-[#141413] hover:bg-[#ECD5FF]/40 dark:hover:bg-[#2E2E2A] rounded-xl border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#5C5A52] dark:text-[#A8A396] hover:text-[#141413] dark:hover:text-[#FAF8EC] font-semibold text-xs sm:text-sm transition-colors"
            >
              <span>Dashboard</span>
            </Link>
          </div>
          
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ECD5FF] border-[1.5px] border-[#141413] mb-2">
              <Award className="w-3.5 h-3.5 text-[#141413]" />
              <span className="text-[11px] font-mono font-bold text-[#141413] tracking-wider uppercase">
                {test.subjectName ? `${test.subjectName} · PERFORMANCE REPORT` : 'EXAM EVALUATION & PERFORMANCE REPORT'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-heading font-black text-[#141413] dark:text-[#FAF8EC] tracking-tight">
              Exam <span className="font-editorial-italic text-[#0D47FF] dark:text-[#ECD5FF]">Results</span>
            </h1>
            <p className="text-[#5C5A52] dark:text-[#A8A396] text-xs sm:text-sm mt-1">
              {test.isFullPhaseExam
                ? `${test.mode || test.phaseExamType} · Complete section-wise and rubric evaluation telemetry.`
                : 'Review your comprehensive performance analytics, answer keys, and evaluation rubrics.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Container with Editorial Tabs */}
      <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl overflow-hidden shadow-xs">
        {/* Navigation Bar */}
        <div className="flex overflow-x-auto no-scrollbar border-b border-[#E5E1CE] dark:border-[#2E2E2A] p-2 sm:p-2.5 gap-1.5 bg-[#FAF8EC] dark:bg-[#141413]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer z-10 min-h-[40px]',
                  isActive
                    ? 'text-[#141413]'
                    : 'text-[#5C5A52] dark:text-[#A8A396] hover:text-[#141413] dark:hover:text-[#FAF8EC] hover:bg-[#FFFFFF] dark:hover:bg-[#1C1C1A]'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="results-active-tab"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-xl bg-[#ECD5FF] border-[1.5px] border-[#141413] shadow-[2px_2px_0px_#141413] dark:shadow-[2px_2px_0px_#FAF8EC] -z-10"
                  />
                )}
                <Icon className={clsx("w-4 h-4 shrink-0", isActive ? "text-[#141413]" : "text-[#5C5A52] dark:text-[#A8A396]")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-8">
          <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div
              key="tab-summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="space-y-6"
            >
              {(() => {
                const mcqStaticQs = mcqQuestions.filter(q => q.sourceTag === 'Static');
                const mcqDynamicQs = mcqQuestions.filter(q => q.sourceTag === 'Dynamic');
                const descStaticQs = descQuestions.filter(q => q.sourceTag === 'Static');
                const descDynamicQs = descQuestions.filter(q => q.sourceTag === 'Dynamic');
                
                const subjectMeta = test.subjectSlug ? getSubjectBySlug(test.subjectSlug) : null;
                const primaryMcqLabel = (test.config as any)?.primaryMcqLabel || subjectMeta?.questionCategories?.primaryMcqLabel || 'Core Theory';
                const secondaryMcqLabel = (test.config as any)?.secondaryMcqLabel || subjectMeta?.questionCategories?.secondaryMcqLabel || 'Applied / Puzzles';
                const primaryDescLabel = (test.config as any)?.primaryDescLabel || subjectMeta?.questionCategories?.primaryDescLabel || 'Static Desc.';
                const secondaryDescLabel = (test.config as any)?.secondaryDescLabel || subjectMeta?.questionCategories?.secondaryDescLabel || 'Dynamic Desc.';

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

                const totalMaxMarks = getMax(test.questions);
                const overallPercentage = typeof test.totalScore === 'number' && totalMaxMarks > 0
                  ? Math.round((test.totalScore / totalMaxMarks) * 100)
                  : 0;

                const orderedSectionSummaries = (() => {
                  if (!test.sections || test.sections.length === 0) return [];
                  return test.sections.map(sec => {
                    const saved = test.perSubjectScores?.[sec.id];
                    if (saved) return saved;
                    const secQs = test.questions.slice(sec.startIndex, sec.endIndex + 1);
                    let score = 0;
                    let attempted = 0;
                    let correct = 0;
                    let incorrect = 0;
                    let mcqCount = 0;
                    let descCount = 0;
                    let maxMarks = 0;
                    secQs.forEach(q => {
                      maxMarks += q.maxMarks || 0;
                      const att = isQuestionAttempted(q);
                      if (att) attempted++;
                      if (q.type === 'MCQ') {
                        mcqCount++;
                        score += q.score || 0;
                        if (att) {
                          if (isQuestionCorrect(q)) correct++;
                          else incorrect++;
                        }
                      } else {
                        descCount++;
                        const qId = q.id || test.questions.indexOf(q).toString();
                        score += test.evaluations?.[qId]?.totalScore || 0;
                      }
                    });
                    return {
                      sectionId: sec.id,
                      slug: sec.slug,
                      name: sec.name,
                      shortName: sec.shortName,
                      accentColor: sec.accentColor,
                      score: Number(score.toFixed(2)),
                      maxMarks: Number(maxMarks.toFixed(2)),
                      attempted,
                      correct,
                      incorrect,
                      questionCount: secQs.length,
                      mcqCount,
                      descCount
                    };
                  });
                })();

                return (
                  <div className="space-y-6">
                  <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    {/* Card 1: Overall Score */}
                    <MotionStaggerItem>
                      <div className="h-full bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#141413] dark:border-[#FAF8EC] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-[11px] font-mono font-bold text-[#5C5A52] dark:text-[#A8A396] uppercase tracking-wider">
                              Total Score
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-[#0D47FF] text-white border border-[#141413] flex items-center justify-center shrink-0">
                              <Award className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="flex items-baseline gap-1.5 mt-1 tabular-nums">
                            <span className="text-4xl font-heading font-black text-[#141413] dark:text-[#FAF8EC]">
                              <AnimatedNumber value={test.totalScore || 0} decimals={1} />
                            </span>
                            <span className="text-lg font-mono text-[#5C5A52] dark:text-[#A8A396]">
                              / {getMax(test.questions)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#5C5A52] dark:text-[#A8A396]">Aggregate Accuracy</span>
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#FFD426] text-[#141413] border border-[#141413] tabular-nums">
                            <AnimatedNumber value={overallPercentage} suffix="%" />
                          </span>
                        </div>
                      </div>
                    </MotionStaggerItem>

                    {/* Card 2: MCQ Accuracy Breakdown */}
                    <MotionStaggerItem>
                      <div className="h-full bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[11px] font-mono font-bold text-[#5C5A52] dark:text-[#A8A396] uppercase tracking-wider">
                            MCQ Tally
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Correct
                            </span>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                              <AnimatedNumber value={correctMCQs} />
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Incorrect
                            </span>
                            <span className="font-mono font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                              <AnimatedNumber value={incorrectMCQs} />
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FFD426] border border-[#141413]" /> Skipped
                            </span>
                            <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
                              <AnimatedNumber value={unattemptedMCQs} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </MotionStaggerItem>

                    {/* Card 3: MCQ Breakdown with Dynamic Domain Labels */}
                    <MotionStaggerItem>
                      <div className="h-full bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[11px] font-mono font-bold text-[#5C5A52] dark:text-[#A8A396] uppercase tracking-wider">
                            MCQ Modules
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-[#ECD5FF] text-[#141413] border border-[#141413] flex items-center justify-center shrink-0">
                            <SlidersHorizontal className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-3.5">
                          <div>
                            <div className="flex justify-between items-center text-xs mb-1.5 gap-2">
                              <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium truncate min-w-0 flex-1" title={primaryMcqLabel}>
                                {primaryMcqLabel}
                              </span>
                              <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] shrink-0 tabular-nums">{mcqStaticScore}/{mcqStaticMax}</span>
                            </div>
                            <div className="w-full bg-[#E5E1CE] dark:bg-[#2E2E2A] h-2 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: mcqStaticMax > 0 ? Math.min(1, mcqStaticScore / mcqStaticMax) : 0 }}
                                transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
                                className="bg-[#0D47FF] dark:bg-[#ECD5FF] h-full w-full rounded-full origin-left"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-xs mb-1.5 gap-2">
                              <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium truncate min-w-0 flex-1" title={secondaryMcqLabel}>
                                {secondaryMcqLabel}
                              </span>
                              <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] shrink-0 tabular-nums">{mcqDynamicScore}/{mcqDynamicMax}</span>
                            </div>
                            <div className="w-full bg-[#E5E1CE] dark:bg-[#2E2E2A] h-2 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: mcqDynamicMax > 0 ? Math.min(1, mcqDynamicScore / mcqDynamicMax) : 0 }}
                                transition={{ duration: 0.75, delay: 0.08, ease: EASE_OUT_EXPO }}
                                className="bg-emerald-600 h-full w-full rounded-full origin-left"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </MotionStaggerItem>

                    {/* Card 4: Descriptive Modules with Dynamic Domain Labels */}
                    <MotionStaggerItem>
                      <div className="h-full bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[11px] font-mono font-bold text-[#5C5A52] dark:text-[#A8A396] uppercase tracking-wider">
                            Descriptive Rubric
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-[#FFD426] text-[#141413] border border-[#141413] flex items-center justify-center shrink-0">
                            <FileEdit className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-3.5">
                          <div>
                            <div className="flex justify-between items-center text-xs mb-1.5 gap-2">
                              <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium truncate min-w-0 flex-1" title={primaryDescLabel}>
                                {primaryDescLabel}
                              </span>
                              <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] shrink-0 tabular-nums">{descStaticScore}/{descStaticMax}</span>
                            </div>
                            <div className="w-full bg-[#E5E1CE] dark:bg-[#2E2E2A] h-2 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: descStaticMax > 0 ? Math.min(1, descStaticScore / descStaticMax) : 0 }}
                                transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
                                className="bg-[#0D47FF] dark:bg-[#ECD5FF] h-full w-full rounded-full origin-left"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-xs mb-1.5 gap-2">
                              <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium truncate min-w-0 flex-1" title={secondaryDescLabel}>
                                {secondaryDescLabel}
                              </span>
                              <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] shrink-0 tabular-nums">{descDynamicScore}/{descDynamicMax}</span>
                            </div>
                            <div className="w-full bg-[#E5E1CE] dark:bg-[#2E2E2A] h-2 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: descDynamicMax > 0 ? Math.min(1, descDynamicScore / descDynamicMax) : 0 }}
                                transition={{ duration: 0.75, delay: 0.08, ease: EASE_OUT_EXPO }}
                                className="bg-[#FFD426] h-full w-full rounded-full origin-left"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </MotionStaggerItem>
                  </MotionStaggerGrid>

                  {/* Section / Paper-Wise Scorecard for Full-Length Phase 1 & Phase 2 */}
                  {orderedSectionSummaries.length > 0 && (
                    <div className="bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-5 sm:p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm sm:text-base font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
                            Section / Paper-Wise Scorecard
                          </h3>
                          <p className="text-xs text-[#5C5A52] dark:text-[#A8A396]">
                            Disaggregated accuracy and marks scored across every paper vertical
                          </p>
                        </div>
                        <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-1 rounded-full bg-[#ECD5FF] text-[#141413] border border-[#141413]">
                          {orderedSectionSummaries.length} {orderedSectionSummaries.length === 3 ? 'Papers' : 'Sections'}
                        </span>
                      </div>

                      <div className={clsx(
                        'grid gap-4',
                        orderedSectionSummaries.length === 3
                          ? 'grid-cols-1 md:grid-cols-3'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                      )}>
                        {orderedSectionSummaries.map(sec => {
                          const secPct = sec.maxMarks > 0 ? Math.max(0, Math.round((sec.score / sec.maxMarks) * 100)) : 0;
                          const unattempted = Math.max(0, sec.questionCount - sec.attempted);
                          return (
                            <div
                              key={sec.sectionId}
                              className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-4 flex flex-col justify-between space-y-3"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: sec.accentColor }}
                                    />
                                    <span className="text-xs font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] truncate" title={sec.name}>
                                      {sec.shortName || sec.name}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] tabular-nums shrink-0">
                                    {secPct}%
                                  </span>
                                </div>

                                <div className="flex items-baseline gap-1 tabular-nums">
                                  <span className="text-2xl font-heading font-black text-[#141413] dark:text-[#FAF8EC]">
                                    {sec.score}
                                  </span>
                                  <span className="text-xs font-mono text-[#5C5A52] dark:text-[#A8A396]">
                                    / {sec.maxMarks} Marks
                                  </span>
                                </div>

                                <div className="w-full bg-[#E5E1CE] dark:bg-[#2E2E2A] h-2 rounded-full overflow-hidden mt-2.5">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, sec.maxMarks > 0 ? (sec.score / sec.maxMarks) * 100 : 0))}%`,
                                      backgroundColor: sec.accentColor
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="pt-2 border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#5C5A52] dark:text-[#A8A396] tabular-nums">
                                {sec.mcqCount > 0 ? (
                                  <>
                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓ {sec.correct}</span>
                                    <span className="text-rose-700 dark:text-rose-400 font-bold">✗ {sec.incorrect}</span>
                                    <span>○ {unattempted}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Attempted: {sec.attempted}/{sec.questionCount}</span>
                                    <span>Desc</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* MCQ Tab Review */}
          {activeTab === 'mcq' && (() => {
            const mcqSections = (test.sections || []).filter(sec =>
              mcqQuestions.some(q => q.sectionId === sec.id)
            );
            const filteredMcqs = mcqSectionFilter === 'all'
              ? mcqQuestions
              : mcqQuestions.filter(q => q.sectionId === mcqSectionFilter);
            const PAGE_SIZE = 40;
            const totalPages = Math.max(1, Math.ceil(filteredMcqs.length / PAGE_SIZE));
            const safePage = Math.min(mcqPage, totalPages);
            const pagedMcqs = filteredMcqs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

            return (
            <motion.div
              key="tab-mcq"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="space-y-5"
            >
              {mcqSections.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => { setMcqSectionFilter('all'); setMcqPage(1); }}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                      mcqSectionFilter === 'all'
                        ? 'bg-[#141413] text-[#FAF8EC] dark:bg-[#ECD5FF] dark:text-[#141413] border-[#141413]'
                        : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#5C5A52] dark:text-[#A8A396] border-[#E5E1CE] dark:border-[#2E2E2A]'
                    )}
                  >
                    All Sections ({mcqQuestions.length})
                  </button>
                  {mcqSections.map(sec => {
                    const count = mcqQuestions.filter(q => q.sectionId === sec.id).length;
                    const active = mcqSectionFilter === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => { setMcqSectionFilter(sec.id); setMcqPage(1); }}
                        className={clsx(
                          'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5',
                          active
                            ? 'bg-[#ECD5FF] text-[#141413] border-[#141413] shadow-[2px_2px_0px_#141413]'
                            : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#5C5A52] dark:text-[#A8A396] border-[#E5E1CE] dark:border-[#2E2E2A]'
                        )}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sec.accentColor }} />
                        <span>{sec.shortName} ({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredMcqs.length === 0 ? (
                <div className="text-center py-12 bg-[#FAF8EC] dark:bg-[#141413] rounded-2xl border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <p className="text-sm font-medium text-[#5C5A52] dark:text-[#A8A396]">No Multiple Choice Questions in this assessment.</p>
                </div>
              ) : pagedMcqs.map((q, localIdx) => {
                const displayIndex = (safePage - 1) * PAGE_SIZE + localIdx;
                const userAns = getQuestionUserAnswer(q);
                const isAttempted = !!(userAns && userAns.trim() !== '');
                const isCorrect = isAttempted && checkMCQCorrect(userAns, q.correctAnswer, q.options);
                const isUnattempted = !isAttempted;
                const wrongPenalty = test.negativeMarks === 0 ? 0 : Number((0.25 * (q.maxMarks || 1)).toFixed(2));
                const scoreDisplay = isCorrect
                  ? `+${q.maxMarks || 1} Marks`
                  : isUnattempted
                    ? '0 Marks'
                    : (wrongPenalty > 0 ? `-${wrongPenalty} Marks` : '0 Marks');
                
                return (
                  <div key={q.id || displayIndex} className="border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl overflow-hidden bg-[#FAF8EC] dark:bg-[#141413] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {q.sectionName && (
                          <span className="px-2.5 py-0.5 bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#141413] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] text-[11px] font-mono font-bold rounded-full">
                            {q.sectionName}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[11px] font-mono font-bold rounded-full">
                          {q.sourceTag}
                        </span>
                        {q.isPyq && (
                          <span className="px-2.5 py-0.5 bg-[#FFD426] border border-[#141413] text-[#141413] text-[11px] font-bold rounded-full flex items-center gap-1">
                            <Award className="w-3 h-3 shrink-0" />
                            <span>{q.pyqYear || 'RBI Grade B PYQ'}</span>
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-[#5C5A52] dark:text-[#A8A396]">
                          QUESTION {displayIndex + 1} OF {filteredMcqs.length}
                        </span>
                      </div>
                      <span className={clsx(
                        "px-3 py-1 text-xs font-bold rounded-full border tabular-nums",
                        isCorrect
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-500/40"
                          : isUnattempted
                            ? "bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#5C5A52] dark:text-[#A8A396] border-[#E5E1CE] dark:border-[#2E2E2A]"
                            : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-500/40"
                      )}>
                        {isCorrect ? '✓ Correct' : isUnattempted ? '○ Unattempted' : '✗ Incorrect'} ({scoreDisplay})
                      </span>
                    </div>
                    
                    <p className="text-[#141413] dark:text-[#FAF8EC] font-medium mb-5 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                      {q.text}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                      {/* Your Answer */}
                      <div className={clsx(
                        'p-4 rounded-xl border-[1.5px]',
                        isCorrect 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-950 dark:text-emerald-200' 
                          : isUnattempted 
                            ? 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A]'
                            : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500/40 text-rose-950 dark:text-rose-200'
                      )}>
                        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#5C5A52] dark:text-[#A8A396] mb-1">Your Answer</p>
                        <p className="font-semibold text-sm">
                          {userAns || <span className="italic text-[#5C5A52] dark:text-[#A8A396]">Not attempted</span>}
                        </p>
                      </div>

                      {/* Correct Answer */}
                      <div className="p-4 rounded-xl border-[1.5px] bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-950 dark:text-emerald-200">
                        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Correct Answer</p>
                        <p className="font-semibold text-sm">
                          {q.correctAnswer}
                        </p>
                      </div>
                    </div>

                    {q.options && q.options.length > 0 && (
                      <div className="mb-4 pt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                        <p className="text-[11px] font-mono font-bold text-[#5C5A52] dark:text-[#A8A396] uppercase tracking-wider mb-2.5">Options Review</p>
                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => {
                            const optLetter = ['A', 'B', 'C', 'D', 'E'][optIdx] || String.fromCharCode(65 + optIdx);
                            const isUserPick = userAns ? (userAns === opt || userAns.toLowerCase() === opt.toLowerCase()) : false;
                            const isCorrectPick = q.correctAnswer ? checkMCQCorrect(opt, q.correctAnswer, q.options) : false;
                            return (
                              <div 
                                key={optIdx}
                                className={clsx(
                                  "flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2.5 sm:gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border-[1.5px] transition-colors",
                                  isCorrectPick
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 font-semibold"
                                    : isUserPick && !isCorrectPick
                                      ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500/40 text-rose-950 dark:text-rose-200 font-semibold"
                                      : "bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#5C5A52] dark:text-[#A8A396]"
                                )}
                              >
                                <span className={clsx(
                                  "w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center font-mono shrink-0",
                                  isCorrectPick
                                    ? "bg-emerald-600 text-white"
                                    : isUserPick && !isCorrectPick
                                      ? "bg-rose-600 text-white"
                                      : "bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC]"
                                )}>
                                  {optLetter}
                                </span>
                                <span className="flex-1 min-w-0 break-words">{opt}</span>
                                {isCorrectPick && (
                                  <span className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-bold shrink-0 whitespace-nowrap ml-8 sm:ml-2">✓ Correct Answer</span>
                                )}
                                {isUserPick && !isCorrectPick && (
                                  <span className="text-[11px] sm:text-xs text-rose-700 dark:text-rose-400 font-bold shrink-0 whitespace-nowrap ml-8 sm:ml-2">✗ Your Choice</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(q as any).explanation && (
                      <div className="border-t border-[#E5E1CE] dark:border-[#2E2E2A] pt-4 mt-4">
                        <p className="text-[11px] font-mono font-bold text-[#0D47FF] dark:text-[#ECD5FF] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" /> Explanation & Rationale
                        </p>
                        <p className="text-xs sm:text-sm text-[#5C5A52] dark:text-[#A8A396] leading-relaxed">
                          {(q as any).explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs font-mono text-[#5C5A52] dark:text-[#A8A396] tabular-nums">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredMcqs.length)} of {filteredMcqs.length} MCQs
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setMcqPage(p => Math.max(1, p - 1))}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] disabled:opacity-40 cursor-pointer"
                    >
                      Prev Page
                    </button>
                    <span className="text-xs font-mono font-bold px-2 tabular-nums">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setMcqPage(p => Math.min(totalPages, p + 1))}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] disabled:opacity-40 cursor-pointer"
                    >
                      Next Page
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
            );
          })()}

          {/* Descriptive Tab Evaluation */}
          {activeTab === 'descriptive' && (() => {
            const descSections = (test.sections || []).filter(sec =>
              descQuestions.some(q => q.sectionId === sec.id)
            );
            const filteredDescs = descSectionFilter === 'all'
              ? descQuestions
              : descQuestions.filter(q => q.sectionId === descSectionFilter);

            return (
            <motion.div
              key="tab-descriptive"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="space-y-6"
            >
              {descSections.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDescSectionFilter('all')}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                      descSectionFilter === 'all'
                        ? 'bg-[#141413] text-[#FAF8EC] dark:bg-[#ECD5FF] dark:text-[#141413] border-[#141413]'
                        : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#5C5A52] dark:text-[#A8A396] border-[#E5E1CE] dark:border-[#2E2E2A]'
                    )}
                  >
                    All Papers ({descQuestions.length})
                  </button>
                  {descSections.map(sec => {
                    const count = descQuestions.filter(q => q.sectionId === sec.id).length;
                    const active = descSectionFilter === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setDescSectionFilter(sec.id)}
                        className={clsx(
                          'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5',
                          active
                            ? 'bg-[#ECD5FF] text-[#141413] border-[#141413] shadow-[2px_2px_0px_#141413]'
                            : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#5C5A52] dark:text-[#A8A396] border-[#E5E1CE] dark:border-[#2E2E2A]'
                        )}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sec.accentColor }} />
                        <span>{sec.shortName} ({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {descQuestions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#141413] dark:text-[#FAF8EC]">
                      Phase II Descriptive Rubrics ({descQuestions.length} Questions)
                    </p>
                    <p className="text-xs text-[#5C5A52] dark:text-[#A8A396]">
                      Evaluated against official RBI Grade B analytical & structural depth criteria.
                    </p>
                  </div>
                  <button
                    onClick={handleReEvaluateAllDescriptive}
                    disabled={reEvaluatingAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border-[1.5px] border-[#141413] shadow-[2px_2px_0px_#141413] text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{reEvaluatingAll ? 'Re-Evaluating All...' : 'Re-Grade All Descriptive'}</span>
                  </button>
                </div>
              )}

              {filteredDescs.length === 0 ? (
                <div className="text-center py-12 bg-[#FAF8EC] dark:bg-[#141413] rounded-2xl border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <p className="text-sm font-medium text-[#5C5A52] dark:text-[#A8A396]">No Descriptive Questions in this assessment.</p>
                </div>
              ) : filteredDescs.map((q, i) => {
                const qId = q.id || (test.questions.indexOf(q)).toString();
                const evalData = test.evaluations?.[qId];
                const userAns = q.userAnswer || test.answers?.[qId] || test.answers?.[test.questions.indexOf(q).toString()];
                const hasUserAns = !!(userAns && userAns.trim() !== '');
                const isCurrentlyReevaluating = reEvaluatingQId === qId;
                
                return (
                  <div key={qId || i} className="border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl overflow-hidden bg-[#FAF8EC] dark:bg-[#141413] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {q.sectionName && (
                          <span className="px-2.5 py-0.5 bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#141413] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] text-[11px] font-mono font-bold rounded-full">
                            {q.sectionName}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[11px] font-mono font-bold rounded-full">
                          {q.sourceTag} DESCRIPTIVE
                        </span>
                        {q.isPyq && (
                          <span className="px-2.5 py-0.5 bg-[#FFD426] border border-[#141413] text-[#141413] text-[11px] font-bold rounded-full flex items-center gap-1">
                            <Award className="w-3 h-3 shrink-0" />
                            <span>{q.pyqYear || 'RBI Grade B PYQ'}</span>
                          </span>
                        )}
                        {q.wordLimit && (
                          <span className="px-2.5 py-0.5 bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#5C5A52] dark:text-[#A8A396] text-[11px] font-mono font-bold rounded-full">
                            Word Limit: {q.wordLimit}
                          </span>
                        )}
                      </div>

                      {hasUserAns && (
                        <button
                          onClick={() => handleReEvaluateQuestion(qId)}
                          disabled={isCurrentlyReevaluating || reEvaluatingAll}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] hover:bg-[#ECD5FF] text-[#141413] dark:text-[#FAF8EC] hover:text-[#141413] border-[1.5px] border-[#141413] dark:border-[#2E2E2A] text-xs font-bold font-mono transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isCurrentlyReevaluating ? (
                            <>
                              <FuturisticSpinner size="xs" color="cobalt" />
                              <span>Re-Grading...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-[#0D47FF] dark:text-[#ECD5FF]" />
                              <span>Re-Grade Answer</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    
                    <p className="text-[#141413] dark:text-[#FAF8EC] font-medium mb-6 text-sm sm:text-base leading-relaxed">
                      {q.text}
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
                      {/* Your Answer Column */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#5C5A52] dark:text-[#A8A396]">
                            YOUR SUBMITTED ANSWER
                          </h4>
                          {userAns && (
                            <span className="text-[11px] font-mono font-bold text-[#5C5A52] dark:text-[#A8A396] tabular-nums">
                              {userAns.trim().split(/\s+/).filter(Boolean).length} words
                            </span>
                          )}
                        </div>
                        <div className="p-3.5 sm:p-4 bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-xl text-[#141413] dark:text-[#FAF8EC] whitespace-pre-wrap text-sm h-56 sm:h-96 overflow-y-auto leading-relaxed">
                          {userAns || <span className="italic text-[#5C5A52] dark:text-[#A8A396]">No answer provided.</span>}
                        </div>
                      </div>
                      
                      {/* Evaluation Column */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
                          <div>
                            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#5C5A52] dark:text-[#A8A396]">
                              RBI GRADE B EVALUATOR REPORT
                            </h4>
                            <span className="text-[11px] text-[#5C5A52] dark:text-[#A8A396]">
                              Official Phase II Examination Standard
                            </span>
                          </div>
                          <span className="font-mono font-black text-xl text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums">
                            {evalData?.totalScore || 0} <span className="text-sm text-[#5C5A52] dark:text-[#A8A396] font-normal">/ {q.maxMarks} Marks</span>
                          </span>
                        </div>
                        
                        {evalData && (
                          <div className="space-y-5">
                            {/* Dimensional Rubric Breakdown */}
                            <div>
                              <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-[#5C5A52] dark:text-[#A8A396] mb-3">
                                DIMENSIONAL RUBRIC BREAKDOWN
                              </h5>
                              <div className="space-y-3">
                                {Object.entries(evalData.scoreBreakdown || {}).map(([criterion, score], idx) => {
                                  const maxForCrit = q.markingScheme?.[criterion] || Number((q.maxMarks / Math.max(1, Object.keys(evalData.scoreBreakdown || {}).length)).toFixed(1));
                                  const numScore = typeof score === 'number' ? score : Number(score) || 0;
                                  const pct = maxForCrit > 0 ? Math.min(100, Math.round((numScore / maxForCrit) * 100)) : 0;
                                  return (
                                    <div key={idx}>
                                      <div className="flex justify-between items-center text-xs mb-1">
                                        <span className="text-[#5C5A52] dark:text-[#A8A396] font-medium">{criterion}</span>
                                        <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">{numScore} / {maxForCrit}</span>
                                      </div>
                                      <FuturisticProgressBar 
                                        progress={pct}
                                        color="cobalt"
                                        height={6}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Actionable Writing Feedback */}
                            <div className="pt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                              <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141413] dark:text-[#FFD426] mb-3 flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-[#0D47FF] dark:text-[#FFD426]" /> ACTIONABLE WRITING FEEDBACK
                              </h5>
                              <ul className="space-y-2.5">
                                {evalData.feedbackPoints?.map((pt: string, idx: number) => (
                                  <li key={idx} className="flex gap-2 text-xs sm:text-sm text-[#5C5A52] dark:text-[#A8A396] leading-relaxed">
                                    <span className="text-[#0D47FF] dark:text-[#FFD426] shrink-0 font-bold">•</span>
                                    <span>{pt}</span>
                                  </li>
                                ))}
                                {evalData.suggestions?.map((sug: string, idx: number) => (
                                  <li key={`sug-${idx}`} className="flex gap-2 text-xs sm:text-sm text-[#5C5A52] dark:text-[#A8A396] leading-relaxed">
                                    <span className="text-[#0D47FF] dark:text-[#ECD5FF] shrink-0 font-bold">→</span>
                                    <span>{sug}</span>
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
                      <div className="mt-6 pt-6 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Ideal / Benchmark Model Answer
                        </h4>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border-[1.5px] border-emerald-500/40 rounded-xl text-[#141413] dark:text-emerald-100 whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">
                          {q.modelAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
            );
          })()}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && test.overallFeedback && (
            <motion.div
              key="tab-feedback"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="space-y-6"
            >
              <div className="bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-6 sm:p-8">
                
                <div className="grid md:grid-cols-2 gap-8 sm:gap-10">
                  <div className="space-y-4">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Key Conceptual Strengths
                    </h4>
                    <ul className="space-y-3">
                      {test.overallFeedback.strengths.map((pt, idx) => (
                        <li key={idx} className="flex gap-3 text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">•</span>
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <MinusCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" /> High-Priority Knowledge Gaps
                    </h4>
                    <ul className="space-y-3">
                      {test.overallFeedback.weaknesses.map((pt, idx) => (
                        <li key={idx} className="flex gap-3 text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC]">
                          <span className="text-rose-600 dark:text-rose-400 font-bold mt-0.5">•</span>
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141413] dark:text-[#FAF8EC] mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" /> Actionable Recommended Steps
                  </h4>
                  <div className="grid gap-3">
                    {test.overallFeedback.nextSteps.map((pt, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 bg-[#FFFFFF] dark:bg-[#1C1C1A] rounded-xl border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] transition-colors">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-[#ECD5FF] border-[1.5px] border-[#141413] text-[#141413] flex items-center justify-center font-mono font-bold text-xs tabular-nums">
                          {idx + 1}
                        </div>
                        <p className="text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC] mt-1 leading-relaxed">
                          {pt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </MotionPage>
  );
}
