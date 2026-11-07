import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, AlertCircle, ShieldCheck, Cpu } from 'lucide-react';
import gsap from 'gsap';

interface SynthesisOverlayProps {
  isOpen: boolean;
  onCancel: () => void;
  loadingMessage?: string;
  subjectName?: string;
}

const PHASES = [
  { label: 'Decompiling Curriculum Directives', sub: 'Parsing static acts, RBI circulars & economic notes' },
  { label: 'Calibrating RBI Grade B Schema', sub: 'Applying 5-option IBPS discrimination patterns & negative weights' },
  { label: 'Synthesizing High-Yield Questions', sub: 'Generating analytical prompts, data tables & options' },
  { label: 'Finalizing Evaluation Rubrics', sub: 'Formulating benchmark model answers and marking scheme' }
];

export function SynthesisOverlay({
  isOpen,
  onCancel,
  loadingMessage,
  subjectName = 'Curriculum'
}: SynthesisOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbitalRing1Ref = useRef<SVGSVGElement>(null);
  const orbitalRing2Ref = useRef<SVGSVGElement>(null);
  const glowPulseRef = useRef<HTMLDivElement>(null);
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);

  // GSAP Timeline Orchestration for continuous canvas particles & orbital gyro motion
  useEffect(() => {
    if (!isOpen) return;

    const ctx = gsap.context(() => {
      // 1. Orbital Ring continuous GSAP rotations
      if (orbitalRing1Ref.current) {
        gsap.to(orbitalRing1Ref.current, {
          rotation: 360,
          duration: 9,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%'
        });
      }

      if (orbitalRing2Ref.current) {
        gsap.to(orbitalRing2Ref.current, {
          rotation: -360,
          duration: 14,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%'
        });
      }

      // 2. Pulsing aura timeline
      if (glowPulseRef.current) {
        gsap.timeline({ repeat: -1, yoyo: true })
          .to(glowPulseRef.current, {
            scale: 1.15,
            opacity: 0.7,
            duration: 2.2,
            ease: 'sine.inOut'
          })
          .to(glowPulseRef.current, {
            scale: 0.95,
            opacity: 0.35,
            duration: 2.2,
            ease: 'sine.inOut'
          });
      }
    });

    // 3. Canvas ambient particles animation
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (canvas) {
      const c = canvas.getContext('2d');
      if (c) {
        canvas.width = 460;
        canvas.height = 360;

        const particles: Array<{
          x: number;
          y: number;
          vx: number;
          vy: number;
          radius: number;
          alpha: number;
          baseAlpha: number;
        }> = [];

        for (let i = 0; i < 38; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            radius: Math.random() * 1.8 + 0.6,
            alpha: Math.random() * 0.5 + 0.2,
            baseAlpha: Math.random() * 0.5 + 0.2
          });
        }

        const render = () => {
          c.clearRect(0, 0, canvas.width, canvas.height);

          // Draw particles & linking lines
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            c.beginPath();
            c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            c.fillStyle = `rgba(20, 184, 166, ${p.alpha})`;
            c.fill();

            for (let j = i + 1; j < particles.length; j++) {
              const p2 = particles[j];
              const dx = p.x - p2.x;
              const dy = p.y - p2.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < 65) {
                c.beginPath();
                c.moveTo(p.x, p.y);
                c.lineTo(p2.x, p2.y);
                c.strokeStyle = `rgba(13, 148, 136, ${(1 - dist / 65) * 0.18})`;
                c.lineWidth = 0.75;
                c.stroke();
              }
            }
          }

          animationFrameId = requestAnimationFrame(render);
        };

        render();
      }
    }

    // 4. Staged sequence progression for user reassurance
    const interval = setInterval(() => {
      setActivePhaseIndex(prev => (prev + 1) % PHASES.length);
    }, 3800);

    return () => {
      ctx.revert();
      cancelAnimationFrame(animationFrameId);
      clearInterval(interval);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="synthesis-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4 select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="synthesis-dialog-title"
          /* CRITICAL: Clicking outside or on the backdrop does NOT close the modal! */
          onClick={(e) => {
            e.stopPropagation();
            // Intentionally no-op: Only the explicit cross or cancel button can close this window.
          }}
        >
          {/* Main Dialog Container with Strictly Fixed, Rigid Dimensions (never resizes on text changes) */}
          <motion.div
            key="synthesis-modal"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative w-[440px] max-w-[calc(100vw-32px)] h-[500px] min-h-[480px] max-h-[92vh] shrink-0 flex flex-col justify-between rounded-3xl bg-white/95 dark:bg-[#070B18]/95 p-5 sm:p-7 text-center border border-teal-500/30 dark:border-teal-500/20 shadow-2xl shadow-teal-500/10 backdrop-blur-3xl overflow-hidden box-border select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Canvas (GSAP particle telemetry) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-40 dark:opacity-35"
            />

            {/* Glowing Aura Center */}
            <div
              ref={glowPulseRef}
              className="absolute top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gradient-to-tr from-teal-500/20 via-cyan-500/25 to-indigo-500/20 blur-3xl pointer-events-none"
            />

            {/* Close / Cross Button with Motion Gesture Binding */}
            <motion.button
              type="button"
              onClick={onCancel}
              whileHover={{ scale: 1.12, rotate: 90 }}
              whileTap={{ scale: 0.88 }}
              className="absolute top-4 right-4 z-20 p-2.5 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100/60 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-white/10 shadow-xs"
              title="Cancel generation and close"
              aria-label="Close synthesizing window"
            >
              <X className="w-4 h-4" />
            </motion.button>

            {/* Top & Middle Section: Animation & Dynamic Phase Telemetry */}
            <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0 overflow-hidden">
              {/* Central Gyro & Orbital Rings Animation */}
              <div className="relative w-20 h-20 mx-auto mb-3 flex items-center justify-center shrink-0">
                {/* Outer Counter-Rotating Ring */}
                <svg
                  ref={orbitalRing2Ref}
                  className="absolute inset-0 w-full h-full text-teal-400/30 dark:text-teal-400/25 pointer-events-none"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="14 10 32 8"
                  />
                </svg>

                {/* Inner Rotating Ring */}
                <svg
                  ref={orbitalRing1Ref}
                  className="absolute inset-0 w-full h-full text-teal-500/60 dark:text-teal-400/50 pointer-events-none"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray="22 14 8 18"
                  />
                </svg>

                {/* Central Nucleus with Soft Glow */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/35 z-10 border border-teal-300/40">
                  <Cpu className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Fixed-Height Title */}
              <div className="h-9 w-full flex items-center justify-center shrink-0 overflow-hidden">
                <h3
                  id="synthesis-dialog-title"
                  className="text-xl sm:text-[24px] font-sans font-extrabold text-slate-900 dark:text-white tracking-tight leading-none truncate px-2"
                >
                  Synthesizing Mock Exam
                </h3>
              </div>

              {/* Responsive Fixed-Dimension Stage Pill Container (fits 320px–440px gracefully) */}
              <div className="h-8 w-full max-w-[280px] sm:max-w-[320px] flex items-center justify-center mt-2 shrink-0 overflow-hidden mx-auto px-1">
                <div className="w-full flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/30 overflow-hidden">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping shrink-0" />
                  <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-300 truncate text-center">
                    {loadingMessage || PHASES[activePhaseIndex].label}
                  </span>
                </div>
              </div>

              {/* Responsive Fixed-Dimension Subtitle Container */}
              <div className="h-14 w-full max-w-[300px] sm:max-w-[340px] flex items-center justify-center mt-1 px-2 shrink-0 overflow-hidden mx-auto">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-center font-sans font-normal line-clamp-2">
                  {PHASES[activePhaseIndex].sub}
                </p>
              </div>
            </div>

            {/* Bottom Anchored Section: Cadre Card and Cancel Action */}
            <div className="w-full shrink-0 pt-2 space-y-3">
              {/* Subject Cadre Tracker */}
              <div className="h-14 p-2.5 sm:p-3 rounded-2xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex items-center justify-between text-left gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold truncate">
                      Target Cadre
                    </p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-sans truncate">
                      RBI Grade B · {subjectName}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                    Active
                  </span>
                </div>
              </div>

              {/* Explicit Cancel Button with Rapid Motion Gesture Binding */}
              <div className="h-7 flex items-center justify-center">
                <motion.button
                  type="button"
                  onClick={onCancel}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="text-xs font-semibold text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 underline underline-offset-4 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Cancel and return to configuration</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
