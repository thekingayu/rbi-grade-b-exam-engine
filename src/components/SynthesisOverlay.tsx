import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Cpu } from 'lucide-react';
import gsap from 'gsap';

interface SynthesisOverlayProps {
  isOpen: boolean;
  onCancel: () => void;
  loadingMessage?: string;
  subjectName?: string;
  progressPercent?: number;
  detailText?: string;
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
  subjectName = 'Curriculum',
  progressPercent,
  detailText
}: SynthesisOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbitalRing1Ref = useRef<SVGSVGElement>(null);
  const orbitalRing2Ref = useRef<SVGSVGElement>(null);
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const ctx = gsap.context(() => {
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
    });

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
        }> = [];

        for (let i = 0; i < 32; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: Math.random() * 1.6 + 0.6,
            alpha: Math.random() * 0.4 + 0.15
          });
        }

        const render = () => {
          c.clearRect(0, 0, canvas.width, canvas.height);

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
            c.fillStyle = `rgba(13, 71, 255, ${p.alpha})`;
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
                c.strokeStyle = `rgba(20, 20, 19, ${(1 - dist / 65) * 0.14})`;
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

    const interval = setInterval(() => {
      setActivePhaseIndex(prev => (prev + 1) % PHASES.length);
    }, 3800);

    return () => {
      ctx.revert();
      cancelAnimationFrame(animationFrameId);
      clearInterval(interval);
    };
  }, [isOpen]);

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-lenis-prevent
          key="synthesis-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-[#FAF8EC]/78 dark:bg-[#141413]/82 backdrop-blur-md p-4 select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="synthesis-dialog-title"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Main Dialog Container with Strictly Fixed, Rigid Dimensions (never resizes on text changes) */}
          <motion.div
            key="synthesis-modal"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative w-[440px] max-w-[calc(100vw-32px)] h-[500px] min-h-[480px] max-h-[92vh] shrink-0 flex flex-col justify-between rounded-3xl bg-[#FAF8EC] dark:bg-[#1C1C1A] p-5 sm:p-7 text-center border-[2px] border-[#141413] dark:border-[#ECD5FF] shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF] overflow-hidden box-border select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-35 dark:opacity-25"
            />

            {/* Close / Cross Button */}
            <motion.button
              type="button"
              onClick={onCancel}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="absolute top-4 right-4 z-20 p-2 rounded-xl text-[#141413] dark:text-[#FAF8EC] bg-[#FFFFFF] dark:bg-[#141413] hover:bg-[#ECD5FF] hover:text-[#141413] transition-colors cursor-pointer border border-[#141413]/25 dark:border-[#2E2E2A]"
              title="Cancel generation and close"
              aria-label="Close synthesizing window"
            >
              <X className="w-4 h-4" />
            </motion.button>

            {/* Top & Middle Section */}
            <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0 overflow-hidden relative z-10">
              {/* Central Gyro & Orbital Rings */}
              <div className="relative w-20 h-20 mx-auto mb-3 flex items-center justify-center shrink-0">
                <svg
                  ref={orbitalRing2Ref}
                  className="absolute inset-0 w-full h-full text-[#141413]/25 dark:text-[#ECD5FF]/30 pointer-events-none"
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

                <svg
                  ref={orbitalRing1Ref}
                  className="absolute inset-0 w-full h-full text-[#0D47FF] dark:text-[#ECD5FF] pointer-events-none"
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

                <div className="w-12 h-12 rounded-xl bg-[#0D47FF] text-white flex items-center justify-center z-10 border-[1.5px] border-[#141413] shadow-[2px_2px_0px_#141413]">
                  <Cpu className="w-6 h-6" />
                </div>
              </div>

              {/* Fixed-Height Title */}
              <div className="h-9 w-full flex items-center justify-center shrink-0 overflow-hidden">
                <h3
                  id="synthesis-dialog-title"
                  className="text-xl sm:text-[24px] font-heading font-black text-[#141413] dark:text-[#FAF8EC] tracking-tight leading-none truncate px-2"
                >
                  Synthesizing Mock Exam
                </h3>
              </div>

              {/* Fixed-Dimension Stage Status Pill */}
              <div className="h-8 w-full max-w-[280px] sm:max-w-[320px] flex items-center justify-center mt-2 shrink-0 overflow-hidden mx-auto px-1">
                <div className="w-full flex items-center justify-center gap-2 px-3 py-1 rounded-xl bg-[#ECD5FF] border-[1.5px] border-[#141413] overflow-hidden">
                  <span className="w-2 h-2 rounded-full bg-[#0D47FF] shrink-0" />
                  <span className="text-xs font-mono font-bold text-[#141413] truncate text-center">
                    {loadingMessage || PHASES[activePhaseIndex].label}
                  </span>
                </div>
              </div>

              {/* Fixed-Dimension Subtitle */}
              <div className="h-14 w-full max-w-[300px] sm:max-w-[340px] flex flex-col items-center justify-center mt-1 px-2 shrink-0 overflow-hidden mx-auto gap-1.5">
                <p className="text-xs text-[#55554F] dark:text-[#A3A399] leading-relaxed text-center font-sans font-normal line-clamp-2">
                  {detailText || PHASES[activePhaseIndex].sub}
                </p>
                {typeof progressPercent === 'number' && (
                  <div className="w-full max-w-[260px] flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-[#E5E1CE] dark:bg-[#2E2E2A] border border-[#141413]/25 overflow-hidden">
                      <div
                        className="h-full bg-[#0D47FF] dark:bg-[#ECD5FF] transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums w-8 text-right">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Anchored Section */}
            <div className="w-full shrink-0 pt-2 space-y-3 relative z-10">
              <div className="h-14 p-2.5 sm:p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between text-left gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#FFD426] border border-[#141413] text-[#141413] flex items-center justify-center font-bold text-xs shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold truncate">
                      Target Cadre
                    </p>
                    <p className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] font-sans truncate">
                      RBI Grade B · {subjectName}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono font-bold text-[#141413] bg-[#ECD5FF] border border-[#141413] px-2 py-0.5 rounded-md">
                    Active
                  </span>
                </div>
              </div>

              <div className="h-7 flex items-center justify-center">
                <motion.button
                  type="button"
                  onClick={onCancel}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-xs font-bold text-[#55554F] hover:text-rose-600 dark:text-[#A3A399] dark:hover:text-rose-400 underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Cancel and return to configuration
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
