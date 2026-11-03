import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { TestAttempt } from '../types';
import { useSubject } from '../context/SubjectContext';
import { SubjectCard } from '../components/dashboard/SubjectCard';
import { CrossSubjectCharts } from '../components/dashboard/CrossSubjectCharts';
import { InsightsPanel } from '../components/dashboard/InsightsPanel';
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { ExamCountdownGoal } from '../components/dashboard/ExamCountdownGoal';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import { 
  Plus, CheckCircle2, TrendingUp, Trophy, ArrowRight,
  Clock, Flame, BookOpen, Sparkles, AlertCircle, ArrowUpRight,
  Layers, FileText
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { Spinner, Divider } from 'sketchbook-ui';

export function Dashboard({ user }: { user: User }) {
  const { subjects, setActiveSubject } = useSubject();
  const [tests, setTests] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Clear active subject on root dashboard
  useEffect(() => {
    setActiveSubject(null);
  }, [setActiveSubject]);

  useEffect(() => {
    const q = query(
      collection(db, 'tests'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({
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

  const handleTerminate = async (testId: string) => {
    if (!window.confirm("Are you sure you want to terminate and delete this in-progress test?")) return;
    try {
      await deleteDoc(doc(db, 'tests', testId));
      setTests(prev => prev.filter(t => t.id !== testId));
    } catch (e) {
      console.error(e);
      alert("Error terminating test. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500 dark:text-slate-400 gap-3">
        <Spinner variant="spiral" size="lg" colors={{ stroke: '#0D9488' }} />
        <span className="text-xs font-mono tracking-wider uppercase text-slate-400">Loading Cadre Command Center...</span>
      </div>
    );
  }

  const completed = tests.filter(t => t.status === 'completed');
  const reversedTests = [...completed].reverse();

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

  // 4. KPI: Momentum (computed over the last 3 tests vs prior tests)
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
  const totalHours = (totalSeconds / 3600).toFixed(1);

  // Group subjects by phase
  const phase1Subjects = subjects.filter(s => s.phase === 'Phase 1' && s.slug !== 'uncategorized');
  const phase2Subjects = subjects.filter(s => s.phase === 'Phase 2');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pt-2 pb-16 relative z-10">
      
      {/* 1. Global Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/30 dark:border-teal-500/40 backdrop-blur-md mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-teal-200 tracking-wider uppercase">
              RESERVE BANK OF INDIA · OFFICER CADRE COMMAND CENTER
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-teal-600 text-white text-[9px] font-bold">2026-27</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
            Welcome back, <span className="bg-gradient-to-r from-teal-500 via-cyan-400 to-indigo-500 dark:from-teal-300 dark:via-cyan-300 dark:to-indigo-300 bg-clip-text text-transparent">{user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Officer'}</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1 sm:mt-1.5 text-xs sm:text-sm font-medium">
            Centralized preparation telemetry across all Phase 1 and Phase 2 curriculum verticals.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link 
            to="/new" 
            className="sketch-tactile-btn inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 hover:from-teal-500 hover:via-cyan-500 hover:to-indigo-500 text-white border border-teal-400/30 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl sm:rounded-3xl font-bold transition-all shadow-xl shadow-teal-600/25 dark:shadow-[0_0_30px_rgba(13,148,136,0.3)] backdrop-blur-xl w-full sm:w-auto text-sm sm:text-base cursor-pointer shrink-0"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shadow-xs shrink-0">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <span>Start New Exam</span>
          </Link>
        </div>
      </div>

      {/* 2. Target Exam Countdown & Cutoff Score Tracker */}
      <ExamCountdownGoal currentAvgScore={avgScore} />

      {/* 3. KPI Row: Total tests, Overall avg, Best score, Momentum (3-test), Streak, Total hours */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KpiMiniCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          title="Total Tests"
          value={testsTaken.toString()}
          subtext="Attempts logged"
          color="emerald"
        />
        <KpiMiniCard
          icon={<TrendingUp className="w-4 h-4 text-cyan-500" />}
          title="Overall Average"
          value={testsTaken > 0 ? `${avgScore}%` : '—'}
          subtext="Aggregate accuracy"
          color="cyan"
        />
        <KpiMiniCard
          icon={<Trophy className="w-4 h-4 text-amber-500" />}
          title="Personal Best"
          value={testsTaken > 0 ? `${bestScore}%` : '—'}
          subtext="Top score benchmark"
          color="amber"
        />
        <KpiMiniCard
          icon={<TrendingUp className={`w-4 h-4 ${momentumIsPositive ? 'text-teal-500' : 'text-rose-500'}`} />}
          title="3-Test Momentum"
          value={momentumLabel}
          subtext="vs prior baseline"
          color="teal"
        />
        <KpiMiniCard
          icon={<Flame className="w-4 h-4 text-rose-500" />}
          title="Study Streak"
          value={`${streak}d`}
          subtext="Consecutive days"
          color="rose"
        />
        <KpiMiniCard
          icon={<Clock className="w-4 h-4 text-indigo-500" />}
          title="Hours Practiced"
          value={`${totalHours}h`}
          subtext="Time in exam room"
          color="indigo"
        />
      </div>

      {/* 4. SUBJECT GRID (THE CENTERPIECE) */}
      <div className="space-y-6">
        
        {/* Phase 1 Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(13,148,136,0.8)]" />
              <h2 className="text-lg sm:text-xl font-serif font-black text-slate-900 dark:text-white">
                Phase 1 Subjects · Preliminary Cadre Examination
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              4 Verticals · Objective Speed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {phase1Subjects.map(sub => (
              <SubjectCard key={sub.id} subject={sub} tests={tests} />
            ))}
          </div>
        </div>

        {/* Phase 2 Section */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              <h2 className="text-lg sm:text-xl font-serif font-black text-slate-900 dark:text-white">
                Phase 2 Subjects · Main Selection & Writing
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              3 Papers · 300 Total Marks
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {phase2Subjects.map(sub => (
              <SubjectCard key={sub.id} subject={sub} tests={tests} />
            ))}
          </div>
        </div>
      </div>

      {/* 5. Rule-Based Smart Insights */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-500" />
            <span>Cadre Diagnostic Insights</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
            AI-POWERED PATTERN AUDIT
          </span>
        </div>
        <InsightsPanel subjects={subjects} tests={tests} />
      </div>

      {/* 6. Cross-Subject Visual Analytics */}
      <CrossSubjectCharts subjects={subjects} tests={tests} />

      {/* 7. Activity Heatmap */}
      <ActivityHeatmap tests={tests} streakDays={streak} />

      {/* 8. Recent Attempts (Across all subjects) */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/[0.02] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/25 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">Recent Exam Attempts</h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chronological attempts across all Phase 1 & Phase 2 subjects</span>
            </div>
          </div>
          <Link 
            to="/history" 
            className="sketch-tactile-btn flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors bg-white/70 dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs backdrop-blur-sm w-full sm:w-auto justify-center hover:border-teal-500/40"
          >
            View All Archive <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="divide-y divide-slate-200/60 dark:divide-white/10">
          {tests.length === 0 ? (
            <div className="p-8 sm:p-14 text-center">
              <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">No exams taken yet</p>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">Select any subject above or click Start New Exam to begin.</p>
            </div>
          ) : (
            tests.slice(0, 5).map(test => {
              const subMatch = subjects.find(s => s.id === test.subjectId || s.slug === test.subjectSlug) || {
                name: 'Uncategorised',
                accentColor: '#64748B',
                icon: 'Layers'
              };

              const maxMarks = test.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
              const pct = Math.round(((test.totalScore || 0) / maxMarks) * 100);

              return (
                <div key={test.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/50 dark:hover:bg-white/[0.03] transition-all group">
                  <div className="flex items-center gap-3.5">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${subMatch.accentColor} 14%, transparent)`,
                        borderColor: `color-mix(in srgb, ${subMatch.accentColor} 30%, transparent)`,
                        color: subMatch.accentColor
                      }}
                    >
                      <SubjectIcon name={subMatch.icon} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${subMatch.accentColor} 10%, transparent)`,
                            borderColor: `color-mix(in srgb, ${subMatch.accentColor} 25%, transparent)`,
                            color: subMatch.accentColor
                          }}
                        >
                          {subMatch.name}
                        </span>
                        {test.mode && (
                          <span className="text-[10px] font-mono text-slate-400">
                            · {test.mode}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white mt-1 text-sm sm:text-base">
                        {test.status === 'in-progress' ? 'Test in Progress' : `Exam · ${format(test.createdAt, 'MMM d, yyyy · h:mm a')}`}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-5">
                    {test.status === 'completed' && (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Score</span>
                        <span className="text-xl sm:text-2xl font-serif font-black text-slate-900 dark:text-white">
                          {pct}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {test.status !== 'completed' && (
                        <button
                          onClick={() => handleTerminate(test.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/25 cursor-pointer"
                        >
                          Terminate
                        </button>
                      )}
                      <Link
                        to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-xs cursor-pointer"
                      >
                        {test.status === 'completed' ? 'View Results' : 'Resume'}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}

function KpiMiniCard({
  icon,
  title,
  value,
  subtext,
  color = 'teal'
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtext: string;
  color?: string;
}) {
  return (
    <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between min-h-[110px] shadow-sm hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold truncate">
          {title}
        </span>
        <div className="p-1 rounded-lg bg-slate-100 dark:bg-white/5">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-serif font-black text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
          {subtext}
        </p>
      </div>
    </div>
  );
}
