import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import {
  BookOpen,
  Heart,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Download,
  Sun,
  Moon,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  StationSignboard,
  DiagonalMarquee,
  OfficerLanyardPass,
  downloadOfficerPassSVG,
  PrizeBadgeIcon
} from '../components/SignatureGraphics';
import {
  EASE_OUT_EXPO,
  SPRING_BOUNCY,
  SPRING_SNAPPY,
  SPRING_BUTTERY,
  AnimatedNumber,
  MotionStaggerGrid,
  MotionStaggerItem
} from '../components/MotionPrimitives';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    return (
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
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

  const cleanErrorMessage = (msg: string) => {
    if (!msg) return 'Authentication failed. Please verify your credentials and try again.';
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
    if (msg.includes('auth/network-request-failed')) {
      return 'Network connection failed. Please check your internet connection and verify that firewall or ad-blockers are not blocking Firebase.';
    }
    if (msg.includes('auth/too-many-requests')) {
      return 'Access temporarily blocked due to multiple failed login attempts. Please reset password or wait a few minutes.';
    }
    if (msg.includes('auth/unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'rbi-grade-b-exam-engine-1.onrender.com';
      return `Domain not authorized yet. Add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
    }
    const cleaned = msg.replace(/^Firebase:\s*/i, '').replace(/\(auth\/[^)]+\)\.?/g, '').trim();
    if (!cleaned || cleaned.toLowerCase() === 'error' || cleaned.toLowerCase() === 'error.') {
      return 'Authentication failed. Please verify your email and password and try again.';
    }
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      console.error('Authentication attempt notice:', err);
      setError(cleanErrorMessage(err?.message || 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Enter your email address first to receive a password reset link.');
      return;
    }
    setError('');
    setNotice('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice(`Password reset link sent to ${email.trim()}.`);
    } catch (err: any) {
      setError(cleanErrorMessage(err?.message || 'Could not send reset email.'));
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setNotice('');
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

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const livePassName =
    candidateName.trim() ||
    (email.trim() ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Officer Candidate');

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] font-sans overflow-x-clip">
      {/* 1. CLEAN 3-ZONE TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 w-full bg-[#141413]/95 backdrop-blur-md text-[#FAF8EC] border-b border-[#2E2E2A]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Dual Brand Wordmark */}
          <button
            type="button"
            onClick={() => scrollToSection('portal-stage')}
            className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 cursor-pointer group text-left"
          >
            <span className="font-heading font-black text-xs sm:text-base lg:text-lg tracking-tight text-white whitespace-nowrap">
              RBI GRADE B
            </span>
            <span className="hidden sm:inline-flex md:hidden lg:inline-flex items-center gap-1.5 text-[#A3A399] text-sm">
              <span>×</span>
              <span className="inline-flex items-center gap-1.5 font-heading font-bold text-base lg:text-lg text-[#ECD5FF] whitespace-nowrap">
                <BookOpen className="w-4 h-4 text-[#ECD5FF] transition-transform group-hover:scale-110" />
                Engine
              </span>
            </span>
          </button>

          {/* Zone 2: Minimal Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-8 text-[11px] lg:text-xs font-mono uppercase tracking-wider lg:tracking-widest text-[#A3A399] shrink-0">
            <motion.button
              type="button"
              whileHover={{ y: -1.5, color: '#FFFFFF' }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_BOUNCY}
              onClick={() => scrollToSection('rounds-section')}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap py-1.5"
            >
              Rounds
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ y: -1.5, color: '#FFFFFF' }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_BOUNCY}
              onClick={() => scrollToSection('benchmarks-section')}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap py-1.5"
            >
              Benchmarks
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ y: -1.5, color: '#FFFFFF' }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_BOUNCY}
              onClick={() => scrollToSection('portal-stage')}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap py-1.5"
            >
              Officer Pass
            </motion.button>
          </nav>

          {/* Zone 3: Theme Switcher + Auth Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <motion.button
              whileHover={{ y: -1.5, scale: 1.06 }}
              whileTap={{ scale: 0.88, rotate: 20 }}
              transition={SPRING_BOUNCY}
              type="button"
              onClick={() => setIsDark(!isDark)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#2E2E2A] text-[#A3A399] hover:text-white hover:border-[#FAF8EC]/40 transition-colors cursor-pointer flex items-center justify-center shrink-0"
              aria-label="Toggle theme"
              title="Toggle Cream / Dark Canvas below"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#FFD426]" /> : <Moon className="w-4 h-4" />}
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_SNAPPY}
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError('');
                scrollToSection('portal-stage');
              }}
              className="text-xs sm:text-sm font-semibold text-[#FAF8EC] hover:text-white hover:bg-white/10 rounded-lg transition-colors px-2 sm:px-3 py-1.5 cursor-pointer whitespace-nowrap"
            >
              Log in
            </motion.button>

            <motion.button
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING_BOUNCY}
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError('');
                scrollToSection('portal-stage');
              }}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[#0D47FF] hover:bg-[#1954FF] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shadow-[2px_2px_0px_#000000]"
            >
              Start free
            </motion.button>
          </div>
        </div>
      </header>

      {/* 2. SIGNATURE DARK EDITORIAL AUTH STAGE + HANGING LAVENDER LANYARD PASS */}
      <section id="portal-stage" className="scroll-mt-20 w-full bg-[#141413] text-[#FAF8EC] border-b border-[#2E2E2A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-10 sm:pt-6 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* LEFT COLUMN: Editorial Headline + Form */}
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.68, ease: EASE_OUT_EXPO }}
              className="lg:col-span-7 pt-1 sm:pt-10 space-y-5 sm:space-y-6 will-change-transform"
            >
              <div className="space-y-3">
                <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#A3A399]">
                  {isLogin ? 'SIGN IN · OFFICER GATEWAY' : 'REGISTER · CYCLE 2026–27'}
                </span>
                <h1 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-[58px] tracking-tight leading-[1.06] text-white">
                  {isLogin ? 'Access your ' : 'Claim your '}
                  <span className="font-editorial-italic text-[#ECD5FF] font-normal">cadre.</span>
                </h1>
                <p className="text-sm sm:text-base text-[#A3A399] max-w-xl leading-relaxed">
                  Calibrated strictly to official RBI Grade B Phase I &amp; Phase II exam patterns.{' '}
                  <span className="text-[#FF9E44] font-semibold">
                    Live Dual-Track questions, PYQs &amp; AI descriptive rubrics.
                  </span>
                </p>
              </div>

              {/* Clean Segmented Switcher Tabs with layoutId */}
              <div className="inline-flex p-1 rounded-xl bg-[#1C1C1A] border border-[#2E2E2A] gap-1 relative">
                {[
                  { id: 'signin', label: 'Sign In', active: isLogin, val: true },
                  { id: 'create', label: 'Create Account', active: !isLogin, val: false }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    id={`login-tab-${tab.id}`}
                    onClick={() => {
                      setIsLogin(tab.val);
                      setError('');
                      setNotice('');
                    }}
                    className={`relative px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer z-10 ${
                      tab.active ? 'text-[#141413]' : 'text-[#A3A399] hover:text-white'
                    }`}
                  >
                    {tab.active && (
                      <motion.span
                        layoutId="login-auth-tab"
                        transition={SPRING_SNAPPY}
                        className="absolute inset-0 rounded-lg bg-[#ECD5FF] -z-10"
                      />
                    )}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Auth Form */}
              <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Optional Live Pass Name Preview Input / Or Officer Name on Register */}
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#A3A399]">
                      Name on Pass
                    </label>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="Officer Ayush"
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-lg bg-[#1C1C1A] border border-[#2E2E2A] text-sm text-white placeholder-[#66665E] focus:outline-none focus:border-[#ECD5FF] transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#A3A399]">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#66665E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        required
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-lg bg-[#1C1C1A] border border-[#2E2E2A] text-sm text-white placeholder-[#66665E] focus:outline-none focus:border-[#ECD5FF] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#A3A399]">
                      Password
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        className="text-[11px] text-[#ECD5FF] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#66665E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full min-h-[46px] pl-10 pr-11 py-2.5 rounded-lg bg-[#1C1C1A] border border-[#2E2E2A] text-sm text-white placeholder-[#66665E] focus:outline-none focus:border-[#ECD5FF] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 px-3.5 flex items-center text-[#A3A399] hover:text-white cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error & Notice Banners */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2"
                    >
                      <span className="font-bold">!</span>
                      <span>{error}</span>
                    </motion.div>
                  )}
                  {notice && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{notice}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary Action Row: Cobalt Blue CTA + Download Pass + Google SSO */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    transition={SPRING_SNAPPY}
                    className="flex-1 sm:flex-initial min-h-[44px] px-5 sm:px-6 py-3 rounded-lg bg-[#0D47FF] hover:bg-[#1954FF] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <span>
                      {loading
                        ? 'Authenticating...'
                        : isLogin
                          ? 'Access Simulator'
                          : 'Register to claim'}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => downloadOfficerPassSVG(livePassName, 'General', '0389')}
                    className="min-h-[44px] px-4 py-3 rounded-lg border-b border-[#FAF8EC]/40 hover:border-white text-xs sm:text-sm font-medium text-[#FAF8EC] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Download pass</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full sm:w-auto sm:ml-auto min-h-[44px] px-4 py-3 rounded-lg bg-[#1C1C1A] hover:bg-[#242421] border border-[#2E2E2A] text-xs sm:text-sm font-semibold text-white inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Google SSO</span>
                  </motion.button>
                </div>
              </form>
            </motion.div>

            {/* RIGHT COLUMN: Hanging Soft Lavender Officer Pass Card */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end -mt-2 sm:-mt-6 lg:-mt-10 relative">
              <motion.div
                aria-hidden="true"
                animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.22, 0.4, 0.22] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute top-14 w-72 h-72 rounded-full bg-[#ECD5FF]/20 blur-3xl"
              />
              <div className="relative z-10">
                <OfficerLanyardPass
                  name={livePassName}
                  stream="General"
                  passNumber="0389"
                  subtitle="Reserve Bank Aspirant"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. STATION SIGNBOARDS: THREE-STAGE EXAMINATION ARCHITECTURE */}
      <section
        id="rounds-section"
        className="scroll-mt-20 w-full bg-[#FAF8EC] dark:bg-[#1C1C1A] text-[#141413] dark:text-[#FAF8EC] py-10 sm:py-20 border-b border-[#E5E1CE] dark:border-[#2E2E2A]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8 sm:space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.05 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className="max-w-2xl space-y-2"
          >
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
              EXAMINATION ARCHITECTURE · CYCLE 2026–27
            </span>
            <h2 className="font-heading font-black text-3xl sm:text-4xl tracking-tight">
              Three stages from prelims to{' '}
              <span className="font-editorial-italic text-[#0D47FF] dark:text-[#ECD5FF]">appointment.</span>
            </h2>
          </motion.div>

          <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {/* Stage 1 */}
            <MotionStaggerItem className="space-y-5">
              <StationSignboard title="PHASE I" subtitle="PF 1 · ONLINE PRELIMS" variant={1} />
              <div className="pt-4 border-t border-[#141413]/20 dark:border-[#FAF8EC]/20 space-y-3">
                <h3 className="font-heading font-black text-lg">
                  Phase 1 · Objective Qualifying
                </h3>
                <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] leading-relaxed">
                  200 Marks across 120 minutes with strict sectional windows and 1/4th (-0.25) negative marking calibration.
                </p>
                <div className="pt-2 space-y-2 text-xs">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                    SECTIONAL BLUEPRINT
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#ECD5FF] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">80 Qs</span>
                    <span>General Awareness (25m)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#ECD5FF] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">60 Qs</span>
                    <span>Reasoning Ability (45m)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#ECD5FF] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">30+30</span>
                    <span>Quant &amp; English (50m)</span>
                  </div>
                </div>
              </div>
            </MotionStaggerItem>

            {/* Stage 2 */}
            <MotionStaggerItem className="space-y-5">
              <StationSignboard title="PHASE II" subtitle="PF 2 · MAINS SELECTION" variant={2} />
              <div className="pt-4 border-t border-[#141413]/20 dark:border-[#FAF8EC]/20 space-y-3">
                <h3 className="font-heading font-black text-lg">
                  Phase 2 · ESI, English &amp; FM
                </h3>
                <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] leading-relaxed">
                  300 Marks combining objective MCQs and typed descriptive answers benchmarked against official PYQs.
                </p>
                <div className="pt-2 space-y-2 text-xs">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                    MERIT PAPERS
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#FFD426] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">100 M</span>
                    <span>Paper I: Economic &amp; Social Issues</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#FFD426] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">100 M</span>
                    <span>Paper II: English Descriptive Writing</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#FFD426] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">100 M</span>
                    <span>Paper III: Finance &amp; Management</span>
                  </div>
                </div>
              </div>
            </MotionStaggerItem>

            {/* Stage 3 */}
            <MotionStaggerItem className="space-y-5">
              <StationSignboard title="FINALE" subtitle="PF 3 · CENTRAL BOARD" variant={3} />
              <div className="pt-4 border-t border-[#141413]/20 dark:border-[#FAF8EC]/20 space-y-3">
                <h3 className="font-heading font-black text-lg">
                  Stage 3 · Interview &amp; Merit
                </h3>
                <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] leading-relaxed">
                  Comprehensive 375-Mark final merit calibration merging Phase II scores with central banking analytical readiness.
                </p>
                <div className="pt-2 space-y-2 text-xs">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                    FINAL SELECTION
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#0D47FF] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">75 M</span>
                    <span>Personality &amp; RBI Board Viva</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 bg-[#0D47FF] border border-[#141413] shrink-0" />
                    <span className="font-mono font-bold tabular-nums">375 M</span>
                    <span>Final All-India Cadre Merit List</span>
                  </div>
                </div>
              </div>
            </MotionStaggerItem>
          </MotionStaggerGrid>
        </div>
      </section>

      {/* 4. CRISSCROSSING DIAGONAL TICKER MARQUEE */}
      <DiagonalMarquee />

      {/* 5. HIGHLIGHTED BENCHMARK CARDS + SOFT LAVENDER CALLOUT STRIP */}
      <section
        id="benchmarks-section"
        className="scroll-mt-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-14 space-y-4 sm:space-y-5"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
          className="text-center space-y-2 mb-6"
        >
          <div className="font-heading font-black text-3xl sm:text-4xl tracking-tight tabular-nums">
            <AnimatedNumber value={575} />{' '}
            <span className="font-medium text-[#66665E] dark:text-[#A3A399] text-xl sm:text-3xl">
              total syllabus marks calibrated
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] max-w-xl mx-auto">
            Dual-track synthesis combining RBI static PYQs with verified recent macroeconomic and banking circulars.
          </p>
        </motion.div>

        <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {/* Card 1 */}
          <MotionStaggerItem className="h-full">
            <motion.div
              whileHover={{ y: -7, scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_BOUNCY}
              className="h-full rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] ink-card-featured p-5 sm:p-6 flex flex-col justify-between transition-shadow hover:shadow-[6px_6px_0px_#141413] dark:hover:shadow-[6px_6px_0px_#ECD5FF] will-change-transform group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block font-mono text-[11px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                    DUAL-TRACK ENGINE
                  </span>
                  <div className="font-heading font-black text-2xl sm:text-3xl tracking-tight leading-tight mt-1.5">
                    Static + Dynamic
                  </div>
                </div>
                <PrizeBadgeIcon type="trophy" />
              </div>
              <div className="mt-6 pt-3.5 border-t border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#66665E] dark:text-[#A3A399] leading-relaxed">
                ✓ Exact RBI Act 1934 &amp; recent 2024–26 circulars in GA, ESI &amp; FM
              </div>
            </motion.div>
          </MotionStaggerItem>

          {/* Card 2 */}
          <MotionStaggerItem className="h-full">
            <motion.div
              whileHover={{ y: -7, scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_BOUNCY}
              className="h-full rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] ink-card-featured p-5 sm:p-6 flex flex-col justify-between transition-shadow hover:shadow-[6px_6px_0px_#141413] dark:hover:shadow-[6px_6px_0px_#ECD5FF] will-change-transform group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block font-mono text-[11px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                    SPACED REPETITION
                  </span>
                  <div className="font-heading font-black text-2xl sm:text-3xl tracking-tight leading-tight mt-1.5">
                    5-Stage Leitner
                  </div>
                </div>
                <PrizeBadgeIcon type="medal2" />
              </div>
              <div className="mt-6 pt-3.5 border-t border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#66665E] dark:text-[#A3A399] leading-relaxed">
                ✓ Automated Mistake Notebook synced across devices
              </div>
            </motion.div>
          </MotionStaggerItem>

          {/* Card 3 */}
          <MotionStaggerItem className="h-full">
            <motion.div
              whileHover={{ y: -7, scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_BOUNCY}
              className="h-full rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] ink-card-featured p-5 sm:p-6 flex flex-col justify-between transition-shadow hover:shadow-[6px_6px_0px_#141413] dark:hover:shadow-[6px_6px_0px_#ECD5FF] will-change-transform group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block font-mono text-[11px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                    PHASE II RUBRICS
                  </span>
                  <div className="font-heading font-black text-2xl sm:text-3xl tracking-tight leading-tight mt-1.5">
                    AI Descriptive
                  </div>
                </div>
                <PrizeBadgeIcon type="medal3" />
              </div>
              <div className="mt-6 pt-3.5 border-t border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#66665E] dark:text-[#A3A399] leading-relaxed">
                ✓ Dimension-by-dimension RBI grading &amp; model answers
              </div>
            </motion.div>
          </MotionStaggerItem>
        </MotionStaggerGrid>

        {/* Wide Soft Lavender Highlight Strip */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          whileHover={{ y: -2 }}
          transition={SPRING_SNAPPY}
          className="rounded-2xl bg-[#ECD5FF] border-[1.5px] border-[#141413] text-[#141413] px-5 sm:px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[3px_3px_0px_#141413]"
        >
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <span className="font-heading font-black">Upload any study notes or circulars</span>
            <span className="text-[#141413]/75">PDFs, DOCX, images or pick any official syllabus chapter</span>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection('portal-stage')}
            className="text-xs font-bold underline underline-offset-4 hover:text-[#0D47FF] text-left sm:text-right shrink-0 cursor-pointer group inline-flex items-center gap-1"
          >
            <span>✓ Sign in above to begin</span>
            <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </motion.div>
      </section>

      {/* 6. CLEAN EDITORIAL FOOTER */}
      <footer className="mt-auto w-full border-t border-[#E5E1CE] dark:border-[#2E2E2A] py-5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#66665E] dark:text-[#A3A399]">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <ShieldCheck className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
            <span>&copy; {new Date().getFullYear()} RBI Grade B Engine · Officer Preparation Workspace</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <span>Made with</span>
            <motion.span
              animate={{ scale: [1, 1.22, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            </motion.span>
            <span className="font-heading font-bold text-[#141413] dark:text-white">Ayush</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
