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
    <div className="min-h-screen bg-slate-50/80 dark:bg-[#080B14] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#9A7D3C] selection:text-white relative overflow-hidden">
      
      {/* Ambient background blobs for Liquid Glass effect */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 dark:bg-blue-600/15 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-400/20 dark:bg-[#9A7D3C]/15 blur-[120px] pointer-events-none" />
      <div className="fixed top-[30%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-400/15 dark:bg-emerald-600/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 border-b border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#0A0F1C]/40 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/10 flex items-center justify-center text-[#9A7D3C] dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-black/20 group-hover:bg-white/80 dark:group-hover:bg-white/20 transition-all">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                RBI Grade B <span className="text-[#9A7D3C]">Engine</span>
              </span>
            </Link>
            
            <div className="flex items-center gap-5">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 hidden md:inline-block px-4 py-1.5 rounded-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5 backdrop-blur-md shadow-sm">
                {user.email}
              </span>
              <div className="h-6 w-px bg-slate-300/50 dark:bg-white/10 hidden sm:block"></div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white/80 border border-white/60 shadow-sm dark:text-slate-400 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:hover:text-white transition-all backdrop-blur-md"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => signOut(auth)}
                className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
INNER_EOF
