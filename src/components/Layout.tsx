import { Link, useLocation, useOutlet } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Moon, Sun, BookOpen, Compass, Plus, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Footer } from './Footer';
import { AtmosphericBackground } from './AtmosphericBackground';

export function Layout({ user }: { user: User }) {
  const location = useLocation();
  const currentOutlet = useOutlet();

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
            (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0) {
            setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100)));
          } else {
            setScrollProgress(0);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#030612] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#9A7D3C] selection:text-white transition-colors duration-500">
      
      {/* Shared Futuristic Colorful Atmospheric Glow Canvas */}
      <AtmosphericBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#0A0F1C]/40 backdrop-blur-2xl transform-gpu will-change-transform">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 group shrink-0 min-w-0">
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#9A7D3C] via-amber-500 to-emerald-600 p-[1.5px] shadow-lg shadow-[#9A7D3C]/15 shrink-0 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-2xl bg-white dark:bg-[#070B18] flex items-center justify-center text-[#9A7D3C] dark:text-[#E5C378]">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <span className="font-serif text-base sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight">
                  RBI Grade B <span className="bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-500 dark:from-[#E5C378] dark:via-amber-300 dark:to-emerald-400 bg-clip-text text-transparent">Engine</span>
                </span>
                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono tracking-widest uppercase text-slate-500 dark:text-slate-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>OFFICER CADRE // CYCLE 2026-27</span>
                </div>
              </div>
            </Link>
            
            {/* Centered Futuristic Navigation Pill */}
            <nav className="hidden md:flex items-center gap-1.5 bg-white/70 dark:bg-white/[0.04] p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10 backdrop-blur-xl shadow-xs">
              <Link 
                to="/" 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  location.pathname === '/' 
                    ? 'bg-amber-500/15 dark:bg-amber-500/20 text-[#9A7D3C] dark:text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              <Link 
                to="/new" 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  location.pathname === '/new' 
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Exam</span>
              </Link>
              <Link 
                to="/history" 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  location.pathname === '/history' 
                    ? 'bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Exam Archive</span>
              </Link>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 max-w-[130px] truncate">
                  {user.email?.split('@')[0]}
                </span>
              </div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 shadow-xs transition-all backdrop-blur-md cursor-pointer hover:scale-105"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <button 
                onClick={() => signOut(auth)}
                className="text-xs font-bold px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all whitespace-nowrap cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Micro-precision liquid gold scroll progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent overflow-hidden pointer-events-none">
            <div 
              className="h-full bg-gradient-to-r from-[#9A7D3C] via-amber-400 to-[#9A7D3C] shadow-[0_0_8px_rgba(154,125,60,0.6)]"
              style={{ 
                width: `${scrollProgress}%`,
                transition: 'width 60ms cubic-bezier(0, 0, 0.2, 1)'
              }}
            />
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 pt-20 sm:pt-28 pb-10 w-full relative">
          <AnimatePresence 
            mode="wait" 
            initial={false}
            onExitComplete={() => {
              if (window.__lenis) {
                window.__lenis.scrollTo(0, { immediate: true });
              } else {
                window.scrollTo(0, 0);
              }
            }}
          >
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
              transition={{ 
                duration: 0.24, 
                ease: [0.22, 1, 0.36, 1] 
              }}
              className="w-full flex-1"
            >
              {currentOutlet}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
    </div>
  );
}
