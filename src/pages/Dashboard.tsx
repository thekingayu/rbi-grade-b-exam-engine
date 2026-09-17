import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { TestAttempt } from '../types';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
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

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-500 dark:text-slate-400">Loading dashboard...</div>;
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pt-4 pb-12">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-2">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
            Welcome back, {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Student'}
          </h1>
        </div>
        <Link 
          to="/new" 
          className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-6 py-3 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Start New Exam</span>
        </Link>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Tests taken" value={testsTaken.toString()} />
        <StatCard title="Average score" value={testsTaken > 0 ? `${avgScore}%` : '-'} />
        <StatCard title="Best score" value={testsTaken > 0 ? `${bestScore}%` : '-'} />
        <StatCard title="Last test vs. previous" value={lastVsPrevLabel} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Score Trend */}
        <ChartCard title="Score trend" subtitle="Overall % across every attempt">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: ACCENT_COLOR }}
              />
              <Line type="monotone" dataKey="percent" stroke={ACCENT_COLOR} strokeWidth={3} dot={{ r: 4, fill: ACCENT_COLOR, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Accuracy by Category */}
        <ChartCard title="Accuracy by category" subtitle="Averaged across all tests">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} width={80} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                cursor={{ fill: 'rgba(51, 65, 85, 0.2)' }}
              />
              <Bar dataKey="value" fill={ACCENT_COLOR} radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Static vs Dynamic Split */}
        <ChartCard title="Static vs. dynamic" subtitle="Where marks are actually coming from">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={splitData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {splitData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? ACCENT_COLOR : '#475569'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ACCENT_COLOR }}></div>
              Static
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-600"></div>
              Dynamic
            </div>
          </div>
        </ChartCard>

        {/* Time Management */}
        <ChartCard title="Time management" subtitle="Share of allotted time used, per attempt">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeManagementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                cursor={{ fill: 'rgba(51, 65, 85, 0.2)' }}
              />
              <Bar dataKey="percent" radius={[4, 4, 0, 0]} barSize={32}>
                {timeManagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Insight Callouts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Strongest area" value={validCats.length > 0 ? `${strongestArea.name} (${Math.round(strongestArea.value)}%)` : '-'} />
        <StatCard title="Needs work" value={validCats.length > 0 ? `${weakestArea.name} (${Math.round(weakestArea.value)}%)` : '-'} />
        <StatCard title="Avg. MCQ accuracy" value={testsTaken > 0 ? `${avgMcqAcc}%` : '-'} />
        <StatCard title="Avg. descriptive score" value={testsTaken > 0 ? `${avgDescAcc}%` : '-'} />
      </div>

      {/* Test History */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Test history</h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">Per-attempt section breakdown</span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {tests.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No tests taken yet.</div>
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
                <div key={test.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-[#151e32] transition-colors">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {test.status === 'in-progress' ? 'Test in progress' : `Exam • ${format(test.createdAt, 'MMM d, yyyy')}`}
                    </h4>
                    {test.status === 'completed' && (
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span>MCQ: <span className="text-slate-900 dark:text-white font-medium">{tMcqAcc}%</span></span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>Desc: <span className="text-slate-900 dark:text-white font-medium">{tDescAcc}%</span></span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>Time used: <span className={timePct >= 95 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-slate-900 dark:text-white font-medium'}>{timePct}%</span></span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {test.status === 'completed' && (
                      <div className="text-right">
                        <span className="text-xl font-bold text-slate-900 dark:text-white">{tOverall}%</span>
                      </div>
                    )}
                    <Link 
                      to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-slate-100 dark:bg-[#1e293b] text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-[#2d3b54]"
                    >
                      {test.status === 'completed' ? 'View Results' : 'Resume'}
                    </Link>
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

function StatCard({ title, value }: { title: string, value: string }) {
  return (
    <div className="bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 flex flex-col justify-between h-28">
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-5 flex flex-col h-80">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
