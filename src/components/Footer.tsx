import { Link } from 'react-router-dom';
import { BookOpen, Heart, ArrowUp, ShieldCheck, Sparkles, Award } from 'lucide-react';

export function Footer() {
  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).__lenis) {
        (window as any).__lenis.scrollTo(0);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="mt-auto border-t border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#0A0F1C]/40 backdrop-blur-2xl text-slate-700 dark:text-slate-300 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-8 border-b border-slate-200/60 dark:border-white/5">
          
          {/* Brand & Mission Statement */}
          <div className="md:col-span-5 space-y-3">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center text-[#9A7D3C] shadow-sm group-hover:scale-105 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                RBI Grade B <span className="text-[#9A7D3C]">Engine</span>
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              Adaptive, high-yield mock test simulation engineered for RBI Grade B Officers Phase I &amp; Phase II aspirants with real-time sectional timing and instant analytics.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Syllabus Grounded &bull; Negative Marking &bull; Phase I &amp; II Pattern</span>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link to="/" className="text-slate-600 dark:text-slate-400 hover:text-[#9A7D3C] dark:hover:text-[#cbb070] transition-colors">
                  Candidate Dashboard
                </Link>
              </li>
              <li>
                <Link to="/new" className="text-slate-600 dark:text-slate-400 hover:text-[#9A7D3C] dark:hover:text-[#cbb070] transition-colors">
                  Create Custom Test
                </Link>
              </li>
              <li>
                <Link to="/history" className="text-slate-600 dark:text-slate-400 hover:text-[#9A7D3C] dark:hover:text-[#cbb070] transition-colors">
                  Attempts &amp; Analytics
                </Link>
              </li>
            </ul>
          </div>

          {/* Exam Syllabus Coverage Tags */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#9A7D3C]" />
              Syllabus Coverage
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Phase I: General Awareness',
                'Quantitative Aptitude',
                'Reasoning Ability',
                'English Language',
                'Phase II: ESI',
                'Finance & Management',
                'Descriptive English'
              ].map((tag) => (
                <span 
                  key={tag}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 text-slate-600 dark:text-slate-400 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Made with Love Ayush signature */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#9A7D3C]" />
            <span>&copy; {new Date().getFullYear()} RBI Grade B Engine. Rigorous preparation for future officers.</span>
          </div>

          {/* Signature Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-xs text-xs font-medium text-slate-700 dark:text-slate-300">
              <Award className="w-3.5 h-3.5 text-[#9A7D3C]" />
              <span>Made with Love</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
              <span className="font-semibold text-slate-900 dark:text-white">Ayush</span>
            </div>

            <button
              onClick={scrollToTop}
              className="p-1.5 rounded-lg bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer shadow-xs"
              title="Back to top"
              aria-label="Back to top"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </footer>
  );
}
