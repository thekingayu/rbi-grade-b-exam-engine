import React from 'react';
import { motion } from 'motion/react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

export interface FuturisticSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'teal' | 'cyan' | 'indigo' | 'white' | 'gold' | 'cobalt';
  className?: string;
  label?: string;
}

export function FuturisticSpinner({
  size = 'md',
  color = 'cobalt',
  className = '',
  label
}: FuturisticSpinnerProps) {
  const sizeMap = {
    xs: 16,
    sm: 20,
    md: 32,
    lg: 48,
    xl: 60
  };

  const px = sizeMap[size];

  const colorThemes = {
    teal: { primary: '#0D47FF', secondary: '#ECD5FF', ringBg: 'rgba(13, 71, 255, 0.14)' },
    cyan: { primary: '#0D47FF', secondary: '#ECD5FF', ringBg: 'rgba(13, 71, 255, 0.14)' },
    indigo: { primary: '#0D47FF', secondary: '#ECD5FF', ringBg: 'rgba(13, 71, 255, 0.14)' },
    cobalt: { primary: '#0D47FF', secondary: '#ECD5FF', ringBg: 'rgba(13, 71, 255, 0.14)' },
    white: { primary: '#FFFFFF', secondary: '#ECD5FF', ringBg: 'rgba(255, 255, 255, 0.2)' },
    gold: { primary: '#FFD426', secondary: '#141413', ringBg: 'rgba(255, 212, 38, 0.2)' }
  };

  const theme = colorThemes[color] || colorThemes.cobalt;

  return (
    <div className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className="relative flex items-center justify-center shrink-0" style={{ width: px, height: px }}>
        <svg viewBox="0 0 48 48" width={px} height={px} className="block">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={theme.ringBg}
            strokeWidth="3"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={theme.primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="68 120"
            className="origin-center animate-[spin_0.9s_linear_infinite]"
          />
          <circle cx="24" cy="24" r="4" fill={theme.secondary} stroke="#141413" strokeWidth="1.5" />
        </svg>
      </div>

      {label && (
        <span className="text-[11px] font-mono tracking-wider uppercase font-bold text-[#66665E] dark:text-[#A3A399]">
          {label}
        </span>
      )}
    </div>
  );
}

export interface FuturisticProgressBarProps {
  progress?: number;
  indeterminate?: boolean;
  className?: string;
  color?: 'teal' | 'cyan' | 'indigo' | 'cobalt';
  height?: number;
  label?: string;
}

export function FuturisticProgressBar({
  progress = 50,
  indeterminate = false,
  className = '',
  height = 6,
  label
}: FuturisticProgressBarProps) {
  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-[11px] font-mono font-bold tracking-wider uppercase text-[#66665E] dark:text-[#A3A399]">
          <span>{label}</span>
          {!indeterminate && <span>{Math.round(progress)}%</span>}
        </div>
      )}

      <div
        className="w-full rounded-full bg-[#F3F0E0] dark:bg-[#242421] overflow-hidden relative border border-[#141413]/20 dark:border-[#FAF8EC]/20 p-0.5"
        style={{ height: height + 4 }}
      >
        {indeterminate ? (
          <div
            className="h-full rounded-full bg-[#0D47FF] dark:bg-[#ECD5FF] w-2/5"
            style={{
              animation: 'indeterminateSlide 1.5s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite'
            }}
          />
        ) : (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.min(1, Math.max(0, progress / 100)) }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            className="h-full w-full origin-left rounded-full bg-[#0D47FF] dark:bg-[#ECD5FF]"
          />
        )}
      </div>
    </div>
  );
}

export interface FuturisticScreenLoaderProps {
  title?: string;
  subtitle?: string;
  color?: 'teal' | 'cyan' | 'indigo' | 'cobalt';
}

export function FuturisticScreenLoader({
  title = 'RBI Grade B Engine',
  subtitle = 'SYNCHRONIZING CADRE WORKSPACE...',
  color = 'cobalt'
}: FuturisticScreenLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
      className="min-h-[60vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.38, ease: EASE_OUT_EXPO }}
        className="relative p-6 sm:p-8 rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/80 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] max-w-sm w-full flex flex-col items-center"
      >
        <FuturisticSpinner size="xl" color={color} />

        <div className="mt-5 space-y-1.5">
          <h3 className="font-heading font-black text-lg text-[#141413] dark:text-[#FAF8EC] tracking-tight">
            {title}
          </h3>
          <p className="text-[11px] font-mono tracking-widest uppercase text-[#66665E] dark:text-[#A3A399] font-bold">
            {subtitle}
          </p>
        </div>

        <div className="w-full mt-6">
          <FuturisticProgressBar indeterminate height={4} />
        </div>
      </motion.div>
    </motion.div>
  );
}
