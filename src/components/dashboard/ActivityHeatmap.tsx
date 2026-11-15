import React from 'react';
import { motion } from 'motion/react';
import { TestAttempt } from '../../types';
import { format, subDays, isSameDay } from 'date-fns';
import { MotionSection, EASE_OUT_EXPO } from '../MotionPrimitives';

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

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-[#F3F0E0] dark:bg-[#242421] border-[#E5E1CE] dark:border-[#2E2E2A]';
    if (count === 1) return 'bg-[#ECD5FF] border-[#141413]/40';
    if (count === 2) return 'bg-[#FFD426] border-[#141413]';
    return 'bg-[#0D47FF] border-[#141413]';
  };

  return (
    <MotionSection className="relative bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-5 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-heading font-bold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC]">
              Cadre Activity Heatmap
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
              · 12 WEEKS
            </span>
          </div>
          <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-0.5">
            Consistency tracking across all Phase 1 & Phase 2 preparation cycles.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFD426] border-[1.5px] border-[#141413] text-xs font-bold text-[#141413] tabular-nums">
            <span>{streakDays} Day Study Streak</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pb-2 no-scrollbar">
        <div className="min-w-[520px]">
          <div className="grid grid-flow-col grid-rows-7 gap-1.5 sm:gap-2">
            {days.map((d, index) => {
              const colIndex = Math.floor(index / 7);
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.65 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{
                    duration: 0.25,
                    delay: colIndex * 0.025,
                    ease: EASE_OUT_EXPO
                  }}
                  title={`${format(d.date, 'EEEE, MMM d, yyyy')}: ${d.count} exam${d.count === 1 ? '' : 's'} (${d.hours} hrs)`}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] border transition-transform duration-150 hover:scale-125 cursor-pointer ${getIntensityClass(d.count)}`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
            <span>12 weeks ago</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A]" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[#ECD5FF] border border-[#141413]/40" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[#FFD426] border border-[#141413]" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[#0D47FF] border border-[#141413]" />
              <span>More</span>
            </div>
            <span>Today</span>
          </div>
        </div>
      </div>
    </MotionSection>
  );
}
