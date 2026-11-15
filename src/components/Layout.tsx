import { Link, useLocation, useOutlet, useNavigate } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  Moon,
  Sun,
  BookOpen,
  Compass,
  Plus,
  Clock,
  LogOut,
  RotateCcw,
  ChevronDown,
  Search,
  Timer as TimerIcon,
  ArrowRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Footer } from './Footer';
import { AtmosphericBackground } from './AtmosphericBackground';
import { useSubject } from '../context/SubjectContext';
import { CommandPalette } from './CommandPalette';
import { PomodoroTimer } from './PomodoroTimer';
import { EqualizerBars, SPRING_SNAPPY, SPRING_TACTILE, EASE_OUT_EXPO } from './MotionPrimitives';

export function Layout({ user }: { user: User }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentOutlet = useOutlet();
  const { subjects, activeSubject, setActiveSubject, userProfile, targetExamDate } = useSubject();

  const [darkMode, setDarkMode] = useState(() => {
    return (
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  const [scrollProgress, setScrollProgress] = useState(0);
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [countdownText, setCountdownText] = useState('');

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
            setScrollProgress(Math.min(1, Math.max(0, window.scrollY / totalHeight)));
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

  // Global Cmd/Ctrl+K toggle shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Live exam target countdown ticker for the Floating Dark Bottom Dock
  useEffect(() => {
    const updateCountdown = () => {
      const targetMs = new Date(`${targetExamDate}T09:00:00+05:30`).getTime();
      const diff = Math.max(0, targetMs - Date.now());
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      setCountdownText(`${days}d ${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
    };
    updateCountdown();
    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, [targetExamDate]);

  const activeColor = activeSubject ? activeSubject.accentColor : '#0D47FF';
  const currentDisplayName = userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Officer';
  const currentPhoto = userProfile?.photoURL || user.photoURL;
  const isNewExamRoute = location.pathname.startsWith('/new') || location.pathname.startsWith('/exam/new');

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/new', label: 'New Exam', matchPrefix: '/new' },
    { path: '/mistakes', label: 'Mistakes' },
    { path: '/history', label: 'Archive' },
    { path: '/manage-subjects', label: 'Subjects' },
    { path: '/syllabus', label: 'Syllabus' }
  ];

  const isNavActive = (item: { path: string; matchPrefix?: string }) => {
    if (item.matchPrefix) return location.pathname.startsWith(item.matchPrefix);
    return location.pathname === item.path;
  };

  return (
    <div className="min-h-screen bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] font-sans selection:bg-[#ECD5FF] selection:text-[#141413] transition-colors duration-300">
      <AtmosphericBackground />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      <PomodoroTimer
        isOpen={showPomodoro}
        onClose={() => setShowPomodoro(false)}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Clean 3-Zone Editorial Header */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC]/92 dark:bg-[#141413]/92 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-1.5 sm:gap-4">
            {/* ZONE 1: Brand Lockup & Subject Scope Dropdown */}
            <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
              <Link to="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0 group">
                <span className="font-heading text-xs sm:text-base font-black tracking-tight text-[#141413] dark:text-[#FAF8EC] whitespace-nowrap">
                  RBI GRADE B
                </span>
                <span className="hidden sm:inline text-[#66665E] dark:text-[#A3A399]">×</span>
                <span className="hidden sm:inline-flex items-center gap-1.5 font-heading text-sm sm:text-base font-bold text-[#0D47FF] dark:text-[#ECD5FF] whitespace-nowrap">
                  <BookOpen className="w-4 h-4 transition-transform group-hover:scale-110" />
                  Engine
                </span>
              </Link>

              {/* Subject Switcher Dropdown */}
              <div className="relative min-w-0">
                <button
                  onClick={() => setShowSubjectMenu(!showSubjectMenu)}
                  className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 min-h-[36px] rounded-lg text-[11px] sm:text-xs font-bold bg-[#F3F0E0] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 transition-colors cursor-pointer max-w-[110px] sm:max-w-[180px]"
                  aria-expanded={showSubjectMenu}
                  aria-label="Switch subject scope"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeColor }}
                  />
                  <span className="truncate text-[#141413] dark:text-[#FAF8EC]">
                    {activeSubject ? activeSubject.name : 'All Subjects'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#66665E] dark:text-[#A3A399] shrink-0 ml-auto transition-transform duration-200 ${
                      showSubjectMenu ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {showSubjectMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowSubjectMenu(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -6 }}
                        transition={SPRING_SNAPPY}
                        className="absolute top-full left-0 mt-2 w-64 max-w-[85vw] rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-2 z-50 origin-top-left"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] border-b border-[#E5E1CE] dark:border-[#2E2E2A] mb-1">
                          Curriculum Scope
                        </div>

                        <button
                          onClick={() => {
                            setActiveSubject(null);
                            setShowSubjectMenu(false);
                            navigate('/');
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors cursor-pointer ${
                            !activeSubject
                              ? 'bg-[#ECD5FF] text-[#141413]'
                              : 'text-[#141413] dark:text-[#FAF8EC] hover:bg-[#F3F0E0] dark:hover:bg-[#242421]'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-[#0D47FF]" />
                          <span>All Subjects (Command Center)</span>
                        </button>

                        <div className="my-1.5 border-t border-[#E5E1CE] dark:border-[#2E2E2A]" />

                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {subjects
                            .filter((s) => s.slug !== 'uncategorized')
                            .map((sub) => (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  setActiveSubject(sub);
                                  setShowSubjectMenu(false);
                                  navigate(`/subject/${sub.slug}`);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                                  activeSubject?.id === sub.id
                                    ? 'bg-[#ECD5FF] text-[#141413] font-bold'
                                    : 'text-[#141413] dark:text-[#FAF8EC] hover:bg-[#F3F0E0] dark:hover:bg-[#242421]'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: sub.accentColor }}
                                  />
                                  <span className="truncate">{sub.name}</span>
                                </div>
                                <span className="text-[10px] font-mono opacity-65 shrink-0">
                                  {sub.phase}
                                </span>
                              </button>
                            ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ZONE 2: Clean Flat Editorial Navigation Links with shared layoutId underline */}
            <nav className="hidden lg:flex items-center gap-5 xl:gap-7 shrink-0">
              {navItems.map((item) => {
                const active = isNavActive(item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative py-2 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                      active
                        ? 'text-[#141413] dark:text-[#ECD5FF] font-bold'
                        : 'text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-white font-semibold'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active && (
                      <motion.span
                        layoutId="desktop-nav-underline"
                        transition={SPRING_SNAPPY}
                        className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0D47FF] dark:bg-[#ECD5FF] rounded-full"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ZONE 3: Action Utilities & Profile */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setShowCommandPalette(true)}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 h-9 rounded-lg bg-[#F3F0E0] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 text-xs font-mono text-[#66665E] dark:text-[#A3A399] cursor-pointer"
                title="Command Palette (Ctrl/Cmd+K)"
                aria-label="Open quick navigation palette"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">⌘K</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setShowPomodoro(!showPomodoro)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                  showPomodoro
                    ? 'bg-[#FFD426] text-[#141413] border-[#141413]'
                    : 'bg-[#F3F0E0] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413]'
                }`}
                title="Pomodoro Study Timer"
                aria-label="Toggle Pomodoro timer"
              >
                <TimerIcon className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.93, rotate: 15 }}
                onClick={() => setDarkMode(!darkMode)}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F3F0E0] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 transition-colors cursor-pointer"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-4 h-4 text-[#FFD426]" /> : <Moon className="w-4 h-4 text-[#141413]" />}
              </motion.button>

              {/* Profile Link */}
              <Link
                to="/profile"
                className={`flex items-center gap-2 pl-1 pr-1.5 sm:pl-1.5 sm:pr-2.5 h-9 rounded-lg border transition-colors shrink-0 ${
                  location.pathname === '/profile'
                    ? 'bg-[#ECD5FF] border-[#141413] text-[#141413]'
                    : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60'
                }`}
                title="Officer Dossier & Lanyard Pass"
              >
                <div className="w-7 h-7 rounded-md bg-[#141413] dark:bg-[#ECD5FF] text-[#FAF8EC] dark:text-[#141413] flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
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
                <span className="hidden lg:inline text-xs font-bold truncate max-w-[90px]">
                  {currentDisplayName.split(' ')[0]}
                </span>
              </Link>

              {/* Sign Out (Desktop) */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => signOut(auth)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-bold text-[#141413] dark:text-[#FAF8EC] bg-[#F3F0E0] dark:bg-[#1C1C1A] hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 border border-[#E5E1CE] dark:border-[#2E2E2A] transition-colors cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Sign Out</span>
              </motion.button>
            </div>
          </div>

          {/* Minimal Cobalt Scroll Progress Rule (GPU scaleX compositor-only) */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent overflow-hidden pointer-events-none">
            <div
              className="h-full w-full bg-[#0D47FF] dark:bg-[#ECD5FF] origin-left will-change-transform"
              style={{
                transform: `scaleX(${scrollProgress})`,
              }}
            />
          </div>
        </header>

        {/* Mobile Bottom Navigation Bar (Strictly aligned 5 columns, Sign Out in 5th slot) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#FAF8EC]/95 dark:bg-[#141413]/95 backdrop-blur-md border-t border-[#E5E1CE] dark:border-[#2E2E2A] pb-safe">
          <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-1">
            <Link
              to="/"
              className={`relative flex flex-col items-center justify-center h-full gap-1 text-center transition-colors ${
                location.pathname === '/'
                  ? 'text-[#0D47FF] dark:text-[#ECD5FF] font-extrabold'
                  : 'text-[#66665E] dark:text-[#A3A399] font-medium'
              }`}
            >
              {location.pathname === '/' && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  transition={SPRING_SNAPPY}
                  className="absolute top-0 w-8 h-[2.5px] rounded-full bg-[#0D47FF] dark:bg-[#ECD5FF]"
                />
              )}
              <Compass className="w-4 h-4" />
              <span className="text-[10px] leading-none">Dashboard</span>
            </Link>

            <Link
              to="/mistakes"
              className={`relative flex flex-col items-center justify-center h-full gap-1 text-center transition-colors ${
                location.pathname === '/mistakes'
                  ? 'text-[#0D47FF] dark:text-[#ECD5FF] font-extrabold'
                  : 'text-[#66665E] dark:text-[#A3A399] font-medium'
              }`}
            >
              {location.pathname === '/mistakes' && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  transition={SPRING_SNAPPY}
                  className="absolute top-0 w-8 h-[2.5px] rounded-full bg-[#0D47FF] dark:bg-[#ECD5FF]"
                />
              )}
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] leading-none">Mistakes</span>
            </Link>

            <Link
              to="/new"
              className="flex flex-col items-center justify-center h-full gap-1 text-center cursor-pointer"
              title="Start New Exam"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={SPRING_TACTILE}
                className="w-9 h-9 rounded-xl bg-[#0D47FF] border-[1.5px] border-[#141413] dark:border-[#FAF8EC] text-white flex items-center justify-center shadow-[2px_2px_0px_#141413] dark:shadow-[2px_2px_0px_#ECD5FF]"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </motion.div>
              <span
                className={`text-[10px] leading-none ${
                  isNewExamRoute
                    ? 'text-[#0D47FF] dark:text-[#ECD5FF] font-extrabold'
                    : 'text-[#141413] dark:text-[#FAF8EC] font-bold'
                }`}
              >
                New Exam
              </span>
            </Link>

            <Link
              to="/history"
              className={`relative flex flex-col items-center justify-center h-full gap-1 text-center transition-colors ${
                location.pathname === '/history'
                  ? 'text-[#0D47FF] dark:text-[#ECD5FF] font-extrabold'
                  : 'text-[#66665E] dark:text-[#A3A399] font-medium'
              }`}
            >
              {location.pathname === '/history' && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  transition={SPRING_SNAPPY}
                  className="absolute top-0 w-8 h-[2.5px] rounded-full bg-[#0D47FF] dark:bg-[#ECD5FF]"
                />
              )}
              <Clock className="w-4 h-4" />
              <span className="text-[10px] leading-none">Archive</span>
            </Link>

            <motion.button
              whileTap={{ scale: 0.93 }}
              type="button"
              onClick={() => signOut(auth)}
              className="flex flex-col items-center justify-center h-full gap-1 text-center text-[#66665E] dark:text-[#A3A399] hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[10px] leading-none">Sign Out</span>
            </motion.button>
          </div>
        </nav>

        {/* Signature Floating Dark Bottom Countdown Dock (Desktop only) */}
        <AnimatePresence>
          {!isNewExamRoute && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
              className="hidden lg:flex fixed bottom-5 left-1/2 -translate-x-1/2 z-40 items-center gap-4 pl-5 pr-2 py-2 rounded-full bg-[#141413] text-[#FAF8EC] border border-[#2E2E2A] dark:border-[#FAF8EC]/30 shadow-2xl"
            >
              <div className="flex items-center gap-2.5">
                <EqualizerBars barCount={5} colorClass="bg-[#ECD5FF]" heightClass="h-4" />
                <div className="leading-tight">
                  <span className="block font-mono text-[9px] uppercase tracking-widest text-[#A3A399]">
                    TARGET EXAM IN
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-white">
                    {countdownText}
                  </span>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/new"
                  className="px-4 py-2 rounded-full bg-[#ECD5FF] hover:bg-[#E1BEFF] text-[#141413] text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span>Start Exam</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 pt-20 sm:pt-24 pb-24 w-full relative">
          <AnimatePresence
            mode="wait"
            initial={false}
            onExitComplete={() => {
              if ((window as any).__lenis) {
                (window as any).__lenis.scrollTo(0, { immediate: true });
              } else {
                window.scrollTo(0, 0);
              }
            }}
          >
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 18, scale: 0.992 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
              className="w-full flex-1 will-change-transform"
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
