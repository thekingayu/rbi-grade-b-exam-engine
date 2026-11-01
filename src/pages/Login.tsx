import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { auth } from '../firebase';
import { 
  BookOpen, 
  Heart, 
  Sparkles, 
  ShieldCheck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  Radio, 
  Activity, 
  Sun, 
  Moon, 
  Layers,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AtmosphericBackground } from '../components/AtmosphericBackground';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [istTime, setIstTime] = useState('');
  
  // Theme state for login view
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      setIstTime(new Intl.DateTimeFormat('en-GB', options).format(now));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const cleanErrorMessage = (msg: string) => {
    if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
      return 'Invalid email or password. Please verify your credentials.';
    }
    if (msg.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (msg.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (msg.includes('auth/popup-closed-by-user')) {
      return 'Google sign-in popup was closed before completing.';
    }
    return msg.replace('Firebase: ', '').replace(/\(auth\/[^)]+\)\.?/, '').trim() || 'Authentication failed. Please retry.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(cleanErrorMessage(err.message || 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(cleanErrorMessage(err.message || 'Google authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#030612] text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden select-none font-sans">
      
      {/* 1. Futuristic Colorful Atmospheric Glow Canvas */}
      <AtmosphericBackground />

      {/* 2. Top Precision Header Bar */}
      <header className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-[#9A7D3C] via-amber-500 to-emerald-600 p-[1.5px] shadow-lg shadow-[#9A7D3C]/15">
            <div className="w-full h-full rounded-2xl bg-white dark:bg-[#070B18] flex items-center justify-center text-[#9A7D3C] dark:text-[#E5C378]">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              RBI Grade B <span className="bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-500 dark:from-[#E5C378] dark:via-amber-300 dark:to-emerald-400 bg-clip-text text-transparent">Engine</span>
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase text-slate-500 dark:text-slate-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>OFFICER CADRE // CYCLE 2026-27</span>
            </div>
          </div>
        </div>

        {/* Top Controls: IST Clock + Theme Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-xs text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-[#9A7D3C] dark:text-[#E5C378]" />
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">IST:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-[11px]">{istTime || '12:00:00'}</span>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2.5 rounded-xl bg-white/70 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-[#9A7D3C]/50 dark:hover:border-amber-400/50 transition-all cursor-pointer backdrop-blur-md shadow-xs"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </header>

      {/* 3. Main Centerpiece: Dual-Column Futuristic Composition With Right-Aligned Login Card */}
      <main className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-8 lg:py-10 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-16 items-center">
          
          {/* LEFT COLUMN: Artistic, Creative, Colorful Engine Showcase */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left order-2 lg:order-1">
            
            {/* Holographic Badge with Gradient Border */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-[#9A7D3C]/15 via-amber-500/10 to-emerald-500/15 dark:from-[#9A7D3C]/30 dark:via-amber-500/20 dark:to-emerald-500/20 border border-[#9A7D3C]/30 dark:border-amber-500/30 backdrop-blur-xl shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#9A7D3C] dark:text-amber-400 animate-pulse" />
              <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider uppercase text-slate-800 dark:text-amber-200">
                Next-Gen RBI Officer Simulator
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono rounded-full bg-gradient-to-r from-[#9A7D3C] to-amber-600 text-white font-bold">
                PRO 2026
              </span>
            </motion.div>

            {/* Display Headline with Vibrant Dark-Mode Gradient */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-3"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[50px] xl:text-[56px] font-serif font-black tracking-tight leading-[1.08] text-slate-900 dark:text-white">
                Master the Exam with <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-500 dark:from-[#F3E5AB] dark:via-amber-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(245,158,11,0.2)]">
                  Intelligent Simulation
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed font-normal">
                Calibrated to exact Reserve Bank of India standards. Experience adaptive sectional time-banks, 1/4th negative penalty scoring, and full-spectrum Phase I &amp; Phase II analytics.
              </p>
            </motion.div>

            {/* Futuristic Holographic Cards Array (Vibrant Neon Gradient Accents in Dark Mode) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl"
            >
              {/* Card 1: Phase I Mastery (Amber/Gold Radiant Glow) */}
              <div className="relative group p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#070B19]/70 border border-slate-200/80 dark:border-amber-500/20 backdrop-blur-xl hover:border-amber-500/50 dark:hover:border-amber-400/50 transition-all duration-300 shadow-sm dark:shadow-[0_0_20px_-5px_rgba(245,158,11,0.15)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    <Compass className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20">
                    PHASE I &bull; 200 MARKS
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Full Pattern Simulation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  GA (80Q), Reasoning (60Q), Quants (30Q), &amp; English (30Q) with strict sectional timings.
                </p>
              </div>

              {/* Card 2: Phase II ESI & FM (Emerald Radiant Glow) */}
              <div className="relative group p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#070B19]/70 border border-slate-200/80 dark:border-emerald-500/20 backdrop-blur-xl hover:border-emerald-500/50 dark:hover:border-emerald-400/50 transition-all duration-300 shadow-sm dark:shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                    PHASE II &bull; 300 MARKS
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">ESI &amp; FM Subject Depth</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Economic &amp; Social Issues, Finance, Management &amp; Descriptive answer frameworks.
                </p>
              </div>

              {/* Card 3: Real-Time Telemetry (Cyan/Electric Blue Glow) */}
              <div className="relative group p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#070B19]/70 border border-slate-200/80 dark:border-cyan-500/20 backdrop-blur-xl hover:border-cyan-500/50 dark:hover:border-cyan-400/50 transition-all duration-300 shadow-sm dark:shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-semibold border border-cyan-500/20">
                    ACCURACY RADAR
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Precision Score Analytics</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Detailed cut-off projections, sectional performance tracking, and negative penalty analysis.
                </p>
              </div>

              {/* Card 4: Security & Compliance (Fuchsia/Violet Glow) */}
              <div className="relative group p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#070B19]/70 border border-slate-200/80 dark:border-purple-500/20 backdrop-blur-xl hover:border-purple-500/50 dark:hover:border-purple-400/50 transition-all duration-300 shadow-sm dark:shadow-[0_0_20px_-5px_rgba(168,85,247,0.15)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20">
                    IBPS ENGINE CLONE
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Exam Hall Fidelity</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Authentic question palette layout, review tagging, and instant answer persistence.
                </p>
              </div>
            </motion.div>

            {/* Quick Feature Checklist Pills */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap items-center gap-3 pt-2 text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Instant Result Review</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Unlimited Mock Attempts</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Cross-Device Responsive</span>
              </div>
            </motion.div>

          </div>

          {/* RIGHT COLUMN: Right-Aligned Futuristic Portal with Radiant Gradient Frame in Dark Mode */}
          <div className="lg:col-span-5 w-full flex justify-center lg:justify-end items-center order-1 lg:order-2">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md lg:max-w-[420px] xl:max-w-[460px] relative lg:ml-auto"
            >
              
              {/* Atmospheric Gradient Halo in Dark Mode */}
              <div className="absolute -inset-1.5 sm:-inset-2 rounded-[32px] bg-gradient-to-tr from-[#9A7D3C] via-amber-500/40 via-emerald-500/40 to-indigo-600/50 blur-xl dark:blur-2xl opacity-40 dark:opacity-75 pointer-events-none" />
              
              {/* Outer Radiant Gradient Border Frame */}
              <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-b from-slate-200 via-[#9A7D3C]/30 to-slate-200 dark:from-amber-400/50 dark:via-emerald-400/40 dark:to-indigo-500/50 shadow-2xl dark:shadow-[0_0_50px_-10px_rgba(154,125,60,0.3)]">
                
                <div className="rounded-[23px] bg-white/95 dark:bg-[#070B18]/95 backdrop-blur-3xl p-5 sm:p-7 md:p-8 space-y-5 sm:space-y-6">
                  
                  {/* Portal Header */}
                  <div className="space-y-1.5 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-1">
                      <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                      <span>SECURE CANDIDATE PORTAL</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif font-black text-slate-900 dark:text-white tracking-tight">
                      {isLogin ? 'Welcome Back' : 'Create Candidate Account'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isLogin ? 'Sign in to resume your active exam preparation' : 'Register to unlock tailored mock test engines'}
                    </p>
                  </div>

                  {/* Animated Switcher Tabs with High-Contrast Indicator */}
                  <div className="relative p-1 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 text-xs font-semibold">
                    <button
                      type="button"
                      id="login-tab-signin"
                      onClick={() => { setIsLogin(true); setError(''); }}
                      className={`relative z-10 py-2.5 rounded-lg transition-colors duration-200 cursor-pointer min-h-[40px] flex items-center justify-center ${
                        isLogin 
                          ? 'text-slate-900 dark:text-amber-300 font-bold' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      id="login-tab-create"
                      onClick={() => { setIsLogin(false); setError(''); }}
                      className={`relative z-10 py-2.5 rounded-lg transition-colors duration-200 cursor-pointer min-h-[40px] flex items-center justify-center ${
                        !isLogin 
                          ? 'text-slate-900 dark:text-amber-300 font-bold' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                      }`}
                    >
                      Create Account
                    </button>
                    
                    {/* Sliding Pill Indicator with High Contrast in Both Modes */}
                    <motion.div
                      className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-[#151D2F] shadow-sm border border-slate-200/80 dark:border-amber-400/40 dark:shadow-[0_0_12px_rgba(245,158,11,0.25)] pointer-events-none"
                      initial={false}
                      animate={{
                        left: isLogin ? '4px' : '50%',
                        width: 'calc(50% - 4px)',
                      }}
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  </div>

                  {/* Form Inputs */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="candidate@rbi-aspirant.org"
                          required
                          className="w-full min-h-[46px] pl-10 pr-4 py-2.5 bg-slate-50/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#9A7D3C] dark:focus:border-amber-400 focus:ring-2 focus:ring-[#9A7D3C]/20 dark:focus:ring-amber-400/20 transition-all"
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Password
                        </label>
                        {isLogin && (
                          <span className="text-[11px] text-[#9A7D3C] dark:text-[#E5C378] hover:underline cursor-pointer">
                            Forgot password?
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          required
                          className="w-full min-h-[46px] pl-10 pr-10 py-2.5 bg-slate-50/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#9A7D3C] dark:focus:border-amber-400 focus:ring-2 focus:ring-[#9A7D3C]/20 dark:focus:ring-amber-400/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer min-h-[44px] min-w-[44px] justify-center"
                          title={showPassword ? 'Hide password' : 'Show password'}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Error Banner */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -6, height: 0 }}
                          className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2"
                        >
                          <span className="font-bold shrink-0">!</span>
                          <span>{error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Primary Submit Button with Radiant Gradient */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="relative group w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-[#9A7D3C] via-amber-500 to-emerald-600 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-[#9A7D3C]/30 dark:shadow-[0_0_25px_rgba(245,158,11,0.25)] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/25 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out" />
                      <span>
                        {loading 
                          ? 'Authenticating...' 
                          : isLogin ? 'Access Simulator' : 'Initialize Account'}
                      </span>
                      {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                    </button>

                  </form>

                  {/* Divider */}
                  <div className="relative my-3 sm:my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200/80 dark:border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-[10px] sm:text-[11px] uppercase tracking-wider font-mono">
                      <span className="px-3 bg-white/95 dark:bg-[#070B18] text-slate-400">
                        OR SECURE SSO
                      </span>
                    </div>
                  </div>

                  {/* Google Sign In Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all duration-200 flex items-center justify-center gap-3 shadow-xs cursor-pointer disabled:opacity-70"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  {/* Footer Signature Inside Portal */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      <span>Made with Love</span>
                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                      <span className="font-bold text-slate-900 dark:text-white">Ayush</span>
                    </div>
                  </div>

                </div>
              </div>

            </motion.div>
          </div>

        </div>
      </main>

      {/* 4. Bottom System Bar */}
      <footer className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-5 border-t border-slate-200/60 dark:border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#9A7D3C] dark:text-amber-400" />
          <span>&copy; {new Date().getFullYear()} RBI Grade B Engine &bull; Official Cadre Preparation Standard</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            256-BIT TLS ENCRYPTION
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
          <span className="text-[#9A7D3C] dark:text-amber-400 font-semibold">CANDIDATE GATEWAY ONLINE</span>
        </div>
      </footer>

    </div>
  );
}
