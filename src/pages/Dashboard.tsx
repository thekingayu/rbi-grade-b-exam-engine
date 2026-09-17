import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { TestAttempt } from '../types';
import { format } from 'date-fns';
import { 
  Plus, CheckCircle2, TrendingUp, Trophy, ArrowRight,
  Target, AlertTriangle, Clock, ListOrdered, FileText
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
            Welcome back, {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Student'}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2 font-medium">Here's your RBI Grade B preparation overview.</p>
        </div>
        <Link 
          to="/new" 
          className="inline-flex items-center justify-center gap-2 bg-white/60 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-white/60 dark:border-white/10 px-8 py-4 rounded-3xl font-bold transition-all shadow-xl shadow-slate-200/50 dark:shadow-black/20 hover:-translate-y-1 backdrop-blur-xl"
        >
          <div className="w-8 h-8 rounded-full bg-[#9A7D3C] text-white flex items-center justify-center shadow-md">
            <Plus className="w-5 h-5" />
          </div>
          <span>Start New Exam</span>
        </Link>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />} title="Tests taken" value={testsTaken.toString()} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />} title="Average score" value={testsTaken > 0 ? `${avgScore}%` : '-'} />
        <StatCard icon={<Trophy className="w-5 h-5 text-[#9A7D3C]" />} title="Best score" value={testsTaken > 0 ? `${bestScore}%` : '-'} />
        <StatCard icon={<ArrowRight className="w-5 h-5 text-purple-600 dark:text-purple-400" />} title="Last test vs. previous" value={lastVsPrevLabel} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Score Trend */}
        <ChartCard title="Score trend" subtitle="Overall % across every attempt">
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
        <ChartCard title="Accuracy by category" subtitle="Averaged across all tests">
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
        <ChartCard title="Static vs. dynamic" subtitle="Where marks are actually coming from">
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
        <ChartCard title="Time management" subtitle="Share of allotted time used, per attempt">
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

      {/* Insight Callouts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <InsightCard icon={<Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />} title="Strongest area" value={validCats.length > 0 ? `${strongestArea.name}` : '-'} subValue={validCats.length > 0 ? `${Math.round(strongestArea.value)}%` : ''} />
        <InsightCard icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />} title="Needs work" value={validCats.length > 0 ? `${weakestArea.name}` : '-'} subValue={validCats.length > 0 ? `${Math.round(weakestArea.value)}%` : ''} />
        <InsightCard icon={<ListOrdered className="w-5 h-5 text-blue-600 dark:text-blue-400" />} title="Avg. MCQ accuracy" value={testsTaken > 0 ? `${avgMcqAcc}%` : '-'} />
        <InsightCard icon={<FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />} title="Avg. descriptive score" value={testsTaken > 0 ? `${avgDescAcc}%` : '-'} />
      </div>

      {/* Test History */}
      <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
        <div className="flex items-center justify-between p-8 border-b border-slate-200/50 dark:border-white/10 bg-white/20 dark:bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center shadow-sm shrink-0">
              <Clock className="w-6 h-6 text-[#9A7D3C]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Test history</h3>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Per-attempt section breakdown</span>
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-200/50 dark:divide-white/10">
          {tests.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-6 shadow-sm">
                <FileText className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white">No tests taken yet</p>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Start a new exam to see your history here.</p>
            </div>
          ) : (
            tests.map(test => {
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
                <div key={test.id} className="p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/40 dark:hover:bg-white/[0.04] transition-all group border-b border-slate-200/50 dark:border-white/5 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-lg">
                      {test.status === 'in-progress' ? 'Test in progress' : `Mock Exam • ${format(test.createdAt, 'MMMM d, yyyy')}`}
                    </h4>
                    {test.status === 'completed' && (
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300 font-medium">
                        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/5 px-4 py-1.5 rounded-full shadow-sm">
                          MCQ: <span className="text-slate-900 dark:text-white font-bold ml-1">{tMcqAcc}%</span>
                        </div>
                        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/5 px-4 py-1.5 rounded-full shadow-sm">
                          Desc: <span className="text-slate-900 dark:text-white font-bold ml-1">{tDescAcc}%</span>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full backdrop-blur-md border shadow-sm ${timePct >= 95 ? 'bg-red-50/80 dark:bg-red-500/20 border-red-200 dark:border-red-500/30' : 'bg-white/60 dark:bg-white/10 border-white/50 dark:border-white/5'}`}>
                          Time used: <span className={`font-bold ml-1 ${timePct >= 95 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{timePct}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8 w-full md:w-auto">
                    {test.status === 'completed' && (
                      <div className="text-left sm:text-right">
                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wider">Total Score</span>
                        <span className="text-4xl font-serif font-bold text-slate-900 dark:text-white">{tOverall}%</span>
                      </div>
                    )}
                    <div className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-4 w-full sm:w-auto">
                      {test.status !== 'completed' && (
                        <button
                          onClick={() => handleTerminate(test.id)}
                          className="flex-1 sm:flex-none h-12 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-sm font-bold flex items-center justify-center transition-all bg-red-50 dark:bg-red-500/10 backdrop-blur-md border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 shadow-md hover:bg-red-100 dark:hover:bg-red-500/20 hover:-translate-y-1 hover:shadow-lg whitespace-nowrap"
                        >
                          Terminate
                        </button>
                      )}
                      <Link 
                        to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                        className="flex-1 sm:flex-none h-12 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-sm font-bold flex items-center justify-center transition-all bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-slate-900 dark:text-white shadow-md hover:bg-white/90 dark:hover:bg-white/20 group-hover:-translate-y-1 hover:shadow-lg whitespace-nowrap"
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

function StatCard({ icon, title, value }: { icon: React.ReactNode, title: string, value: string }) {
  return (
    <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col justify-between h-28 sm:h-40 relative overflow-hidden group hover:-translate-y-1 hover:shadow-2xl hover:bg-white/80 dark:hover:bg-white/[0.05] transition-all duration-300">
      <div className="absolute top-0 right-0 p-4 sm:p-5 opacity-40 dark:opacity-20 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
        {icon}
      </div>
      <div>
        <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</p>
      </div>
      <p className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 dark:text-white drop-shadow-sm">{value}</p>
    </div>
  );
}

function InsightCard({ icon, title, value, subValue }: { icon: React.ReactNode, title: string, value: string, subValue?: string }) {
  return (
    <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 hover:bg-white/80 dark:hover:bg-white/[0.05] transition-colors group">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 sm:mb-1.5">{title}</p>
        <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
          {value} {subValue && <span className="text-[#9A7D3C] ml-1">{subValue}</span>}
        </p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) {
  return (
    <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-3xl p-8 flex flex-col h-[400px]">
      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</span>
      </div>
      <div className="flex-1 min-h-0 relative">
        {children}
      </div>
    </div>
  );
}
