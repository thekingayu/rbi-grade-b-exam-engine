import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, X, Clock, Minimize2, Maximize2 } from 'lucide-react';
import { SPRING_BOUNCY, SPRING_TACTILE } from './MotionPrimitives';

export function PomodoroTimer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (mode === 'focus') {
        setNotification('Focus done! 5m break ready.');
        setMode('break');
        setTimeLeft(5 * 60);
      } else {
        setNotification('Break ended! Ready to resume?');
        setMode('focus');
        setTimeLeft(25 * 60);
      }
      setIsMinimized(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  const totalDuration = mode === 'focus' ? 25 * 60 : 5 * 60;
  const elapsedFraction = Math.min(1, Math.max(0, (totalDuration - timeLeft) / totalDuration));

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const switchMode = (nextMode: 'focus' | 'break') => {
    setMode(nextMode);
    setIsRunning(false);
    setNotification(null);
    setTimeLeft(nextMode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setNotification(null);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 22, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.86 }}
          transition={{
            ...SPRING_BOUNCY,
            opacity: { duration: 0.18 },
          }}
          className="fixed bottom-[74px] right-3 sm:bottom-20 sm:right-6 z-50 origin-bottom-right will-change-transform"
        >
          {isMinimized ? (
            <motion.div
              layout
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#141413] dark:bg-[#1C1C1A] text-[#FAF8EC] border-[1.5px] border-[#141413] dark:border-[#ECD5FF]/80 shadow-[3px_3px_0px_#0D47FF] dark:shadow-[3px_3px_0px_#ECD5FF]"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isRunning
                    ? 'bg-emerald-400 animate-pulse'
                    : mode === 'focus'
                      ? 'bg-[#FFD426]'
                      : 'bg-[#ECD5FF]'
                }`}
              />
              <span className="font-mono font-black text-xs tabular-nums tracking-tight">
                {formattedTime}
              </span>
              <motion.button
                whileTap={{ scale: 0.86 }}
                transition={SPRING_TACTILE}
                onClick={() => {
                  setIsRunning(!isRunning);
                  setNotification(null);
                }}
                className="w-6 h-6 rounded-full bg-[#0D47FF] text-white flex items-center justify-center cursor-pointer shrink-0"
                title={isRunning ? 'Pause timer' : 'Start timer'}
                aria-label={isRunning ? 'Pause timer' : 'Start timer'}
              >
                {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.86 }}
                transition={SPRING_TACTILE}
                onClick={() => setIsMinimized(false)}
                className="p-1 rounded-full text-[#A3A399] hover:text-white cursor-pointer shrink-0"
                title="Expand timer"
                aria-label="Expand timer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.86 }}
                transition={SPRING_TACTILE}
                onClick={onClose}
                className="p-1 rounded-full text-[#A3A399] hover:text-rose-400 cursor-pointer shrink-0"
                title="Close timer"
                aria-label="Close timer"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          ) : (
            <div className="w-[224px] sm:w-72 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/80 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-3 sm:p-4 text-[#141413] dark:text-[#FAF8EC] space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className={`w-3.5 h-3.5 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0 ${isRunning ? 'animate-pulse' : ''}`} />
                  <div className="inline-flex rounded-md bg-[#F3F0E0] dark:bg-[#141413] p-0.5 border border-[#E5E1CE] dark:border-[#2E2E2A]">
                    <button
                      type="button"
                      onClick={() => switchMode('focus')}
                      className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold uppercase cursor-pointer transition-colors ${
                        mode === 'focus'
                          ? 'bg-[#141413] dark:bg-[#ECD5FF] text-white dark:text-[#141413]'
                          : 'text-[#66665E] dark:text-[#A3A399]'
                      }`}
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('break')}
                      className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold uppercase cursor-pointer transition-colors ${
                        mode === 'break'
                          ? 'bg-[#141413] dark:bg-[#ECD5FF] text-white dark:text-[#141413]'
                          : 'text-[#66665E] dark:text-[#A3A399]'
                      }`}
                    >
                      Break
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setIsMinimized(true)}
                    className="p-1 rounded-lg text-[#66665E] hover:text-[#141413] dark:hover:text-white cursor-pointer"
                    title="Minimize to pill"
                    aria-label="Minimize timer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={onClose}
                    className="p-1 rounded-lg text-[#66665E] hover:text-[#141413] dark:hover:text-white cursor-pointer"
                    title="Close timer"
                    aria-label="Close timer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>

              <AnimatePresence>
                {notification && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-1.5 sm:p-2 rounded-lg bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[10px] sm:text-[11px] font-semibold flex items-center justify-between gap-1 overflow-hidden"
                  >
                    <span>{notification}</span>
                    <button onClick={() => setNotification(null)} className="cursor-pointer shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-baseline justify-between sm:block sm:text-center py-0.5">
                <span className="text-2xl sm:text-4xl font-mono font-black tracking-tight tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                  {formattedTime}
                </span>
                <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] sm:mt-0.5">
                  {mode === 'focus' ? 'Deep Study' : 'Eye Rest'}
                </p>
              </div>

              {/* Smooth GPU progress rule */}
              <div className="h-1.5 w-full rounded-full bg-[#F3F0E0] dark:bg-[#242421] overflow-hidden border border-[#E5E1CE] dark:border-[#2E2E2A]">
                <div
                  className="h-full w-full bg-[#0D47FF] dark:bg-[#ECD5FF] origin-left transition-transform duration-700 ease-out"
                  style={{ transform: `scaleX(${elapsedFraction})` }}
                />
              </div>

              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.93 }}
                  transition={SPRING_TACTILE}
                  onClick={() => {
                    setIsRunning(!isRunning);
                    setNotification(null);
                  }}
                  className="flex-1 py-1.5 sm:py-2.5 rounded-xl bg-[#0D47FF] hover:bg-[#1954FF] text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isRunning ? <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                  <span>{isRunning ? 'Pause' : 'Start'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ rotate: -15 }}
                  whileTap={{ scale: 0.88, rotate: -65 }}
                  transition={SPRING_TACTILE}
                  onClick={resetTimer}
                  className="p-1.5 sm:p-2.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] cursor-pointer"
                  title="Reset interval"
                  aria-label="Reset interval"
                >
                  <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
