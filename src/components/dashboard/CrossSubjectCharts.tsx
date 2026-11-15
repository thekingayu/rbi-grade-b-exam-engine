import React, { useState } from 'react';
import { Subject, TestAttempt } from '../../types';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Activity, Clock } from 'lucide-react';
import { MotionStaggerGrid, MotionStaggerItem } from '../MotionPrimitives';

interface CrossSubjectChartsProps {
  subjects: Subject[];
  tests: TestAttempt[];
}

const ACCENT_COLOR = '#0D47FF';
const LAVENDER_COLOR = '#9D4EDD';
const SIGNAL_YELLOW = '#FFD426';
const CHART_TEXT = '#66665E';

export function CrossSubjectCharts({ subjects, tests }: CrossSubjectChartsProps) {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const completed = tests.filter(t => t.status === 'completed');
  const reversedTests = [...completed].reverse();

  // 1. Score Trend Data
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
      subject: s.name.length > 11 ? s.name.substring(0, 9) + '…' : s.name,
      fullName: s.name,
      readiness: avg > 0 ? avg : 20,
      testsCount: sTests.length
    };
  });

  // 3. Static vs Dynamic Marks Split
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
    { name: 'Dynamic / Current', value: Math.max(1, Math.round(dynamicMarks)), pct: dynamicPct, color: '#ECD5FF' }
  ];

  // 4. Time Management Bar Chart
  const timeData = reversedTests.slice(-10).map((t, idx) => {
    const used = ((t.submittedAt || 0) - (t.startedAt || 0)) / 1000;
    const allotted = t.durationSeconds || 1;
    const pct = Math.min(100, Math.max(0, Math.round((used / allotted) * 100)));
    return {
      name: `T${idx + 1}`,
      percent: pct,
      fill: pct >= 95 ? '#EF4444' : pct >= 80 ? SIGNAL_YELLOW : ACCENT_COLOR
    };
  });

  return (
    <MotionStaggerGrid className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
      
      {/* 1. Score Trend */}
      <MotionStaggerItem className="relative bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 transition-colors rounded-2xl p-4 sm:p-6 flex flex-col h-[300px] sm:h-[400px] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
              <span>Score Trajectory</span>
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
              Exam scores across attempts
            </p>
          </div>

          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 min-h-[38px] rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] cursor-pointer"
          >
            <option value="all">All Subjects (Aggregate)</option>
            {subjects.slice(0, 7).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-h-0 relative">
          {trendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
              No completed tests for this filter yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 143, 128, 0.2)" vertical={false} />
                <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-[#141413] text-[#FAF8EC] border border-[#2E2E2A] shadow-md text-xs space-y-1">
                          <p className="font-bold text-[#ECD5FF]">{data.subject}</p>
                          <p className="font-mono text-sm font-black tabular-nums">{data.score}% Score</p>
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
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#FFFFFF', stroke: ACCENT_COLOR, strokeWidth: 2.5 }}
                  activeDot={{ r: 7, fill: '#FFD426', stroke: '#141413', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </MotionStaggerItem>

      {/* 2. Subject Comparison Radar */}
      <MotionStaggerItem className="relative bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 transition-colors rounded-2xl p-4 sm:p-6 flex flex-col h-[300px] sm:h-[400px] overflow-hidden">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
              <span>Subject Readiness Radar</span>
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
              Cross-disciplinary mastery comparison
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#66665E] dark:text-[#A3A399] uppercase tracking-widest shrink-0">
            360° DIAGNOSTIC
          </span>
        </div>

        <div className="flex-1 min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="68%">
              <PolarGrid stroke="rgba(148, 143, 128, 0.25)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: CHART_TEXT, fontSize: 10, fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="p-3 rounded-xl bg-[#141413] text-[#FAF8EC] border border-[#2E2E2A] shadow-md text-xs space-y-1">
                        <p className="font-bold text-[#ECD5FF]">{d.fullName}</p>
                        <p className="font-mono text-sm font-black tabular-nums">{d.readiness}% Readiness</p>
                        <p className="text-[10px] text-[#A3A399]">{d.testsCount} tests recorded</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Radar
                name="Readiness %"
                dataKey="readiness"
                stroke={ACCENT_COLOR}
                fill={LAVENDER_COLOR}
                fillOpacity={0.28}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </MotionStaggerItem>

      {/* 3. Static vs Dynamic Marks Donut */}
      <MotionStaggerItem className="relative bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 transition-colors rounded-2xl p-4 sm:p-6 flex flex-col h-[320px] sm:h-[400px] overflow-hidden">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
              <span>Static vs Dynamic Weightage</span>
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
              Distribution across core theory and current circulars
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#66665E] dark:text-[#A3A399] uppercase tracking-widest shrink-0">
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
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={4}
                dataKey="value"
                stroke="#141413"
                strokeWidth={1.5}
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
                      <div className="p-3 rounded-xl bg-[#141413] text-[#FAF8EC] border border-[#2E2E2A] shadow-md text-xs space-y-1">
                        <p className="font-bold text-[#ECD5FF]">{d.name}</p>
                        <p className="font-mono text-sm font-black tabular-nums">{d.pct}% ({d.value} marks)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-xl sm:text-3xl font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC] leading-none">
              {staticPct}%
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] mt-1">
              Static Theory
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-2 pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-semibold">
          <div className="flex items-center gap-2 text-[#141413] dark:text-[#FAF8EC]">
            <span className="w-3 h-3 rounded-sm border border-[#141413]" style={{ backgroundColor: ACCENT_COLOR }} />
            <span>Static Theory ({staticPct}%)</span>
          </div>
          <div className="flex items-center gap-2 text-[#141413] dark:text-[#FAF8EC]">
            <span className="w-3 h-3 rounded-sm border border-[#141413]" style={{ backgroundColor: '#ECD5FF' }} />
            <span>Dynamic Circulars ({dynamicPct}%)</span>
          </div>
        </div>
      </MotionStaggerItem>

      {/* 4. Time Management Bars */}
      <MotionStaggerItem className="relative bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 transition-colors rounded-2xl p-4 sm:p-6 flex flex-col h-[320px] sm:h-[400px] overflow-hidden">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
              <span>Time Consumption Efficiency</span>
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
              Allotted duration utilized per mock attempt
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#66665E] dark:text-[#A3A399] uppercase tracking-widest shrink-0">
            PACING
          </span>
        </div>

        <div className="flex-1 min-h-0 relative">
          {timeData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
              No test timing data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 143, 128, 0.2)" vertical={false} />
                <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={CHART_TEXT} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-[#141413] text-[#FAF8EC] border border-[#2E2E2A] shadow-md text-xs space-y-1">
                          <p className="font-bold text-[#FFD426]">Attempt {d.name}</p>
                          <p className="font-mono text-sm font-black tabular-nums">{d.percent}% of time used</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="percent" radius={[6, 6, 0, 0]} barSize={24}>
                  {timeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-2 text-[11px] font-medium text-[#66665E] dark:text-[#A3A399] pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#0D47FF] border border-[#141413]" /> Optimal (&lt;80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#FFD426] border border-[#141413]" /> Moderate (80-95%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 border border-[#141413]" /> Time Strain (&gt;95%)
          </span>
        </div>
      </MotionStaggerItem>

    </MotionStaggerGrid>
  );
}
