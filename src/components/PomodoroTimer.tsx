import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Clock, Flame } from 'lucide-react';

export function PomodoroTimer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (mode === 'focus') {
        setNotification("Focus session complete! Time for a 5-minute restorative break.");
        setMode('break');
        setTimeLeft(5 * 60);
      } else {
        setNotification("Break ended! Ready to resume deep focus?");
        setMode('focus');
        setTimeLeft(25 * 60);
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const resetTimer = () => {
    setIsRunning(false);
    setNotification(null);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  return (
    <div className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 left-3 sm:left-auto sm:w-72 z-50 animate-in fade-in zoom-in-95">
      <div className="w-full rounded-2xl bg-white/95 dark:bg-[#070B19]/95 backdrop-blur-2xl border border-teal-500/30 dark:border-teal-500/20 shadow-2xl p-4 text-slate-900 dark:text-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="font-serif font-bold text-xs uppercase tracking-wider">
              {mode === 'focus' ? 'Focus Interval' : 'Restorative Break'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            aria-label="Close timer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {notification && (
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-[11px] font-semibold text-teal-700 dark:text-teal-300 flex items-center justify-between gap-1">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="cursor-pointer text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="text-center py-1">
          <span className="text-4xl font-mono font-black tracking-tight text-teal-600 dark:text-teal-300">
            {formattedTime}
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {mode === 'focus' ? 'Deep Cadre Study' : 'Rest Your Eyes'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              setIsRunning(!isRunning);
              setNotification(null);
            }}
            className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pause' : 'Start'}</span>
          </button>
          <button
            onClick={resetTimer}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Reset interval"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
