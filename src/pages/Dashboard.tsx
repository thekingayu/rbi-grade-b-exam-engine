import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { TestAttempt } from '../types';
import { format } from 'date-fns';
import { 
  Plus, CheckCircle2, TrendingUp, Trophy, ArrowRight,
  Target, AlertTriangle, Clock, ListOrdered, FileText, Sparkles,
  SlidersHorizontal, Zap, Award
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const ACCENT_COLOR = '#9A7D3C';
const WARNING_COLOR = '#ef4444';
const CHART_TEXT = '#64748b';

export function Dashboard({ user }: { user: User }) {
  const [tests, setTests] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const q = query(
          collection(db, 'tests'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const fetchedTests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TestAttempt[];
        
        fetchedTests.sort((a, b) => b.createdAt - a.createdAt);
        setTests(fetchedTests);
      } catch (error) {
        console.error('Error fetching tests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
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
    return <div className="flex justify-center py-32 text-slate-500 dark:text-slate-400 font-medium">Loading your dashboard...</div>;
  }

  const completedTests = tests.filter(t => t.status === 'completed');
  const reversedTests = [...completedTests].reverse();

  // Metrics Calculation
  const scoreTrendData = reversedTests.map((t, i) => {
    const mcqMax = t.questions?.filter(q => q.type === 'MCQ').reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 0;
    const descMax = t.questions?.filter(q => q.type === 'Descriptive').reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 0;
    const totalMax = mcqMax + descMax;
    const percent = totalMax > 0 ? ((t.totalScore || 0) / totalMax) * 100 : 0;
    return { name: `T${i + 1}`, percent: Math.round(percent) };
  });

  let totalMcqStaticScore = 0, totalMcqStaticMax = 0;
  let totalMcqDynScore = 0, totalMcqDynMax = 0;
  let totalDescStaticScore = 0, totalDescStaticMax = 0;
  let totalDescDynScore = 0, totalDescDynMax = 0;

  let totalStaticScore = 0;
  let totalDynScore = 0;

  let totalMcqScore = 0, totalMcqMax = 0;
  let totalDescScore = 0, totalDescMax = 0;

  const timeManagementData = reversedTests.map((t, i) => {
    const timeUsedSecs = ((t.submittedAt || 0) - (t.startedAt || 0)) / 1000;
    const allotted = t.durationSeconds || 1;
    const pct = Math.min(100, Math.max(0, (timeUsedSecs / allotted) * 100));
    return { 
      name: `T${i + 1}`, 
      percent: Math.round(pct),
      fill: pct >= 95 ? WARNING_COLOR : ACCENT_COLOR 
    };
  });

  reversedTests.forEach(t => {
    t.questions?.forEach((q, i) => {
      const isMcq = q.type === 'MCQ';
      const isStatic = q.sourceTag === 'Static';
      const max = q.maxMarks || 0;
      
      let score = 0;
      if (isMcq) {
         score = Math.max(0, q.score || 0);
         totalMcqScore += score;
         totalMcqMax += max;
      } else {
         const qId = q.id || i.toString();
         score = t.evaluations?.[qId]?.totalScore || 0;
         totalDescScore += score;
         totalDescMax += max;
      }
      
      if (isStatic) {
         totalStaticScore += score;
      } else {
         totalDynScore += score;
      }
      
      if (isMcq && isStatic) {
        totalMcqStaticScore += score; totalMcqStaticMax += max;
      } else if (isMcq && !isStatic) {
        totalMcqDynScore += score; totalMcqDynMax += max;
      } else if (!isMcq && isStatic) {
        totalDescStaticScore += score; totalDescStaticMax += max;
      } else if (!isMcq && !isStatic) {
        totalDescDynScore += score; totalDescDynMax += max;
      }
    });
  });

  const catAccuracy = {
    'MCQ Static': totalMcqStaticMax > 0 ? (totalMcqStaticScore / totalMcqStaticMax) * 100 : 0,
    'MCQ Dynamic': totalMcqDynMax > 0 ? (totalMcqDynScore / totalMcqDynMax) * 100 : 0,
    'Desc Static': totalDescStaticMax > 0 ? (totalDescStaticScore / totalDescStaticMax) * 100 : 0,
    'Desc Dynamic': totalDescDynMax > 0 ? (totalDescDynScore / totalDescDynMax) * 100 : 0,
  };

  const categoryData = Object.entries(catAccuracy).map(([name, val]) => ({ name, value: Math.round(val) }));

  const splitData = [
    { name: 'Static', value: Math.round(totalStaticScore) },
    { name: 'Dynamic', value: Math.round(totalDynScore) }
  ];

  let strongestArea = { name: '-', value: 0 };
  let weakestArea = { name: '-', value: 100 };
  const validCats = Object.entries(catAccuracy).filter(([name]) => {
    if (name === 'MCQ Static') return totalMcqStaticMax > 0;
    if (name === 'MCQ Dynamic') return totalMcqDynMax > 0;
    if (name === 'Desc Static') return totalDescStaticMax > 0;
    if (name === 'Desc Dynamic') return totalDescDynMax > 0;
    return false;
  });

  if (validCats.length > 0) {
    validCats.forEach(([name, val]) => {
      if (val >= strongestArea.value) { strongestArea = { name, value: val }; }
      if (val <= weakestArea.value) { weakestArea = { name, value: val }; }
    });
  } else {
    weakestArea.value = 0;
  }

  const testsTaken = completedTests.length;
  const bestScore = scoreTrendData.reduce((max, cur) => Math.max(max, cur.percent), 0);
  const avgScore = testsTaken > 0 ? Math.round(scoreTrendData.reduce((sum, cur) => sum + cur.percent, 0) / testsTaken) : 0;
  
  let lastVsPrevLabel = "-";
  if (testsTaken > 1) {
    const diff = scoreTrendData[scoreTrendData.length - 1].percent - scoreTrendData[scoreTrendData.length - 2].percent;
    lastVsPrevLabel = diff > 0 ? `+${diff}%` : `${diff}%`;
  }

  const avgMcqAcc = totalMcqMax > 0 ? Math.round((totalMcqScore / totalMcqMax) * 100) : 0;
  const avgDescAcc = totalDescMax > 0 ? Math.round((totalDescScore / totalDescMax) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pt-2 pb-16 relative z-10">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9A7D3C]/10 dark:bg-[#9A7D3C]/20 border border-[#9A7D3C]/30 dark:border-[#9A7D3C]/40 backdrop-blur-md mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-[#9A7D3C] dark:text-[#E5C378]" />
            <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-amber-200 tracking-wider uppercase">
              OFFICER CADRE PERFORMANCE SUITE
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#9A7D3C] text-white text-[9px] font-bold">2026</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
            Welcome back, <span className="bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-500 dark:from-[#F3E5AB] dark:via-amber-400 dark:to-emerald-400 bg-clip-text text-transparent">{user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Officer'}</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1 sm:mt-1.5 text-xs sm:text-sm font-medium">
            Calibrated to exact Reserve Bank of India standards. Live preparation analytics & scoring metrics.
          </p>
        </div>
        <Link 
          to="/new" 
          className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-600 hover:from-[#886d33] hover:to-[#9A7D3C] text-white border border-amber-400/30 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl sm:rounded-3xl font-bold transition-all shadow-xl shadow-[#9A7D3C]/25 dark:shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-xl w-full sm:w-auto text-sm sm:text-base cursor-pointer shrink-0"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shadow-xs shrink-0">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <span>Start New Exam</span>
        </Link>
      </div>

      {/* Top Stat Cards with Lighted Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          title="Tests taken" 
          value={testsTaken.toString()} 
          badge="COMPLETED"
          theme="emerald"
        />
        <StatCard 
          icon={<TrendingUp className="w-5 h-5" />} 
          title="Average score" 
          value={testsTaken > 0 ? `${avgScore}%` : '-'} 
          badge="OVERALL ACC."
          theme="cyan"
        />
        <StatCard 
          icon={<Trophy className="w-5 h-5" />} 
          title="Best score" 
          value={testsTaken > 0 ? `${bestScore}%` : '-'} 
          badge="TOP RECORD"
          theme="gold"
        />
        <StatCard 
          icon={<ArrowRight className="w-5 h-5" />} 
          title="Last test vs. previous" 
          value={lastVsPrevLabel} 
          badge="MOMENTUM"
          theme="purple"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Score Trend */}
        <ChartCard 
          title="Score trend" 
          subtitle="Overall % across every attempt"
          icon={<TrendingUp className="w-5 h-5" />}
          badge="TRAJECTORY"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
              <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
                itemStyle={{ color: ACCENT_COLOR, fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="percent" stroke={ACCENT_COLOR} strokeWidth={4} dot={{ r: 5, fill: '#fff', stroke: ACCENT_COLOR, strokeWidth: 3 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Accuracy by Category */}
        <ChartCard 
          title="Accuracy by category" 
          subtitle="Averaged across all tests"
          icon={<Target className="w-5 h-5" />}
          badge="BENCHMARK 100%"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" horizontal={false} />
              <XAxis type="number" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} width={80} fontWeight={600} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
              />
              <Bar dataKey="value" fill={ACCENT_COLOR} radius={[0, 8, 8, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Static vs Dynamic Split */}
        <ChartCard 
          title="Static vs. dynamic" 
          subtitle="Where marks are actually coming from"
          icon={<SlidersHorizontal className="w-5 h-5" />}
          badge="WEIGHTAGE"
        >
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={splitData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {splitData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? ACCENT_COLOR : '#334155'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="shrink-0 flex justify-center gap-8 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: ACCENT_COLOR }}></div>
                Static
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-400 dark:bg-slate-700 shadow-sm"></div>
                Dynamic
              </div>
            </div>
          </div>
        </ChartCard>

        {/* Time Management */}
        <ChartCard 
          title="Time management" 
          subtitle="Share of allotted time used, per attempt"
          icon={<Clock className="w-5 h-5" />}
          badge="EFFICIENCY"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeManagementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
              <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
              />
              <Bar dataKey="percent" radius={[8, 8, 0, 0]} barSize={36}>
                {timeManagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Insight Callouts with Lighted Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <InsightCard 
          icon={<Target className="w-5 h-5" />} 
          title="Strongest area" 
          value={validCats.length > 0 ? `${strongestArea.name}` : '-'} 
          subValue={validCats.length > 0 ? `${Math.round(strongestArea.value)}%` : ''} 
          theme="emerald"
        />
        <InsightCard 
          icon={<AlertTriangle className="w-5 h-5" />} 
          title="Needs work" 
          value={validCats.length > 0 ? `${weakestArea.name}` : '-'} 
          subValue={validCats.length > 0 ? `${Math.round(weakestArea.value)}%` : ''} 
          theme="rose"
        />
        <InsightCard 
          icon={<ListOrdered className="w-5 h-5" />} 
          title="Avg. MCQ accuracy" 
          value={testsTaken > 0 ? `${avgMcqAcc}%` : '-'} 
          theme="cyan"
        />
        <InsightCard 
          icon={<FileText className="w-5 h-5" />} 
          title="Avg. descriptive score" 
          value={testsTaken > 0 ? `${avgDescAcc}%` : '-'} 
          theme="purple"
        />
      </div>

      {/* Test History */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9A7D3C]/40 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-7 border-b border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/[0.02] gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-[#9A7D3C] dark:text-[#E5C378] border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">Test history</h3>
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Per-attempt section breakdown</span>
            </div>
          </div>
          {tests.length > 3 && (
            <Link to="/history" className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors bg-white/70 dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs backdrop-blur-sm w-full sm:w-auto justify-center hover:border-[#9A7D3C]/40">
              View All Past Tests <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <div className="divide-y divide-slate-200/60 dark:divide-white/10">
          {tests.length === 0 ? (
            <div className="p-8 sm:p-16 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-[#9A7D3C] dark:text-[#E5C378] border border-amber-500/20 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-[#9A7D3C] dark:text-[#E5C378]" />
              </div>
              <p className="text-xl sm:text-2xl font-serif font-bold text-slate-900 dark:text-white">No tests taken yet</p>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-xs sm:text-base">Start a new exam to see your history here.</p>
            </div>
          ) : (
            <>
              {tests.slice(0, 3).map(test => {
              const mcqQs = test.questions?.filter(q => q.type === 'MCQ') || [];
              const descQs = test.questions?.filter(q => q.type === 'Descriptive') || [];
              
              const tMcqScore = mcqQs.reduce((sum, q) => sum + Math.max(0, q.score || 0), 0);
              const tMcqMax = mcqQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              const tMcqAcc = tMcqMax > 0 ? Math.round((tMcqScore / tMcqMax) * 100) : 0;
              
              const tDescScore = descQs.reduce((sum, q) => {
                const qId = q.id || test.questions?.indexOf(q).toString();
                return sum + (test.evaluations?.[qId]?.totalScore || 0);
              }, 0);
              const tDescMax = descQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              const tDescAcc = tDescMax > 0 ? Math.round((tDescScore / tDescMax) * 100) : 0;
              
              const tTotalMax = tMcqMax + tDescMax;
              const tOverall = tTotalMax > 0 ? Math.round(((test.totalScore || 0) / tTotalMax) * 100) : 0;

              const timeUsedSecs = ((test.submittedAt || 0) - (test.startedAt || 0)) / 1000;
              const allotted = test.durationSeconds || 1;
              const timePct = Math.min(100, Math.max(0, Math.round((timeUsedSecs / allotted) * 100)));

              return (
                <div key={test.id} className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 hover:bg-white/50 dark:hover:bg-white/[0.03] transition-all group border-b border-slate-200/60 dark:border-white/5 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2 sm:mb-2.5 text-base sm:text-lg">
                      {test.status === 'in-progress' ? 'Test in progress' : `Mock Exam • ${format(test.createdAt, 'MMMM d, yyyy')}`}
                    </h4>
                    {test.status === 'completed' && (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                        <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/10 px-3 py-1 rounded-full shadow-xs">
                          MCQ: <span className="text-[#9A7D3C] dark:text-[#E5C378] font-bold ml-1">{tMcqAcc}%</span>
                        </div>
                        <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/10 px-3 py-1 rounded-full shadow-xs">
                          Desc: <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">{tDescAcc}%</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full backdrop-blur-md border shadow-xs ${timePct >= 95 ? 'bg-red-50/80 dark:bg-red-500/20 border-red-200 dark:border-red-500/30' : 'bg-white/80 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/10'}`}>
                          Time: <span className={`font-bold ml-1 ${timePct >= 95 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{timePct}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-8 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-white/5">
                    {test.status === 'completed' && (
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 block mb-0.5 uppercase tracking-wider">Total Score</span>
                        <span className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white">{tOverall}%</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 md:flex-initial justify-end">
                      {test.status !== 'completed' && (
                        <button
                          onClick={() => handleTerminate(test.id)}
                          className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center transition-all bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-600 dark:text-red-400 cursor-pointer whitespace-nowrap"
                        >
                          Terminate
                        </button>
                      )}
                      <Link 
                        to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                        className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center transition-all bg-gradient-to-r from-[#9A7D3C] to-amber-600 hover:from-[#886d33] hover:to-[#9A7D3C] text-white shadow-md shadow-[#9A7D3C]/20 hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                      >
                        {test.status === 'completed' ? 'View Results' : 'Resume'}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  title, 
  value, 
  badge,
  theme = 'gold' 
}: { 
  icon: React.ReactNode; 
  title: string; 
  value: string; 
  badge?: string;
  theme?: 'emerald' | 'cyan' | 'gold' | 'purple';
}) {
  const themeStyles = {
    emerald: {
      cardBorder: 'border-slate-200/80 dark:border-emerald-500/20 hover:border-emerald-500/50 dark:hover:border-emerald-400/50 shadow-slate-200/40 dark:shadow-[0_0_25px_-5px_rgba(16,185,129,0.15)]',
      iconBox: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
      badge: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    },
    cyan: {
      cardBorder: 'border-slate-200/80 dark:border-cyan-500/20 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 shadow-slate-200/40 dark:shadow-[0_0_25px_-5px_rgba(6,182,212,0.15)]',
      iconBox: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
      badge: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
    },
    gold: {
      cardBorder: 'border-slate-200/80 dark:border-amber-500/20 hover:border-amber-500/50 dark:hover:border-amber-400/50 shadow-slate-200/40 dark:shadow-[0_0_25px_-5px_rgba(245,158,11,0.15)]',
      iconBox: 'bg-amber-500/10 dark:bg-amber-500/20 text-[#9A7D3C] dark:text-[#E5C378] border border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
      badge: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/25',
    },
    purple: {
      cardBorder: 'border-slate-200/80 dark:border-purple-500/20 hover:border-purple-500/50 dark:hover:border-purple-400/50 shadow-slate-200/40 dark:shadow-[0_0_25px_-5px_rgba(168,85,247,0.15)]',
      iconBox: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.25)]',
      badge: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/25',
    },
  };

  const style = themeStyles[theme];

  return (
    <div className={`relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border ${style.cardBorder} rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between min-h-[145px] sm:min-h-[165px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group overflow-hidden`}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent pointer-events-none" />
      
      <div className="flex items-center justify-between gap-2">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${style.iconBox}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.badge}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="pt-3">
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate mb-1">
          {title}
        </p>
        <p className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-slate-900 dark:text-white drop-shadow-xs">
          {value}
        </p>
      </div>
    </div>
  );
}

function InsightCard({ 
  icon, 
  title, 
  value, 
  subValue,
  theme = 'emerald'
}: { 
  icon: React.ReactNode; 
  title: string; 
  value: string; 
  subValue?: string;
  theme?: 'emerald' | 'rose' | 'cyan' | 'purple';
}) {
  const themeStyles = {
    emerald: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]',
    rose: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
    cyan: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]',
    purple: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]',
  };

  return (
    <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-4 transition-all duration-300 hover:-translate-y-0.5 shadow-md shadow-slate-200/30 dark:shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)] group overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent pointer-events-none" />
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${themeStyles[theme]}`}>
        {icon}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 truncate">
          {title}
        </p>
        <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
          {value} {subValue && <span className="text-[#9A7D3C] dark:text-[#E5C378] ml-1 font-mono font-semibold">{subValue}</span>}
        </p>
      </div>
    </div>
  );
}

function ChartCard({ 
  title, 
  subtitle, 
  icon,
  badge,
  children 
}: { 
  title: string; 
  subtitle: string; 
  icon?: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)] rounded-2xl sm:rounded-3xl p-4 sm:p-7 flex flex-col h-[330px] sm:h-[400px] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9A7D3C]/40 to-transparent pointer-events-none" />
      
      <div className="flex items-start justify-between gap-3 mb-3 sm:mb-6">
        <div>
          <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
            {icon && <span className="text-[#9A7D3C] dark:text-[#E5C378]">{icon}</span>}
            <span>{title}</span>
          </h3>
          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</span>
        </div>
        {badge && (
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#9A7D3C]/10 dark:bg-[#9A7D3C]/20 text-[#9A7D3C] dark:text-[#E5C378] border border-[#9A7D3C]/20 shrink-0">
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 relative">
        {children}
      </div>
    </div>
  );
}
