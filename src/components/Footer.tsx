import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Heart, ArrowUp, ShieldCheck } from 'lucide-react';
import { MotionSection } from './MotionPrimitives';

export function Footer() {
  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).__lenis) {
        (window as any).__lenis.scrollTo(0, { duration: 1.0 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="mt-auto relative z-20 border-t border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] pb-24 lg:pb-20 transition-colors duration-300">
      <MotionSection className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 pb-10 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
          {/* Column 1: Wordmark & Architecture summary */}
          <div className="md:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-[#ECD5FF] border-[1.5px] border-[#141413] flex items-center justify-center text-[#141413] transition-transform group-hover:scale-105 group-hover:-rotate-3">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="font-heading text-lg font-black tracking-tight leading-none">
                  RBI GRADE B × Engine
                </div>
                <div className="text-[10px] font-mono tracking-widest uppercase text-[#66665E] dark:text-[#A3A399] mt-1">
                  OFFICER PREPARATION CADRE · CYCLE 2026–27
                </div>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] leading-relaxed max-w-md">
              Structured preparation workspace calibrated strictly to Reserve Bank of India Phase I &amp; Phase II standards—featuring Dual-Track question synthesis, PYQs, and spaced-repetition mistaking tracking.
            </p>
          </div>

          {/* Column 2: Quick Navigation */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
              Workspace Routes
            </h4>
            <ul className="space-y-1.5 text-xs sm:text-sm font-medium">
              {[
                { name: 'Command Center', path: '/' },
                { name: 'Launch New Exam', path: '/new' },
                { name: 'Official Syllabus & PDF', path: '/syllabus' },
                { name: 'Exam Archive', path: '/history' },
                { name: 'Mistake Notebook', path: '/mistakes' }
              ].map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="group inline-flex items-center justify-between w-full py-1.5 text-[#141413] dark:text-[#FAF8EC] hover:text-[#0D47FF] dark:hover:text-[#ECD5FF] transition-colors"
                  >
                    <span className="transition-transform group-hover:translate-x-1">{link.name}</span>
                    <span className="font-mono text-[10px] text-[#66665E] dark:text-[#A3A399] transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Official Paper Weightage */}
          <div className="md:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                RBI Syllabus Matrix
              </h4>
              <span className="font-mono text-[10px] font-bold text-[#0D47FF] dark:text-[#ECD5FF]">
                375 MERIT MARKS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'General Awareness', weight: '80 Qs' },
                { label: 'Quant & Reasoning', weight: '30 + 60 Qs' },
                { label: 'English Language', weight: '30 Qs' },
                { label: 'Phase II: ESI', weight: 'Paper I' },
                { label: 'Phase II: Writing', weight: 'Paper II' },
                { label: 'Phase II: Finance & Mgmt', weight: 'Paper III' }
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-2.5 rounded-lg bg-[#F3F0E0] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/40 transition-colors"
                >
                  <div className="text-[11px] font-semibold truncate">{item.label}</div>
                  <div className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                    {item.weight}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Creator Credit */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#66665E] dark:text-[#A3A399]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
            <span className="font-medium text-[#141413] dark:text-[#FAF8EC]">
              &copy; {new Date().getFullYear()} RBI Grade B Engine.
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A]">
            <span>Made with Love</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span className="font-heading font-bold text-[#141413] dark:text-white">Ayush</span>
          </div>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F3F0E0] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] text-[11px] font-mono font-bold uppercase tracking-wider cursor-pointer"
            aria-label="Back to top"
          >
            <span>Top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </MotionSection>
    </footer>
  );
}
