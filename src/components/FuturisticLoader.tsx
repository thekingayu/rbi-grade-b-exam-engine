import React from 'react';

export interface FuturisticSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'teal' | 'cyan' | 'indigo' | 'white' | 'gold';
  className?: string;
  label?: string;
}

export function FuturisticSpinner({
  size = 'md',
  color = 'teal',
  className = '',
  label
}: FuturisticSpinnerProps) {
  // Dimensions for svg
  const sizeMap = {
    xs: 16,
    sm: 20,
    md: 32,
    lg: 48,
    xl: 64
  };

  const px = sizeMap[size];

  const colorThemes = {
    teal: {
      primary: '#0D9488',
      secondary: '#2DD4BF',
      glow: 'rgba(13, 148, 136, 0.45)',
      ringBg: 'rgba(13, 148, 136, 0.12)'
    },
    cyan: {
      primary: '#06B6D4',
      secondary: '#67E8F9',
      glow: 'rgba(6, 182, 212, 0.45)',
      ringBg: 'rgba(6, 182, 212, 0.12)'
    },
    indigo: {
      primary: '#6366F1',
      secondary: '#A5B4FC',
      glow: 'rgba(99, 102, 241, 0.45)',
      ringBg: 'rgba(99, 102, 241, 0.12)'
    },
    white: {
      primary: '#FFFFFF',
      secondary: '#E2E8F0',
      glow: 'rgba(255, 255, 255, 0.5)',
      ringBg: 'rgba(255, 255, 255, 0.15)'
    },
    gold: {
      primary: '#F59E0B',
      secondary: '#FCD34D',
      glow: 'rgba(245, 158, 11, 0.45)',
      ringBg: 'rgba(245, 158, 11, 0.12)'
    }
  };

  const theme = colorThemes[color];

  return (
    <div className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}>
      <div 
        className="relative flex items-center justify-center shrink-0" 
        style={{ width: px, height: px }}
      >
        {/* Ambient Backlight Glow */}
        <div 
          className="absolute inset-0 rounded-full blur-xs opacity-60 animate-pulse pointer-events-none"
          style={{ background: theme.glow }}
        />

        {/* SVG Orbital Gyroscope */}
        <svg 
          viewBox="0 0 48 48" 
          width={px} 
          height={px} 
          className="relative z-10 block"
        >
          <defs>
            <linearGradient id={`futuristic_grad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.secondary} stopOpacity="1" />
              <stop offset="60%" stopColor={theme.primary} stopOpacity="0.8" />
              <stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`futuristic_grad_inner_${color}`} x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={theme.secondary} stopOpacity="0.9" />
              <stop offset="100%" stopColor={theme.primary} stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Outer Stationary Blueprint Track */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={theme.ringBg}
            strokeWidth="2"
            strokeDasharray="2 3"
          />

          {/* Outer High-Speed Laser Arc */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={`url(#futuristic_grad_${color})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="75 120"
            className="origin-center animate-[spin_1.1s_cubic-bezier(0.4,0,0.2,1)_infinite]"
          />

          {/* Inner Counter-Rotating Gyro Ring */}
          <circle
            cx="24"
            cy="24"
            r="13"
            fill="none"
            stroke={`url(#futuristic_grad_inner_${color})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="40 70"
            className="origin-center animate-[spin_1.8s_linear_infinite_reverse]"
          />

          {/* 4 Cardinal Reticle Crosshair Ticks */}
          <circle cx="24" cy="4" r="1.2" fill={theme.primary} opacity="0.75" />
          <circle cx="44" cy="24" r="1.2" fill={theme.primary} opacity="0.75" />
          <circle cx="24" cy="44" r="1.2" fill={theme.primary} opacity="0.75" />
          <circle cx="4" cy="24" r="1.2" fill={theme.primary} opacity="0.75" />

          {/* Central Quantum Core Node */}
          <circle
            cx="24"
            cy="24"
            r="3.5"
            fill={theme.secondary}
            className="origin-center animate-ping opacity-60"
          />
          <circle
            cx="24"
            cy="24"
            r="2.5"
            fill={theme.primary}
          />
        </svg>
      </div>

      {label && (
        <span className="text-[11px] font-mono tracking-wider uppercase font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}

export interface FuturisticProgressBarProps {
  progress?: number; // 0 to 100
  indeterminate?: boolean;
  className?: string;
  color?: 'teal' | 'cyan' | 'indigo';
  height?: number;
  label?: string;
}

export function FuturisticProgressBar({
  progress = 50,
  indeterminate = false,
  className = '',
  color = 'teal',
  height = 6,
  label
}: FuturisticProgressBarProps) {
  const colorMap = {
    teal: 'from-teal-500 via-cyan-400 to-indigo-500',
    cyan: 'from-cyan-500 via-teal-400 to-blue-500',
    indigo: 'from-indigo-500 via-purple-400 to-teal-400'
  };

  const glowColorMap = {
    teal: 'rgba(13, 148, 136, 0.4)',
    cyan: 'rgba(6, 182, 212, 0.4)',
    indigo: 'rgba(99, 102, 241, 0.4)'
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-[11px] font-mono font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
          <span>{label}</span>
          {!indeterminate && <span>{Math.round(progress)}%</span>}
        </div>
      )}

      <div 
        className="w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden relative backdrop-blur-xs p-0.5 border border-slate-300/40 dark:border-white/10"
        style={{ height: height + 4 }}
      >
        {indeterminate ? (
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${colorMap[color]} animate-[shimmer_1.8s_ease-in-out_infinite] w-2/5 shadow-md`}
            style={{ 
              boxShadow: `0 0 12px ${glowColorMap[color]}`,
              animation: 'indeterminateSlide 1.6s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite'
            }}
          />
        ) : (
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${colorMap[color]} transition-all duration-300 relative`}
            style={{ 
              width: `${Math.min(100, Math.max(0, progress))}%`,
              boxShadow: `0 0 10px ${glowColorMap[color]}`
            }}
          >
            {/* Leading Laser Spark */}
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#ffffff] animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

export interface FuturisticScreenLoaderProps {
  title?: string;
  subtitle?: string;
  color?: 'teal' | 'cyan' | 'indigo';
}

export function FuturisticScreenLoader({
  title = 'RBI Grade B Engine',
  subtitle = 'SYNCHRONIZING CADRE WORKSPACE...',
  color = 'teal'
}: FuturisticScreenLoaderProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="relative p-8 rounded-3xl bg-white/70 dark:bg-[#070B18]/80 border border-slate-200/80 dark:border-white/10 backdrop-blur-2xl shadow-2xl shadow-teal-500/5 max-w-sm w-full flex flex-col items-center">
        {/* Corner HUD Brackets */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-teal-500/50 rounded-tl-sm" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-teal-500/50 rounded-tr-sm" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-teal-500/50 rounded-bl-sm" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-teal-500/50 rounded-br-sm" />

        {/* Futuristic Spinner */}
        <FuturisticSpinner size="xl" color={color} />

        <div className="mt-5 space-y-1.5">
          <h3 className="font-serif font-black text-lg text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-[11px] font-mono tracking-widest uppercase text-teal-600 dark:text-teal-400 font-bold">
            {subtitle}
          </p>
        </div>

        {/* Telemetry Scanning Bar */}
        <div className="w-full mt-6">
          <FuturisticProgressBar indeterminate color={color} height={4} />
        </div>
      </div>
    </div>
  );
}
