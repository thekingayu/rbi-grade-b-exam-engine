import React from 'react';

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
          className="stroke-slate-200/70 dark:stroke-white/10"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Dynamic Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            filter: `drop-shadow(0 0 6px ${color}66)`
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <span className="text-xs sm:text-sm font-bold font-mono tracking-tight text-slate-900 dark:text-white leading-none">
          {safeScore}%
        </span>
        {size >= 64 && (
          <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 scale-90">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
