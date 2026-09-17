cat > src/pages/Dashboard.tsx << 'INNER_EOF'
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pt-2 pb-16">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Student'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Here's your RBI Grade B preparation overview.</p>
        </div>
        <Link 
          to="/new" 
          className="inline-flex items-center justify-center gap-2 bg-[#9A7D3C] hover:bg-[#806630] text-white px-7 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-[#9A7D3C]/20 hover:shadow-[#9A7D3C]/40 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          <span>Start New Exam</span>
        </Link>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} title="Tests taken" value={testsTaken.toString()} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-blue-500" />} title="Average score" value={testsTaken > 0 ? `${avgScore}%` : '-'} />
        <StatCard icon={<Trophy className="w-5 h-5 text-[#9A7D3C]" />} title="Best score" value={testsTaken > 0 ? `${bestScore}%` : '-'} />
        <StatCard icon={<ArrowRight className="w-5 h-5 text-purple-500" />} title="Last test vs. previous" value={lastVsPrevLabel} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Score Trend */}
        <ChartCard title="Score trend" subtitle="Overall % across every attempt">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
              <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" horizontal={false} />
              <XAxis type="number" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} width={80} fontWeight={500} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                cursor={{ fill: 'rgba(100,116,139,0.1)' }}
              />
              <Bar dataKey="value" fill={ACCENT_COLOR} radius={[0, 6, 6, 0]} barSize={28} />
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
                innerRadius={65}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {splitData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? ACCENT_COLOR : '#334155'} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-8 mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: ACCENT_COLOR }}></div>
              Static
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 rounded-full bg-slate-700 dark:bg-slate-700"></div>
              Dynamic
            </div>
          </div>
        </ChartCard>

        {/* Time Management */}
        <ChartCard title="Time management" subtitle="Share of allotted time used, per attempt">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeManagementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
              <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                cursor={{ fill: 'rgba(100,116,139,0.1)' }}
              />
              <Bar dataKey="percent" radius={[6, 6, 0, 0]} barSize={36}>
                {timeManagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Insight Callouts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <InsightCard icon={<Target className="w-4 h-4 text-emerald-500" />} title="Strongest area" value={validCats.length > 0 ? `${strongestArea.name}` : '-'} subValue={validCats.length > 0 ? `${Math.round(strongestArea.value)}%` : ''} />
        <InsightCard icon={<AlertTriangle className="w-4 h-4 text-red-500" />} title="Needs work" value={validCats.length > 0 ? `${weakestArea.name}` : '-'} subValue={validCats.length > 0 ? `${Math.round(weakestArea.value)}%` : ''} />
        <InsightCard icon={<ListOrdered className="w-4 h-4 text-blue-500" />} title="Avg. MCQ accuracy" value={testsTaken > 0 ? `${avgMcqAcc}%` : '-'} />
        <InsightCard icon={<FileText className="w-4 h-4 text-purple-500" />} title="Avg. descriptive score" value={testsTaken > 0 ? `${avgDescAcc}%` : '-'} />
      </div>

      {/* Test History */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#9A7D3C]/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#9A7D3C]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Test history</h3>
          </div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Per-attempt section breakdown</span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-white/5">
          {tests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-slate-900 dark:text-white">No tests taken yet</p>
              <p className="text-slate-500 mt-1">Start a new exam to see your history here.</p>
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
                <div key={test.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2 text-lg">
                      {test.status === 'in-progress' ? 'Test in progress' : `Mock Exam • ${format(test.createdAt, 'MMMM d, yyyy')}`}
                    </h4>
                    {test.status === 'completed' && (
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">
                          MCQ: <span className="text-slate-900 dark:text-white font-bold ml-1">{tMcqAcc}%</span>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">
                          Desc: <span className="text-slate-900 dark:text-white font-bold ml-1">{tDescAcc}%</span>
                        </div>
                        <div className={`px-3 py-1 rounded-md ${timePct >= 95 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          Time used: <span className={`font-bold ml-1 ${timePct >= 95 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{timePct}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {test.status === 'completed' && (
                      <div className="text-right">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block mb-1">Total Score</span>
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">{tOverall}%</span>
                      </div>
                    )}
                    <Link 
                      to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                      className="h-12 px-6 rounded-xl text-sm font-bold flex items-center justify-center transition-all bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 group-hover:bg-[#9A7D3C] group-hover:text-white"
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

function StatCard({ icon, title, value }: { icon: React.ReactNode, title: string, value: string }) {
  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/5 shadow-sm rounded-2xl p-6 flex flex-col justify-between h-36 relative overflow-hidden group hover:border-[#9A7D3C]/30 transition-colors">
      <div className="absolute top-0 right-0 p-4 opacity-50 dark:opacity-20 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
      </div>
      <p className="text-4xl font-serif font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function InsightCard({ icon, title, value, subValue }: { icon: React.ReactNode, title: string, value: string, subValue?: string }) {
  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/5 shadow-sm rounded-2xl p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white truncate">
          {value} {subValue && <span className="text-[#9A7D3C] ml-1">{subValue}</span>}
        </p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/5 shadow-sm rounded-2xl p-6 flex flex-col h-96">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</span>
      </div>
      <div className="flex-1 min-h-0 relative">
        {children}
      </div>
    </div>
  );
}
INNER_EOF
