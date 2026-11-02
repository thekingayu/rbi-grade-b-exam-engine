import React, { useState } from 'react';
import { Subject, TestAttempt } from '../../types';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Activity, Clock, ShieldCheck } from 'lucide-react';

interface CrossSubjectChartsProps {
  subjects: Subject[];
  tests: TestAttempt[];
}

const ACCENT_COLOR = '#0D9488';
const CYAN_COLOR = '#06B6D4';
const INDIGO_COLOR = '#6366F1';
const AMBER_COLOR = '#F59E0B';
const ROSE_COLOR = '#EC4899';
const CHART_TEXT = '#64748b';

export function CrossSubjectCharts({ subjects, tests }: CrossSubjectChartsProps) {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const completed = tests.filter(t => t.status === 'completed');
  const reversedTests = [...completed].reverse();

  // 1. Score Trend Data (filterable by subject)
  const filteredForTrend = selectedSubjectFilter === 'all'
    ? reversedTests
    : reversedTests.filter(t => t.subjectId === selectedSubjectFilter || t.subjectSlug === selectedSubjectFilter);

  const trendData = filteredForTrend.map((t, idx) => {
    const totalMax = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
    const pct = Math.round(((t.totalScore || 0) / totalMax) * 100);
    const subMatch = subjects.find(s => s.id === t.subjectId || s.slug === t.subjectSlug);
    return {
      name: `T${idx + 1}`,
      score: pct,
      subject: subMatch?.name || 'General',
      color: subMatch?.accentColor || ACCENT_COLOR
    };
  });

  // 2. Subject Comparison Radar Data
  const radarData = subjects.slice(0, 7).map(s => {
    const sTests = completed.filter(t => t.subjectId === s.id || t.subjectSlug === s.slug);
    let avg = 0;
    if (sTests.length > 0) {
      const sum = sTests.reduce((acc, t) => {
        const totalMax = t.questions?.reduce((m, q) => m + (q.maxMarks || 0), 0) || 1;
        return acc + ((t.totalScore || 0) / totalMax) * 100;
      }, 0);
      avg = Math.round(sum / sTests.length);
    }
    return {
      subject: s.name.length > 12 ? s.name.substring(0, 10) + '…' : s.name,
      fullName: s.name,
      readiness: avg > 0 ? avg : 20, // baseline placeholder if zero tests
      testsCount: sTests.length
    };
  });

  // 3. Static vs Dynamic Marks Split with real percentages in center
  let staticMarks = 0;
  let dynamicMarks = 0;

  completed.forEach(t => {
    t.questions?.forEach((q, i) => {
      let score = 0;
      if (q.type === 'MCQ') {
        score = Math.max(0, q.score || 0);
      } else {
        const qId = q.id || i.toString();
        score = t.evaluations?.[qId]?.totalScore || 0;
      }
      if (q.sourceTag === 'Dynamic') {
        dynamicMarks += score;
      } else {
        staticMarks += score;
      }
    });
  });

  const totalSplitMarks = staticMarks + dynamicMarks;
  const staticPct = totalSplitMarks > 0 ? Math.round((staticMarks / totalSplitMarks) * 100) : 50;
  const dynamicPct = totalSplitMarks > 0 ? Math.round((dynamicMarks / totalSplitMarks) * 100) : 50;

  const donutData = [
    { name: 'Static Theory', value: Math.max(1, Math.round(staticMarks)), pct: staticPct, color: ACCENT_COLOR },
    { name: 'Dynamic / Current', value: Math.max(1, Math.round(dynamicMarks)), pct: dynamicPct, color: INDIGO_COLOR }
  ];

  // 4. Time Management Bar Chart (last 10 tests)
  const timeData = reversedTests.slice(-10).map((t, idx) => {
    const used = ((t.submittedAt || 0) - (t.startedAt || 0)) / 1000;
    const allotted = t.durationSeconds || 1;
    const pct = Math.min(100, Math.max(0, Math.round((used / allotted) * 100)));
    return {
      name: `T${idx + 1}`,
      percent: pct,
      fill: pct >= 95 ? '#EF4444' : pct >= 80 ? '#F59E0B' : ACCENT_COLOR
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
      
      {/* 1. Score Trend (Filterable by subject) */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)] flex flex-col h-[380px] sm:h-[420px] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Score Trajectory</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exam scores across attempts
            </p>
          </div>

          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="all">All Subjects (Aggregate)</option>
            {subjects.slice(0, 7).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-h-0 relative">
          {trendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
              No completed tests for this filter yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
                <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900/90 text-white backdrop-blur-md border border-white/10 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-teal-300">{data.subject}</p>
                          <p className="font-mono text-sm font-black">{data.score}% Score</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={ACCENT_COLOR}
                  strokeWidth={3.5}
                  dot={{ r: 4, fill: '#fff', stroke: ACCENT_COLOR, strokeWidth: 2.5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. Subject Comparison Radar */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)] flex flex-col h-[380px] sm:h-[420px] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />
        
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Subject Readiness Radar</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cross-disciplinary mastery comparison
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 uppercase">
            360° DIAGNOSTIC
          </span>
        </div>

        <div className="flex-1 min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="rgba(148, 163, 184, 0.25)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: CHART_TEXT, fontSize: 10, fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="p-3 rounded-xl bg-slate-900/90 text-white backdrop-blur-md border border-white/10 shadow-xl text-xs space-y-1">
                        <p className="font-bold text-cyan-300">{d.fullName}</p>
                        <p className="font-mono text-sm font-black">{d.readiness}% Readiness</p>
                        <p className="text-[10px] text-slate-400">{d.testsCount} tests recorded</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Radar
                name="Readiness %"
                dataKey="readiness"
                stroke={CYAN_COLOR}
                fill={CYAN_COLOR}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Static vs Dynamic Marks Donut (With real percentages in center) */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)] flex flex-col h-[360px] sm:h-[400px] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent pointer-events-none" />
        
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Static vs Dynamic Weightage</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribution of marks obtained across theory and circulars
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 uppercase">
            COMPOSITION
          </span>
        </div>

        <div className="flex-1 min-h-0 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={105}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="p-3 rounded-xl bg-slate-900/90 text-white backdrop-blur-md border border-white/10 shadow-xl text-xs space-y-1">
                        <p className="font-bold" style={{ color: d.color }}>{d.name}</p>
                        <p className="font-mono text-sm font-black">{d.pct}% ({d.value} marks)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Percentage Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white leading-none">
              {staticPct}%
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
              Static Theory
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs font-semibold">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ACCENT_COLOR }} />
            <span>Static Theory ({staticPct}%)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: INDIGO_COLOR }} />
            <span>Dynamic Circulars ({dynamicPct}%)</span>
          </div>
        </div>
      </div>

      {/* 4. Time Management Bars */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)] flex flex-col h-[360px] sm:h-[400px] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />
        
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Time Consumption Efficiency</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Allotted duration utilized per mock attempt
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 uppercase">
            PACING
          </span>
        </div>

        <div className="flex-1 min-h-0 relative">
          {timeData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
              No test timing data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
                <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900/90 text-white backdrop-blur-md border border-white/10 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-amber-300">Attempt {d.name}</p>
                          <p className="font-mono text-sm font-black">{d.percent}% of time used</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="percent" radius={[6, 6, 0, 0]} barSize={26}>
                  {timeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-white/5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Optimal (&lt;80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate (80-95%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Time Strain (&gt;95%)
          </span>
        </div>
      </div>

    </div>
  );
}
