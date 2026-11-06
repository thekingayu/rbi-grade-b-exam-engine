import { Link, useLocation, useOutlet, useNavigate } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { 
  Moon, Sun, BookOpen, Compass, Plus, Clock, LogOut, 
  RotateCcw, SlidersHorizontal, ChevronDown, Sparkles, 
  Search, Timer as TimerIcon, User as UserIcon 
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Footer } from './Footer';
import { AtmosphericBackground } from './AtmosphericBackground';
import { useSubject } from '../context/SubjectContext';
import { CommandPalette } from './CommandPalette';
import { PomodoroTimer } from './PomodoroTimer';
import { SubjectIcon } from './dashboard/SubjectIcon';

export function Layout({ user }: { user: User }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentOutlet = useOutlet();
  const { subjects, activeSubject, setActiveSubject, userProfile } = useSubject();

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
            (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [scrollProgress, setScrollProgress] = useState(0);
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);

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

  const activeColor = activeSubject ? activeSubject.accentColor : '#0D9488';
  const currentDisplayName = userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Cadre Officer';
  const currentPhoto = userProfile?.photoURL || user.photoURL;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#030612] text-slate-900 dark:text-slate-100 font-sans selection:bg-teal-600 selection:text-white transition-colors duration-500">
      
      {/* Shared Futuristic Atmospheric Glow */}
      <AtmosphericBackground />

      {/* Global Command Palette */}
      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)} 
      />

      {/* Pomodoro Timer Modal Widget */}
      <PomodoroTimer 
        isOpen={showPomodoro} 
        onClose={() => setShowPomodoro(false)} 
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/60 dark:border-white/10 bg-white/60 dark:bg-[#0A0F1C]/75 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Logo / Brand Name & Subject Switcher Dropdown */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
                <div 
                  className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl p-[1.5px] shadow-lg shrink-0 group-hover:scale-105 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${activeColor}, #06B6D4, #6366F1)`
                  }}
                >
                  <div className="w-full h-full rounded-xl sm:rounded-2xl bg-white dark:bg-[#070B18] flex items-center justify-center" style={{ color: activeColor }}>
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <div className="min-w-0 hidden sm:block">
                  <span className="font-serif text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1 leading-tight truncate">
                    RBI Grade B <span className="bg-gradient-to-r from-teal-500 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">Engine</span>
                  </span>
                  <div className="flex items-center text-[9px] font-mono tracking-widest uppercase text-slate-500 dark:text-slate-400 truncate">
                    <span>OFFICER CADRE 2026</span>
                  </div>
                </div>
              </Link>

              {/* SUBJECT SWITCHER DROPDOWN */}
              <div className="relative">
                <button
                  onClick={() => setShowSubjectMenu(!showSubjectMenu)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer max-w-[160px] sm:max-w-[210px]"
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: activeColor }}
                  />
                  <span className="truncate text-slate-800 dark:text-slate-200">
                    {activeSubject ? activeSubject.name : 'All Subjects'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
                </button>

                {showSubjectMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowSubjectMenu(false)} 
                    />
                    <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white/95 dark:bg-[#070B18]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 mb-1">
                        Select Curriculum Scope
                      </div>
                      
                      <button
                        onClick={() => {
                          setActiveSubject(null);
                          setShowSubjectMenu(false);
                          navigate('/');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                          !activeSubject ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-teal-500" />
                        <span>All Subjects (Command Center)</span>
                      </button>

                      <div className="my-1.5 border-t border-slate-100 dark:border-white/5" />

                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {subjects.filter(s => s.slug !== 'uncategorized').map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setActiveSubject(sub);
                              setShowSubjectMenu(false);
                              navigate(`/subject/${sub.slug}`);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                              activeSubject?.id === sub.id
                                ? 'bg-slate-100 dark:bg-white/10'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: sub.accentColor }} 
                              />
                              <span className="truncate">{sub.name}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 shrink-0">
                              {sub.phase}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 bg-white/70 dark:bg-white/[0.04] p-1 rounded-2xl border border-slate-200/80 dark:border-white/10 backdrop-blur-xl shadow-xs">
              <Link 
                to="/" 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  location.pathname === '/' 
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              <Link 
                to="/new" 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  location.pathname.startsWith('/new') 
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Exam</span>
              </Link>
              <Link 
                to="/mistakes" 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  location.pathname === '/mistakes' 
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mistakes</span>
              </Link>
              <Link 
                to="/history" 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  location.pathname === '/history' 
                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Archive</span>
              </Link>
              <Link 
                to="/manage-subjects" 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  location.pathname === '/manage-subjects' 
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Subjects</span>
              </Link>
              <Link 
                to="/syllabus" 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  location.pathname === '/syllabus' 
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Syllabus</span>
              </Link>
            </nav>

            {/* Right Action Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Command Palette Trigger */}
              <button
                onClick={() => setShowCommandPalette(true)}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:border-slate-300 text-xs font-mono text-slate-500 dark:text-slate-400 cursor-pointer"
                title="Command Palette (Ctrl/Cmd+K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">⌘K</span>
              </button>

              {/* Pomodoro Timer Toggle */}
              <button
                onClick={() => setShowPomodoro(!showPomodoro)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 cursor-pointer transition-all"
                title="Pomodoro Study Timer"
              >
                <TimerIcon className="w-4 h-4" />
              </button>
              
              {/* Dark mode */}
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-all cursor-pointer"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* User Profile Button linking to /profile */}
              <Link
                to="/profile"
                className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-2xl border transition-all cursor-pointer shrink-0 ${
                  location.pathname === '/profile'
                    ? 'bg-teal-500/15 border-teal-500/40 ring-2 ring-teal-500/20 shadow-xs'
                    : 'bg-slate-100/80 dark:bg-white/5 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
                title="Manage Officer Profile & Settings"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-teal-500 via-cyan-400 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden shrink-0">
                  {currentPhoto ? (
                    currentPhoto.startsWith('http') || currentPhoto.startsWith('data:') ? (
                      <img src={currentPhoto} alt={currentDisplayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm leading-none">{currentPhoto}</span>
                    )
                  ) : (
                    <span>{currentDisplayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[110px]">
                    {currentDisplayName.split(' ')[0]}
                  </span>
                  <span className="text-[9px] font-mono text-teal-600 dark:text-teal-400 font-bold leading-tight">
                    {userProfile?.stream || 'Officer'}
                  </span>
                </div>
              </Link>

              {/* Sign out */}
              <button 
                onClick={() => signOut(auth)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 transition-all cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Micro-precision liquid scroll progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent overflow-hidden pointer-events-none">
            <div 
              className="h-full shadow-[0_0_8px_rgba(13,148,136,0.6)]"
              style={{ 
                width: `${scrollProgress}%`,
                background: `linear-gradient(90deg, ${activeColor}, #06B6D4, #6366F1)`,
                transition: 'width 60ms cubic-bezier(0, 0, 0.2, 1)'
              }}
            />
          </div>
        </header>

        {/* Sleek, Perfectly-Aligned Symmetrical Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 dark:bg-[#070B18]/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.6)] pb-[env(safe-area-inset-bottom,6px)]">
          <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-1">
            {/* 1. Dashboard / Home */}
            <Link 
              to="/" 
              className={`flex flex-col items-center justify-center h-full gap-1 text-center transition-all ${
                location.pathname === '/' 
                  ? 'text-teal-600 dark:text-teal-400 font-extrabold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${location.pathname === '/' ? 'bg-teal-500/15' : ''}`}>
                <Compass className="w-4 h-4" />
              </div>
              <span className="text-[10px] leading-none tracking-tight">Dashboard</span>
            </Link>

            {/* 2. Mistakes */}
            <Link 
              to="/mistakes" 
              className={`flex flex-col items-center justify-center h-full gap-1 text-center transition-all ${
                location.pathname === '/mistakes' 
                  ? 'text-rose-600 dark:text-rose-400 font-extrabold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${location.pathname === '/mistakes' ? 'bg-rose-500/15' : ''}`}>
                <RotateCcw className="w-4 h-4" />
              </div>
              <span className="text-[10px] leading-none tracking-tight">Mistakes</span>
            </Link>

            {/* 3. Center Elevated Action: New Exam + */}
            <div className="flex flex-col items-center justify-center relative -top-3">
              <Link 
                to="/new" 
                className="group flex flex-col items-center justify-center cursor-pointer focus:outline-none"
                title="Start New Exam"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-200 group-hover:scale-105 group-active:scale-95 border-2 border-white dark:border-[#070B18] ${
                  location.pathname.startsWith('/new')
                    ? 'bg-gradient-to-tr from-teal-500 via-cyan-400 to-indigo-600 shadow-teal-500/40 ring-4 ring-teal-500/20'
                    : 'bg-gradient-to-tr from-teal-500 via-cyan-500 to-indigo-600 shadow-teal-500/30'
                }`}>
                  <Plus className="w-6 h-6 stroke-[2.75]" />
                </div>
                <span className={`text-[10px] font-bold tracking-tight mt-1 leading-none ${
                  location.pathname.startsWith('/new') 
                    ? 'text-teal-600 dark:text-teal-400 font-extrabold' 
                    : 'text-slate-700 dark:text-slate-300'
                }`}>
                  New Exam
                </span>
              </Link>
            </div>

            {/* 4. Archive */}
            <Link 
              to="/history" 
              className={`flex flex-col items-center justify-center h-full gap-1 text-center transition-all ${
                location.pathname === '/history' 
                  ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${location.pathname === '/history' ? 'bg-indigo-500/15' : ''}`}>
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[10px] leading-none tracking-tight">Archive</span>
            </Link>

            {/* 5. Profile */}
            <Link 
              to="/profile" 
              className={`flex flex-col items-center justify-center h-full gap-1 text-center transition-all ${
                location.pathname === '/profile' 
                  ? 'text-teal-600 dark:text-teal-400 font-extrabold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 font-medium'
              }`}
            >
              <div className={`p-0.5 rounded-full transition-all ${location.pathname === '/profile' ? 'ring-2 ring-teal-500/40' : ''}`}>
                <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-tr from-teal-500 to-cyan-500 text-white font-bold text-[9px]">
                  {currentPhoto ? (
                    currentPhoto.startsWith('http') || currentPhoto.startsWith('data:') ? (
                      <img src={currentPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{currentPhoto}</span>
                    )
                  ) : (
                    <span>{currentDisplayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] leading-none tracking-tight">Profile</span>
            </Link>
          </div>
        </nav>

        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 pt-20 sm:pt-24 pb-28 md:pb-12 w-full relative">
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
              initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
