cat > src/components/Layout.tsx << 'INNER_EOF'
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0F1C] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#9A7D3C] selection:text-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-white/5 bg-white/80 dark:bg-[#0A0F1C]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9A7D3C] to-[#806630] flex items-center justify-center text-white shadow-md shadow-[#9A7D3C]/20 group-hover:shadow-[#9A7D3C]/40 transition-shadow">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              RBI Grade B <span className="text-[#9A7D3C]">Engine</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-5">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden md:inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5">
              {user.email}
            </span>
            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block"></div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
INNER_EOF
