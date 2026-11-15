import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_SMOOTH: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SPRING_BUTTERY = {
  type: 'spring' as const,
  stiffness: 240,
  damping: 24,
  mass: 0.85,
};

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 26,
  mass: 0.75,
};

export const SPRING_TACTILE = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 24,
  mass: 0.6,
};

/**
 * Top-level page wrapper: silky GPU compositor entrance, never leaves UI invisible.
 */
export function MotionPage({
  children,
  className = '',
}: {
  key?: React.Key;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.56, ease: EASE_OUT_EXPO }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scroll-triggered viewport reveal. Uses amount: 0.05 so tall containers on 320px
 * mobile screens always trigger reliably instead of getting stuck invisible.
 */
export function MotionSection({
  children,
  className = '',
  delay = 0,
}: {
  key?: React.Key;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 34, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.65, delay, ease: EASE_OUT_EXPO }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
}

export const staggerGridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 26, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.54, ease: EASE_OUT_EXPO },
  },
};

/**
 * Orchestrated staggered container for KPI grids, subject cards, and lists.
 */
export function MotionStaggerGrid({
  children,
  className = '',
}: {
  key?: React.Key;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerGridVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerItem({
  children,
  className = '',
}: {
  key?: React.Key;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Smoothly ticks numeric values on mount/update using GSAP.
 * Preserves tabular numerals and handles decimals/suffixes cleanly.
 */
export function AnimatedNumber({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  duration = 1.15,
  className = '',
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const counterRef = useRef<{ val: number }>({ val: 0 });
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    counterRef.current.val = prevValueRef.current;
    const tween = gsap.to(counterRef.current, {
      val: value,
      duration,
      ease: 'power4.out',
      onUpdate: () => {
        setDisplayValue(counterRef.current.val);
      },
      onComplete: () => {
        setDisplayValue(value);
        prevValueRef.current = value;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, duration]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString();

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Animated modal overlay + spring content box.
 */
export function MotionModal({
  isOpen,
  onClose,
  children,
  maxWidthClass = 'max-w-lg',
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/75 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 14 }}
            transition={SPRING_BUTTERY}
            className={`w-full ${maxWidthClass} will-change-transform`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Editorial Equalizer waveform bars (GPU transform scaleY).
 */
export function EqualizerBars({
  barCount = 6,
  colorClass = 'bg-[#ECD5FF]',
  heightClass = 'h-3.5',
}: {
  barCount?: number;
  colorClass?: string;
  heightClass?: string;
}) {
  return (
    <span className={`inline-flex items-end gap-[2.5px] ${heightClass}`} aria-hidden="true">
      {Array.from({ length: barCount }).map((_, idx) => (
        <span
          key={idx}
          className={`w-[2.5px] h-full rounded-full ${colorClass} origin-bottom`}
          style={{
            animation: `equalizerPulse ${0.85 + (idx % 3) * 0.22}s ease-in-out infinite`,
            animationDelay: `${idx * 0.11}s`,
          }}
        />
      ))}
    </span>
  );
}
