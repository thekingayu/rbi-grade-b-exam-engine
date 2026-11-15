import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, X, Clock } from 'lucide-react';
import { SPRING_SNAPPY } from './MotionPrimitives';

export function PomodoroTimer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (mode === 'focus') {
        setNotification('Focus session complete! Take a 5-minute restorative break.');
        setMode('break');
        setTimeLeft(5 * 60);
      } else {
        setNotification('Break ended! Ready to resume focused study?');
        setMode('focus');
        setTimeLeft(25 * 60);
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  const totalDuration = mode === 'focus' ? 25 * 60 : 5 * 60;
  const elapsedFraction = Math.min(1, Math.max(0, (totalDuration - timeLeft) / totalDuration));

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const resetTimer = () => {
    setIsRunning(false);
    setNotification(null);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.94 }}
          transition={SPRING_SNAPPY}
          className="fixed bottom-20 right-3 sm:bottom-20 sm:right-6 left-3 sm:left-auto sm:w-72 z-50 origin-bottom-right"
        >
          <div className="w-full rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/80 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-4 text-[#141413] dark:text-[#FAF8EC] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] ${isRunning ? 'animate-pulse' : ''}`} />
                <span className="font-mono font-bold text-xs uppercase tracking-wider">
                  {mode === 'focus' ? 'Focus Interval' : 'Break Interval'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#66665E] hover:text-[#141413] dark:hover:text-white cursor-pointer"
                aria-label="Close timer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <AnimatePresence>
              {notification && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-2 rounded-lg bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[11px] font-semibold flex items-center justify-between gap-1 overflow-hidden"
                >
                  <span>{notification}</span>
                  <button onClick={() => setNotification(null)} className="cursor-pointer shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center py-1">
              <span className="text-4xl font-mono font-black tracking-tight tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                {formattedTime}
              </span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] mt-0.5">
                {mode === 'focus' ? 'Deep Cadre Study' : 'Rest Your Eyes'}
              </p>
            </div>

            {/* Smooth GPU progress rule */}
            <div className="h-1.5 w-full rounded-full bg-[#F3F0E0] dark:bg-[#242421] overflow-hidden border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <div
                className="h-full w-full bg-[#0D47FF] dark:bg-[#ECD5FF] origin-left transition-transform duration-700 ease-out"
                style={{ transform: `scaleX(${elapsedFraction})` }}
              />
            </div>

            <div className="flex items-center justify-center gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setIsRunning(!isRunning);
                  setNotification(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0D47FF] hover:bg-[#1954FF] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRunning ? 'Pause' : 'Start'}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92, rotate: -35 }}
                onClick={resetTimer}
                className="p-2.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] cursor-pointer"
                title="Reset interval"
                aria-label="Reset interval"
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
