import React, { useState } from 'react';
import { useSubject } from '../../context/SubjectContext';
import { Calendar, Target, Edit2, Check, Clock, Sparkles } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';

export function ExamCountdownGoal({ currentAvgScore }: { currentAvgScore: number }) {
  const { targetExamDate, setTargetExamDate, targetScoreGoal, setTargetScoreGoal } = useSubject();
  const [isEditing, setIsEditing] = useState(false);
  const [tempDate, setTempDate] = useState(targetExamDate);
  const [tempGoal, setTempGoal] = useState(targetScoreGoal);

  let daysRemaining = 0;
  try {
    const target = parseISO(targetExamDate);
    daysRemaining = Math.max(0, differenceInDays(target, new Date()));
  } catch (e) {
    daysRemaining = 120;
  }

  const scoreGap = targetScoreGoal - currentAvgScore;

  const handleSave = () => {
    setTargetExamDate(tempDate);
    setTargetScoreGoal(tempGoal);
    setIsEditing(false);
  };

  return (
    <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg shadow-slate-200/30 dark:shadow-[0_0_25px_-5px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between gap-4">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent pointer-events-none" />

      {/* Days Remaining Pill */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white flex items-center justify-center font-black shadow-md shadow-teal-500/25 shrink-0">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-teal-700 dark:text-teal-300 font-bold">
              TARGET EXAM COUNTDOWN
            </span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Edit target date & goal"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white">
              {daysRemaining}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Days to RBI Grade B 2026 ({targetExamDate})
            </span>
          </div>
        </div>
      </div>

      {/* Target Cutoff Score Goal Tracker */}
      <div className="flex items-center gap-4 sm:border-l sm:border-slate-200 dark:sm:border-white/10 sm:pl-5">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 flex items-center justify-center shrink-0">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
            CUTOFF SCORE BENCHMARK
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-serif font-black text-slate-900 dark:text-white">
              {targetScoreGoal}% Target
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              scoreGap <= 0 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
            }`}>
              {scoreGap <= 0 ? 'Goal Surpassed! 🎉' : `${scoreGap}% Gap to close`}
            </span>
          </div>
        </div>
      </div>

      {/* Inline Edit Form Modal / Tray */}
      {isEditing && (
        <div className="w-full mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Exam Date:</span>
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              className="text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cutoff Goal (%):</span>
            <input
              type="number"
              min="40"
              max="99"
              value={tempGoal}
              onChange={(e) => setTempGoal(parseInt(e.target.value, 10) || 75)}
              className="w-20 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-500 transition-colors cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            Save Preferences
          </button>
        </div>
      )}
    </div>
  );
}
