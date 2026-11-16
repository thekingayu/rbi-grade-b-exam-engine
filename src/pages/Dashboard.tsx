import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { TestAttempt } from '../types';
import { useSubject } from '../context/SubjectContext';
import { SubjectCard } from '../components/dashboard/SubjectCard';
import { CrossSubjectCharts } from '../components/dashboard/CrossSubjectCharts';
import { InsightsPanel } from '../components/dashboard/InsightsPanel';
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { ExamCountdownGoal } from '../components/dashboard/ExamCountdownGoal';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import { RailwayTimeline, DiagonalMarquee, PrizeBadgeIcon } from '../components/SignatureGraphics';
import { 
  Plus, CheckCircle2, TrendingUp, Trophy, ArrowRight,
  Clock, Flame, BookOpen, Compass, RotateCcw, Trash2, AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, differenceInCalendarDays } from 'date-fns';
import { calculateDaysRemaining } from '../utils/date';
import { isSyncDocument, handleFirestoreError, OperationType } from '../utils/firestore';
import { getFullPhaseDisplayMeta } from '../data/fullPhaseBlueprints';
import { createFreshReattemptTest, clearPreloadedTest, waitForPendingTestWrite } from '../utils/reattempt';
import { FuturisticScreenLoader, FuturisticSpinner } from '../components/FuturisticLoader';
import {
  MotionPage,
  MotionSection,
  MotionStaggerGrid,
  MotionStaggerItem,
  MotionModal,
  AnimatedNumber,
  SPRING_BOUNCY,
  SPRING_SNAPPY
} from '../components/MotionPrimitives';

export function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const { subjects, setActiveSubject, targetExamDate, userProfile } = useSubject();
  const [tests, setTests] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [reattemptingId, setReattemptingId] = useState<string | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<TestAttempt | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);

  const displayName = userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Officer';
  const photoURL = userProfile?.photoURL || user.photoURL;
  const stream = userProfile?.stream || 'General';
  const targetYear = userProfile?.targetExamYear || '2026-27';

  const daysRemaining = calculateDaysRemaining(targetExamDate);

  useEffect(() => {
    setActiveSubject(null);
  }, [setActiveSubject]);

  useEffect(() => {
    const q = query(
      collection(db, 'tests'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs
        .filter(d => !isSyncDocument(d.id, d.data()))
        .map(d => ({
          id: d.id,
          ...d.data()
        })) as TestAttempt[];
      
      fetched.sort((a, b) => b.createdAt - a.createdAt);
      setTests(fetched);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to tests:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const openTerminateModal = (targetTest: TestAttempt) => {
    setTerminateError(null);
    setTerminateTarget(targetTest);
  };

  const confirmTerminate = async () => {
    if (!terminateTarget || terminating) return;
    const targetId = terminateTarget.id;
    setTerminating(true);
    setTerminateError(null);
    try {
      try {
        localStorage.removeItem(`rbi_cbt_state_${targetId}`);
      } catch {
        // Ignore storage errors
      }
      clearPreloadedTest(targetId);

      const writeStatus = await waitForPendingTestWrite(targetId);
      if (writeStatus.ok) {
        await deleteDoc(doc(db, 'tests', targetId));
      }
      setTests(prev => prev.filter(t => t.id !== targetId));
      setTerminateTarget(null);
    } catch (e: any) {
      console.error('Failed to terminate test:', e);
      try {
        handleFirestoreError(e, OperationType.DELETE, `tests/${targetId}`, user);
      } catch {
        // Logged structured Firestore error details
      }
      setTerminateError(e?.message || 'Unable to terminate this attempt. Please try again.');
    } finally {
      setTerminating(false);
    }
  };

  const handleReattempt = async (sourceTest: TestAttempt) => {
    if (reattemptingId) return;
    try {
      setReattemptingId(sourceTest.id);
      const newTestId = await createFreshReattemptTest(sourceTest, user);
      navigate(`/exam/${newTestId}`);
    } catch (e) {
      console.error('Failed to start reattempt:', e);
      setReattemptingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <FuturisticScreenLoader 
          title="Cadre Command Center" 
          subtitle="CALIBRATING PREPARATION BENCHMARKS..." 
          color="cobalt"
        />
      </div>
    );
  }

  const completed = tests.filter(t => t.status === 'completed');

  // 1. KPI: Total tests taken
  const testsTaken = completed.length;

  // 2. KPI: Overall average %
  const scorePercentages = completed.map(t => {
    const max = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
    return Math.round(((t.totalScore || 0) / max) * 100);
  });
  const avgScore = testsTaken > 0 ? Math.round(scorePercentages.reduce((a, b) => a + b, 0) / testsTaken) : 0;

  // 3. KPI: Best score %
  const bestScore = testsTaken > 0 ? Math.max(...scorePercentages) : 0;

  // 4. KPI: Momentum
  let momentumLabel = "—";
  let momentumIsPositive = true;
  if (scorePercentages.length >= 4) {
    const last3 = scorePercentages.slice(0, 3);
    const prior = scorePercentages.slice(3);
    const avgLast3 = last3.reduce((a, b) => a + b, 0) / last3.length;
    const avgPrior = prior.reduce((a, b) => a + b, 0) / prior.length;
    const delta = Math.round(avgLast3 - avgPrior);
    momentumLabel = delta >= 0 ? `+${delta}%` : `${delta}%`;
    momentumIsPositive = delta >= 0;
  } else if (scorePercentages.length >= 2) {
    const delta = scorePercentages[0] - scorePercentages[1];
    momentumLabel = delta >= 0 ? `+${delta}%` : `${delta}%`;
    momentumIsPositive = delta >= 0;
  }

  // 5. KPI: Current study streak (days)
  const uniqueDates: string[] = Array.from(new Set<string>(
    completed.map(t => format(new Date(t.submittedAt || t.createdAt), 'yyyy-MM-dd'))
  )).sort().reverse();

  let streak = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    const firstDate = new Date(uniqueDates[0]);
    const diffFromToday = differenceInCalendarDays(today, firstDate);
    if (diffFromToday <= 1) {
      streak = 1;
      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const d1 = new Date(uniqueDates[i]);
        const d2 = new Date(uniqueDates[i + 1]);
        if (differenceInCalendarDays(d1, d2) === 1) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  // 6. KPI: Total hours practiced
  const totalSeconds = completed.reduce((sum, t) => sum + (t.durationUsedSeconds || t.durationSeconds || 1800), 0);
  const totalHoursNum = Number((totalSeconds / 3600).toFixed(1));

  const phase1Subjects = subjects.filter(s => s.phase === 'Phase 1' && s.slug !== 'uncategorized');
  const phase2Subjects = subjects.filter(s => s.phase === 'Phase 2');

  // Dynamic rail progress between Phase 1 -> Phase 2 -> Interview (12% baseline + exam activity)
  const railProgress = Math.min(94, Math.max(14, 14 + testsTaken * 6));

  return (
    <MotionPage className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pt-1 sm:pt-2 pb-12 sm:pb-16 relative z-10">
      
      {/* 1. Editorial Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
        <div className="min-w-0">
          <p className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399] mb-1.5 sm:mb-2">
            RESERVE BANK OF INDIA · OFFICER CADRE {targetYear} · {daysRemaining} DAYS TO EXAM
          </p>
          <h1 className="text-2xl sm:text-5xl font-heading font-black text-[#141413] dark:text-[#FAF8EC] tracking-tight leading-[1.08]">
            Welcome back, <span className="font-editorial-italic text-[#0D47FF] dark:text-[#ECD5FF] font-normal">{displayName.split(' ')[0]}.</span>
          </h1>
          <p className="text-[#55554F] dark:text-[#A3A399] text-xs sm:text-base font-normal mt-1.5 sm:mt-2 max-w-2xl">
            Centralized preparation telemetry across all Phase 1 and Phase 2 curriculum verticals.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
          {/* Officer Profile Dossier Link */}
          <motion.div whileHover={{ y: -3, scale: 1.015 }} whileTap={{ scale: 0.965 }} transition={SPRING_BOUNCY}>
            <Link 
              to="/profile"
              className="group flex items-center justify-between sm:justify-start gap-3 px-3 py-2 min-h-[46px] rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] transition-all cursor-pointer w-full sm:w-auto"
              title="Open Officer Dossier & Lanyard Pass"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl overflow-hidden border-[1.5px] border-[#141413] flex items-center justify-center bg-[#ECD5FF] text-[#141413] shrink-0">
                  {photoURL && (photoURL.startsWith('http') || photoURL.startsWith('data:')) ? (
                    <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-xs">
                      {photoURL || displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="text-left min-w-0">
                  <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] truncate block">
                    {displayName}
                  </span>
                  <span className="text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] flex items-center gap-1">
                    {stream} Stream <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#66665E] sm:hidden shrink-0" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <motion.div whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.95 }} transition={SPRING_BOUNCY} className="min-w-0">
              <Link 
                to="/syllabus" 
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-[#FFFFFF] dark:bg-[#1C1C1A] hover:bg-[#F3F0E0] dark:hover:bg-[#242421] text-[#141413] dark:text-[#FAF8EC] border-[1.5px] border-[#141413] dark:border-[#2E2E2A] px-3 sm:px-5 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[46px] rounded-2xl font-bold transition-all w-full sm:w-auto text-xs sm:text-sm cursor-pointer shrink-0 whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
                <span>Syllabus & PDF</span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -3, scale: 1.025 }} whileTap={{ scale: 0.94 }} transition={SPRING_BOUNCY} className="min-w-0">
              <Link 
                to="/new" 
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2.5 bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] px-3 sm:px-6 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[46px] rounded-2xl font-bold transition-all w-full sm:w-auto text-xs sm:text-base cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-white shrink-0" />
                <span>Start New Exam</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Soft Lavender Feature Strip */}
      <motion.div whileHover={{ y: -3, scale: 1.006 }} whileTap={{ scale: 0.985 }} transition={SPRING_BOUNCY}>
        <Link
          to="/syllabus"
          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-[#ECD5FF] border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] hover:shadow-[5px_5px_0px_#141413] text-[#141413] transition-shadow"
        >
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-[#141413] shrink-0 transition-transform duration-300 group-hover:rotate-45" />
            <div>
              <span className="font-heading font-extrabold text-sm sm:text-base">
                Dual-Track Official Blueprint Active
              </span>
              <span className="hidden md:inline text-xs font-medium text-[#141413]/75 ml-2.5">
                Static PYQ rigor paired with live RBI policy & circular synthesis for GA, ESI & FM
              </span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shrink-0">
            Inspect 2026 Syllabus <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </motion.div>

      {/* 2. Target Exam Countdown & Cutoff Score Tracker */}
      <MotionSection>
        <ExamCountdownGoal currentAvgScore={avgScore} />
      </MotionSection>

      {/* 3. Signature Railway Preparation Timeline */}
      <MotionSection>
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl px-4 sm:px-6 pt-4 pb-3">
          <RailwayTimeline
            milestones={[
              { label: 'Phase 1 Prelims', caption: '200 Marks' },
              { label: 'Phase 2 Mains', caption: '300 Marks' },
              { label: 'Board Interview', caption: '75 Marks' }
            ]}
            progressPct={railProgress}
          />
        </div>
      </MotionSection>

      {/* 4. KPI Row */}
      <MotionStaggerGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        <MotionStaggerItem className="ink-card-featured group rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[104px] sm:min-h-[120px] col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#0D47FF] dark:text-[#ECD5FF] font-bold">
              PERSONAL BEST
            </span>
            <Trophy className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
          </div>
          <div className="flex items-end justify-between gap-2 mt-2">
            <div>
              <p className="text-2xl sm:text-3xl font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC] leading-none">
                {testsTaken > 0 ? <AnimatedNumber value={bestScore} suffix="%" /> : '—'}
              </p>
              <p className="text-[10px] font-medium text-[#66665E] dark:text-[#A3A399] mt-1">
                Top benchmark
              </p>
            </div>
            <PrizeBadgeIcon type="trophy" />
          </div>
        </MotionStaggerItem>

        <MotionStaggerItem>
          <KpiMiniCard
            icon={<CheckCircle2 className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />}
            title="Total Tests"
            valueNode={<AnimatedNumber value={testsTaken} />}
            subtext="Attempts logged"
          />
        </MotionStaggerItem>
        <MotionStaggerItem>
          <KpiMiniCard
            icon={<TrendingUp className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />}
            title="Overall Average"
            valueNode={testsTaken > 0 ? <AnimatedNumber value={avgScore} suffix="%" /> : '—'}
            subtext="Aggregate accuracy"
          />
        </MotionStaggerItem>
        <MotionStaggerItem>
          <KpiMiniCard
            icon={<TrendingUp className={`w-4 h-4 ${momentumIsPositive ? 'text-emerald-600' : 'text-rose-500'}`} />}
            title="3-Test Momentum"
            valueNode={momentumLabel}
            subtext="vs prior baseline"
          />
        </MotionStaggerItem>
        <MotionStaggerItem>
          <KpiMiniCard
            icon={<Flame className="w-4 h-4 text-amber-500" />}
            title="Study Streak"
            valueNode={<AnimatedNumber value={streak} suffix="d" />}
            subtext="Consecutive days"
          />
        </MotionStaggerItem>
        <MotionStaggerItem>
          <KpiMiniCard
            icon={<Clock className="w-4 h-4 text-[#141413] dark:text-[#FAF8EC]" />}
            title="Hours Practiced"
            valueNode={<AnimatedNumber value={totalHoursNum} decimals={1} suffix="h" />}
            subtext="Time in exam room"
          />
        </MotionStaggerItem>
      </MotionStaggerGrid>

      {/* 5. SUBJECT GRID (THE CENTERPIECE) */}
      <div className="space-y-8">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-heading font-black text-[#141413] dark:text-[#FAF8EC]">
                Phase 1 Subjects · Preliminary Examination
              </h2>
              <span className="text-xs font-mono text-[#66665E] dark:text-[#A3A399] uppercase">
                4 Verticals · 200 Marks · 120 Min
              </span>
            </div>
            <Link
              to="/new?fullMock=phase1"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] dark:shadow-[3px_3px_0px_#ECD5FF] transition-all whitespace-nowrap shrink-0"
            >
              <span>Full Phase 1 Mock (200 Qs)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {phase1Subjects.map(sub => (
              <MotionStaggerItem key={sub.id} className="h-full">
                <SubjectCard subject={sub} tests={tests} />
              </MotionStaggerItem>
            ))}
          </MotionStaggerGrid>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-heading font-black text-[#141413] dark:text-[#FAF8EC]">
                Phase 2 Subjects · Main Selection & Writing
              </h2>
              <span className="text-xs font-mono text-[#66665E] dark:text-[#A3A399] uppercase">
                3 Papers · 300 Total Marks · 330 Min
              </span>
            </div>
            <Link
              to="/new?fullMock=phase2"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] transition-all whitespace-nowrap shrink-0"
            >
              <span>Full Phase 2 Mock (300 Marks)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {phase2Subjects.map(sub => (
              <MotionStaggerItem key={sub.id} className="h-full">
                <SubjectCard subject={sub} tests={tests} />
              </MotionStaggerItem>
            ))}
          </MotionStaggerGrid>
        </div>
      </div>

      {/* Diagonal Editorial Ribbon Divider */}
      <DiagonalMarquee />

      {/* 6. Rule-Based Smart Insights */}
      <MotionSection>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-lg text-[#141413] dark:text-[#FAF8EC]">
            Cadre Diagnostic Insights
          </h3>
          <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] uppercase tracking-widest">
            PATTERN AUDIT
          </span>
        </div>
        <InsightsPanel subjects={subjects} tests={tests} />
      </MotionSection>

      {/* 7. Cross-Subject Visual Analytics */}
      <CrossSubjectCharts subjects={subjects} tests={tests} />

      {/* 8. Activity Heatmap */}
      <ActivityHeatmap tests={tests} streakDays={streak} />

      {/* 9. Recent Attempts */}
      <MotionSection>
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 border-b border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ECD5FF] text-[#141413] border-[1.5px] border-[#141413] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-heading font-bold text-[#141413] dark:text-[#FAF8EC] leading-tight">
                  Recent Exam Attempts
                </h3>
                <span className="text-xs text-[#66665E] dark:text-[#A3A399]">
                  Chronological attempts across all Phase 1 & Phase 2 subjects
                </span>
              </div>
            </div>
            <Link 
              to="/history" 
              className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-[#141413] dark:text-[#FAF8EC] bg-[#FFFFFF] dark:bg-[#1C1C1A] hover:bg-[#F3F0E0] dark:hover:bg-[#242421] px-4 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] w-full sm:w-auto transition-colors"
            >
              View All Archive <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="divide-y divide-[#E5E1CE] dark:divide-[#2E2E2A]">
            {tests.length === 0 ? (
              <div className="p-8 sm:p-14 text-center">
                <p className="text-lg font-heading font-bold text-[#141413] dark:text-[#FAF8EC]">No exams taken yet</p>
                <p className="text-[#66665E] dark:text-[#A3A399] mt-1 text-xs sm:text-sm">Select any subject above or click Start New Exam to begin.</p>
              </div>
            ) : (
              tests.slice(0, 5).map(test => {
                const subMatch = subjects.find(s => s.id === test.subjectId || s.slug === test.subjectSlug)
                  || getFullPhaseDisplayMeta(test.subjectSlug, test.subjectName)
                  || {
                    name: 'Uncategorised',
                    accentColor: '#64748B',
                    icon: 'Layers'
                  };

                const maxMarks = test.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
                const pct = Math.round(((test.totalScore || 0) / maxMarks) * 100);

                return (
                  <motion.div
                    key={test.id}
                    whileHover={{ x: 4 }}
                    transition={SPRING_SNAPPY}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[#141413]/15 dark:border-white/10"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${subMatch.accentColor} 14%, transparent)`,
                          color: subMatch.accentColor
                        }}
                      >
                        <SubjectIcon name={subMatch.icon} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                          <span className="truncate">{subMatch.name}{test.mode ? ` · ${test.mode}` : ''}</span>
                          {test.reattemptOfTestId && (
                            <span className="px-1.5 py-0.5 rounded bg-[#FFD426] text-[#141413] border border-[#141413] text-[9px] leading-none shrink-0">
                              Reattempt
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-[#141413] dark:text-[#FAF8EC] mt-0.5 text-sm sm:text-base truncate">
                          {test.status === 'in-progress' ? 'Test in Progress' : `Exam · ${format(test.createdAt, 'MMM d, yyyy · h:mm a')}`}
                        </h4>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-5 shrink-0">
                      {test.status === 'completed' && (
                        <div className="text-left md:text-right">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">Score</span>
                          <span className="text-xl sm:text-2xl font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                            {pct}%
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {test.status === 'completed' ? (
                          <button
                            onClick={() => handleReattempt(test)}
                            disabled={!!reattemptingId || !test.questions || test.questions.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border border-[#141413] shadow-[2px_2px_0px_#141413] cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
                            title="Reattempt this exact exam freshly"
                          >
                            {reattemptingId === test.id ? (
                              <FuturisticSpinner size="xs" color="cobalt" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{reattemptingId === test.id ? 'Starting...' : 'Reattempt'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openTerminateModal(test)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer"
                          >
                            Terminate
                          </button>
                        )}
                        <Link
                          to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border border-[#141413] cursor-pointer whitespace-nowrap"
                        >
                          {test.status === 'completed' ? 'View Results' : 'Resume'}
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </MotionSection>

      {/* Terminate In-Progress Test Modal */}
      <MotionModal
        isOpen={!!terminateTarget}
        onClose={() => !terminating && setTerminateTarget(null)}
        maxWidthClass="max-w-sm"
      >
        {terminateTarget && (
          <div className="bg-[#FAF8EC] dark:bg-[#1C1C1A] rounded-3xl w-full p-6 sm:p-8 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/40 border-[2px] border-[#141413] dark:border-[#ECD5FF]">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
                Terminate Attempt?
              </h3>
            </div>
            <p className="text-[#40403B] dark:text-[#A3A399] font-medium mb-4 leading-relaxed text-sm">
              This will permanently delete your in-progress attempt
              {terminateTarget.subjectName ? ` for ${terminateTarget.subjectName}` : ''}.
              {terminateTarget.reattemptOfTestId ? ' Your original past exam results remain completely safe.' : ''}
            </p>
            {terminateError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
                {terminateError}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={confirmTerminate}
                disabled={terminating}
                className="w-full min-h-[46px] py-3 font-bold bg-rose-600 hover:bg-rose-700 text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 text-sm"
              >
                {terminating ? (
                  <FuturisticSpinner size="xs" color="white" />
                ) : (
                  <Trash2 className="w-4 h-4 shrink-0" />
                )}
                <span>{terminating ? 'Terminating...' : 'Confirm Terminate & Delete'}</span>
              </motion.button>
              <button
                onClick={() => setTerminateTarget(null)}
                disabled={terminating}
                className="w-full min-h-[44px] py-2.5 font-bold text-[#141413] dark:text-[#FAF8EC] bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] rounded-xl transition-colors cursor-pointer text-sm"
              >
                Keep Attempt
              </button>
            </div>
          </div>
        )}
      </MotionModal>

    </MotionPage>
  );
}

function KpiMiniCard({
  icon,
  title,
  valueNode,
  subtext
}: {
  icon: React.ReactNode;
  title: string;
  valueNode: React.ReactNode;
  subtext: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.018 }}
      whileTap={{ scale: 0.965 }}
      transition={SPRING_BOUNCY}
      className="h-full bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[104px] sm:min-h-[120px] hover:border-[#141413] dark:hover:border-[#ECD5FF] transition-colors will-change-transform"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold truncate">
          {title}
        </span>
        <div className="p-1.5 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] shrink-0">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC] tracking-tight">
          {valueNode}
        </p>
        <p className="text-[10px] font-medium text-[#66665E] dark:text-[#A3A399] truncate mt-0.5">
          {subtext}
        </p>
      </div>
    </motion.div>
  );
}
