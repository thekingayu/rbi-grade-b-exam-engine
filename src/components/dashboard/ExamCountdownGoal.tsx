import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSubject } from '../../context/SubjectContext';
import { Calendar, Target, Edit2, Check } from 'lucide-react';
import { calculateDaysRemaining } from '../../utils/date';
import { AnimatedNumber, EASE_OUT_EXPO } from '../MotionPrimitives';

export function ExamCountdownGoal({ currentAvgScore }: { currentAvgScore: number }) {
  const { targetExamDate, setTargetExamDate, targetScoreGoal, setTargetScoreGoal } = useSubject();
  const [isEditing, setIsEditing] = useState(false);
  const [tempDate, setTempDate] = useState(targetExamDate);
  const [tempGoal, setTempGoal] = useState(targetScoreGoal);

  useEffect(() => {
    setTempDate(targetExamDate);
  }, [targetExamDate]);

  useEffect(() => {
    setTempGoal(targetScoreGoal);
  }, [targetScoreGoal]);

  const daysRemaining = calculateDaysRemaining(targetExamDate);
  const scoreGap = targetScoreGoal - currentAvgScore;

  const handleSave = () => {
    setTargetExamDate(tempDate);
    setTargetScoreGoal(tempGoal);
    setIsEditing(false);
  };

  return (
    <div className="ink-card-featured rounded-2xl p-4 sm:p-5 flex flex-col gap-4 bg-[#FFFFFF] dark:bg-[#1C1C1A]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Days Remaining */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0D47FF] text-white border-[1.5px] border-[#141413] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF] font-bold">
                TARGET EXAM COUNTDOWN
              </span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsEditing(!isEditing)}
                className="text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] transition-colors cursor-pointer p-1.5 rounded"
                title="Edit target date & goal"
                aria-label="Edit target date & cutoff goal"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </motion.button>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                <AnimatedNumber value={daysRemaining} />
              </span>
              <span className="text-xs font-semibold text-[#55554F] dark:text-[#A3A399]">
                Days to RBI Grade B ({targetExamDate})
              </span>
            </div>
          </div>
        </div>

        {/* Target Cutoff Score Goal Tracker */}
        <div className="flex items-center gap-3.5 border-t md:border-t-0 md:border-l border-[#E5E1CE] dark:border-[#2E2E2A] pt-3 md:pt-0 md:pl-5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#ECD5FF] text-[#141413] border-[1.5px] border-[#141413] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#66665E] dark:text-[#A3A399] block mb-0.5 font-bold">
              CUTOFF SCORE BENCHMARK
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base sm:text-lg font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                <AnimatedNumber value={targetScoreGoal} suffix="%" /> Target
              </span>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border-[1.5px] border-[#141413] ${
                  scoreGap <= 0
                    ? 'bg-emerald-400 text-[#141413]'
                    : 'bg-[#FFD426] text-[#141413]'
                }`}
              >
                {scoreGap <= 0 ? 'Goal Surpassed' : `${scoreGap}% Gap to close`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Edit Form Tray with smooth AnimatePresence expand */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
            className="w-full overflow-hidden"
          >
            <div className="w-full pt-3.5 border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC]">Target Date:</span>
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  className="text-xs font-mono px-2.5 py-2 min-h-[38px] rounded-lg border-[1.5px] border-[#141413]/30 dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] dark:[color-scheme:dark] focus:outline-none focus:border-[#0D47FF]"
                />
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC]">Cutoff Goal (%):</span>
                <input
                  type="number"
                  min="40"
                  max="99"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(parseInt(e.target.value, 10) || 75)}
                  className="w-24 text-xs font-mono px-2.5 py-2 min-h-[38px] rounded-lg border-[1.5px] border-[#141413]/30 dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 sm:pt-0">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSave}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] rounded-lg bg-[#0D47FF] text-white text-xs font-bold hover:bg-[#0936CC] transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Preferences
                </motion.button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 sm:flex-initial px-3.5 py-2 min-h-[38px] rounded-lg border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#55554F] dark:text-[#A3A399] text-xs font-semibold hover:bg-[#F3F0E0] dark:hover:bg-[#242421] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
