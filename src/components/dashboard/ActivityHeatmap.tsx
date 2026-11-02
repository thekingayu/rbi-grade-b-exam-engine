import React from 'react';
import { TestAttempt } from '../../types';
import { format, subDays, startOfWeek, addDays, isSameDay } from 'date-fns';

interface ActivityHeatmapProps {
  tests: TestAttempt[];
  streakDays: number;
}

export function ActivityHeatmap({ tests, streakDays }: ActivityHeatmapProps) {
  // Generate days for the last 12 weeks (84 days) ending today
  const today = new Date();
  const weeksCount = 12;
  const days: { date: Date; count: number; hours: number }[] = [];

  const completed = tests.filter(t => t.status === 'completed');

  for (let i = weeksCount * 7 - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const dayTests = completed.filter(t => {
      const tDate = new Date(t.submittedAt || t.createdAt);
      return isSameDay(tDate, d);
    });
    const hours = dayTests.reduce((sum, t) => sum + (t.durationSeconds || 1800) / 3600, 0);
    days.push({
      date: d,
      count: dayTests.length,
      hours: Number(hours.toFixed(1))
    });
  }

  // Split into 7 rows (days of week) and 12 columns
  const dayNames = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-slate-200/60 dark:bg-white/[0.05] border-slate-300/40 dark:border-white/5';
    if (count === 1) return 'bg-teal-500/40 text-teal-900 border-teal-500/50 shadow-[0_0_6px_rgba(13,148,136,0.2)]';
    if (count === 2) return 'bg-teal-500/70 text-white border-teal-500/80 shadow-[0_0_8px_rgba(13,148,136,0.35)]';
    return 'bg-teal-500 text-white border-teal-400 shadow-[0_0_12px_rgba(13,148,136,0.5)]';
  };

  return (
    <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span>Cadre Activity Heatmap</span>
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25">
              12 WEEKS
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consistency tracking across all Phase 1 & Phase 2 preparation cycles.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 dark:bg-teal-500/15 border border-teal-500/30 text-xs font-bold text-teal-700 dark:text-teal-300">
            <span className="text-base">🔥</span>
            <span>{streakDays} Day Study Streak</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pb-2 scrollbar-none">
        <div className="min-w-[560px]">
          <div className="grid grid-flow-col grid-rows-7 gap-1.5 sm:gap-2">
            {days.map((d, index) => (
              <div
                key={index}
                title={`${format(d.date, 'EEEE, MMM d, yyyy')}: ${d.count} exam${d.count === 1 ? '' : 's'} (${d.hours} hrs)`}
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border transition-all duration-200 hover:scale-125 cursor-pointer relative group ${getIntensityClass(d.count)}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-slate-400 dark:text-slate-500">
            <span>12 weeks ago</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 dark:bg-white/5 border border-slate-300/30" />
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-500/40" />
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-500/70" />
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-500" />
              <span>More</span>
            </div>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
