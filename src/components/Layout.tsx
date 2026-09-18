import { Outlet, Link } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Moon, Sun, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Layout({ user }: { user: User }) {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
            (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-[#05050A] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#9A7D3C] selection:text-white overflow-x-hidden">
      
      {/* Ambient background blobs for Liquid Glass effect */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 dark:bg-indigo-600/30 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-400/20 dark:bg-fuchsia-600/20 blur-[120px] pointer-events-none" />
      <div className="fixed top-[30%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-400/15 dark:bg-cyan-500/20 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-purple-400/10 dark:bg-[#9A7D3C]/30 blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#0A0F1C]/40 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 flex items-center justify-center text-[#9A7D3C] dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-black/20 group-hover:bg-white/80 dark:group-hover:bg-white/10 transition-all shrink-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="font-serif text-base sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                RBI Grade B <span className="text-[#9A7D3C]">Engine</span>
              </span>
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hidden md:inline-block px-3.5 py-1.5 rounded-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5 backdrop-blur-md shadow-sm truncate max-w-[200px]">
                {user.email}
              </span>
              <div className="h-5 w-px bg-slate-300/50 dark:bg-white/10 hidden sm:block"></div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white/80 border border-white/60 shadow-sm dark:text-slate-400 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:hover:text-white transition-all backdrop-blur-md cursor-pointer"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <button 
                onClick={() => signOut(auth)}
                className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap px-2 sm:px-0 py-1 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 pt-20 sm:pt-28 pb-10 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
