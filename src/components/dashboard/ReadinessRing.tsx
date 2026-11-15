import React from 'react';
import { motion } from 'motion/react';
import { EASE_OUT_EXPO, AnimatedNumber } from '../MotionPrimitives';

interface ReadinessRingProps {
  score: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export function ReadinessRing({
  score,
  size = 68,
  strokeWidth = 6,
  color = '#0D9488',
  label = 'Readiness'
}: ReadinessRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.min(100, Math.max(0, Math.round(score)));
  const offset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-[#E5E1CE] dark:stroke-[#2E2E2A]"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Crisp Progress Arc animating smoothly on entry */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 1.25, ease: EASE_OUT_EXPO }}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <span className="text-xs sm:text-sm font-black font-mono tabular-nums tracking-tight text-[#141413] dark:text-[#FAF8EC] leading-none">
          <AnimatedNumber value={safeScore} suffix="%" />
        </span>
        {size >= 64 && (
          <span className="text-[8px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] scale-90">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
