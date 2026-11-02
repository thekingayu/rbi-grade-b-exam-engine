import React from 'react';
import { Link } from 'react-router-dom';
import { Subject, TestAttempt } from '../../types';
import { SubjectIcon } from './SubjectIcon';
import { ReadinessRing } from './ReadinessRing';
import { ArrowUpRight, Clock, Award, FileQuestion, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SubjectCardProps {
  key?: React.Key;
  subject: Subject;
  tests: TestAttempt[];
}

export function SubjectCard({ subject, tests }: SubjectCardProps) {
  // Filter attempts belonging to this subject
  const subjectTests = tests.filter(t => 
    t.subjectId === subject.id || 
    t.subjectSlug === subject.slug ||
    // For legacy tests where subjectId is not set, map based on config or unassigned
    (!t.subjectId && subject.slug === 'uncategorized')
  );

  const completedTests = subjectTests.filter(t => t.status === 'completed');
  const testsCount = completedTests.length;

  // Calculate scores
  const scores = completedTests.map(t => {
    const totalMax = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 0;
    return totalMax > 0 ? Math.round(((t.totalScore || 0) / totalMax) * 100) : 0;
  });

  const avgScore = testsCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / testsCount) : 0;

  // Compute readiness score (weighted: avg score 50%, consistency/recent tests 30%, test volume 20%)
  const volumeFactor = Math.min(100, testsCount * 20); // 5 tests = 100% volume
  const recentScore = scores.length > 0 ? scores[0] : 0;
  const readiness = testsCount === 0 ? 0 : Math.round(
    avgScore * 0.5 + recentScore * 0.3 + volumeFactor * 0.2
  );

  // Weakest topic calculation
  const topicStats: Record<string, { total: number; correct: number }> = {};
  completedTests.forEach(t => {
    t.questions?.forEach(q => {
      const topic = q.topic || 'General Core';
      if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
      topicStats[topic].total += 1;
      if (q.type === 'MCQ' && q.score && q.score > 0) {
        topicStats[topic].correct += 1;
      } else if (q.type === 'Descriptive') {
        const evalScore = t.evaluations?.[q.id || '']?.totalScore || 0;
        if (evalScore >= (q.maxMarks || 15) * 0.5) topicStats[topic].correct += 1;
      }
    });
  });

  let weakestTopic = 'Syllabus Core';
  let lowestAcc = 101;
  Object.entries(topicStats).forEach(([t, stat]) => {
    if (stat.total >= 2) {
      const acc = (stat.correct / stat.total) * 100;
      if (acc < lowestAcc) {
        lowestAcc = acc;
        weakestTopic = t;
      }
    }
  });

  // Last attempt date
  const lastAttempt = completedTests.length > 0 ? completedTests[0].submittedAt || completedTests[0].createdAt : null;

  // Mini sparkline points (normalized to 100x26 viewBox)
  const sparklineData = scores.slice(0, 7).reverse();
  const sparklinePoints = sparklineData.length > 1
    ? sparklineData.map((s, idx) => {
        const x = (idx / (sparklineData.length - 1)) * 96 + 2;
        const y = 24 - (s / 100) * 20;
        return `${x},${y}`;
      }).join(' ')
    : '';

  return (
    <Link
      to={`/subject/${subject.slug}`}
      className="group relative flex flex-col justify-between bg-white/75 dark:bg-[#070B19]/80 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-white/10 shadow-lg shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(0,0,0,0.6)] hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden cursor-pointer"
      style={{
        borderColor: `color-mix(in srgb, ${subject.accentColor} 20%, transparent)`
      }}
    >
      {/* Dynamic colored accent bar & corner ambient glow on hover */}
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 opacity-80 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(90deg, ${subject.accentColor}, color-mix(in srgb, ${subject.accentColor} 40%, white))`
        }}
      />
      <div 
        className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl opacity-0 group-hover:opacity-25 transition-opacity pointer-events-none"
        style={{ backgroundColor: subject.accentColor }}
      />

      {/* Top Header Row */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105"
              style={{
                backgroundColor: `color-mix(in srgb, ${subject.accentColor} 14%, transparent)`,
                borderColor: `color-mix(in srgb, ${subject.accentColor} 30%, transparent)`,
                color: subject.accentColor
              }}
            >
              <SubjectIcon name={subject.icon} className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                  {subject.phase}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {subject.totalMarks} Marks · {subject.durationMinutes}m
                </span>
              </div>
              <h3 className="font-serif font-black text-lg sm:text-xl text-slate-900 dark:text-white mt-1 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors line-clamp-1">
                {subject.name}
              </h3>
            </div>
          </div>

          {/* Readiness Ring */}
          <ReadinessRing 
            score={readiness} 
            color={subject.accentColor} 
            size={58} 
            strokeWidth={5} 
          />
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-4 leading-relaxed font-normal">
          {subject.description}
        </p>
      </div>

      {/* Metric Middle Row */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
              Attempts
            </span>
            <span className="text-lg font-serif font-black text-slate-900 dark:text-white">
              {testsCount} <span className="text-xs font-normal text-slate-400">tests</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
              Avg. Score
            </span>
            <span className="text-lg font-serif font-black text-slate-900 dark:text-white">
              {testsCount > 0 ? `${avgScore}%` : '—'}
            </span>
          </div>
        </div>

        {/* Trend Sparkline if >= 2 tests */}
        {sparklinePoints && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Recent Trend
            </span>
            <svg className="w-24 h-6 overflow-visible" viewBox="0 0 100 26">
              <polyline
                fill="none"
                stroke={subject.accentColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          </div>
        )}

        {/* Weakest Topic & Last Attempt */}
        <div className="flex flex-col gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Priority Topic:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={weakestTopic}>
              {weakestTopic}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <span>Last Attempt:</span>
            <span>{lastAttempt ? formatDistanceToNow(lastAttempt, { addSuffix: true }) : 'Never attempted'}</span>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-500" />
          <span>Open Dashboard</span>
        </span>
        <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/5 group-hover:bg-teal-500 group-hover:text-white flex items-center justify-center transition-all">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
