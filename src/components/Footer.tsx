import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  Heart, 
  ArrowUp, 
  ShieldCheck, 
  Sparkles, 
  Activity, 
  Radio, 
  Terminal, 
  Cpu, 
  Compass, 
  Layers
} from 'lucide-react';

export function Footer() {
  const [istTime, setIstTime] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Live IST Clock (UTC + 5:30) for RBI Aspirants
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
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).__lenis) {
        (window as any).__lenis.scrollTo(0, { duration: 1.2 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const copySystemTelemetry = () => {
    const info = `RBI-ENGINE // CYCLE: 2026-27 // HOST: CLOUD-EDGE // AUTHOR: AYUSH // TIME: ${istTime} IST`;
    navigator.clipboard.writeText(info).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <footer className="mt-auto relative z-20 border-t border-slate-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-[#060812]/90 backdrop-blur-3xl text-slate-700 dark:text-slate-300 overflow-hidden select-none transition-colors duration-300 pb-16 md:pb-0">
      
      {/* Laser-Thin Atmospheric Gradient Hairline */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#9A7D3C]/60 to-transparent opacity-80" />
      
      {/* Ambient Radial Spotlight (Futuristic Glow without CSS sludge) */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[120px] bg-gradient-to-b from-[#9A7D3C]/10 to-transparent blur-3xl opacity-50 dark:opacity-20" />

      {/* Futuristic Telemetry HUD Bar */}
      <div className="border-b border-slate-200/60 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.015] px-4 sm:px-8 py-2.5 text-[11px] font-mono tracking-wider">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold tracking-wide">SYSTEM: ONLINE</span>
            </div>
            
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            
            <div className="hidden sm:flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#9A7D3C]" />
              <span>CORE v2.6.4-RBI</span>
            </div>

            <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>

            <div className="hidden md:flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>LATENCY: 8ms</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200 font-medium">
              <Activity className="w-3 h-3 text-[#9A7D3C]" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">IST:</span>
              <span className="tabular-nums font-bold text-[#9A7D3C] dark:text-[#cbb070]">{istTime || '00:00:00'}</span>
            </div>

            <button
              onClick={copySystemTelemetry}
              className="text-[10px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title="Copy telemetry fingerprint"
            >
              <Terminal className="w-3 h-3" />
              <span>{isCopied ? 'TELEMETRY COPIED' : 'FINGERPRINT'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Structural Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 pb-10 border-b border-slate-200/80 dark:border-white/[0.06]">
          
          {/* Column 1: Monolith Brand & High-Tech Mission */}
          <div className="md:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-white via-slate-100 to-slate-200 dark:from-white/10 dark:via-white/[0.05] dark:to-transparent border border-slate-200 dark:border-white/15 flex items-center justify-center text-[#9A7D3C] shadow-sm group-hover:scale-105 group-hover:border-[#9A7D3C]/50 transition-all duration-300">
                <BookOpen className="w-5 h-5" />
                <div className="absolute -inset-0.5 rounded-2xl bg-[#9A7D3C]/20 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none flex items-center gap-1.5">
                  RBI Grade B <span className="text-[#9A7D3C] dark:text-[#d3ba7e]">Engine</span>
                </span>
                <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500 dark:text-slate-400 mt-1">
                  OFFICER PREPARATION CADRE &bull; CYCLE 2026-27
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
              Next-generation simulation architecture specifically calibrated for the Reserve Bank of India Officer Phase I &amp; Phase II examinations. Rigorous negative penalty calculation, adaptive difficulty grading, and instantaneous percentile analytics.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#9A7D3C]/10 border border-[#9A7D3C]/20 text-[#9A7D3C] dark:text-[#e4cf9b] font-mono text-[11px] font-medium">
                <Compass className="w-3.5 h-3.5" />
                <span>IBPS / RBI ENGINE PROTOCOL</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>PHASE I &amp; II SYNCED</span>
              </div>
            </div>
          </div>

          {/* Column 2: Cyber-Nav Array */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9A7D3C]" />
              COMMAND ARRAY
            </h4>
            
            <ul className="space-y-2.5 text-xs sm:text-sm">
              {[
                { name: 'Candidate Dashboard', path: '/', tag: '01' },
                { name: 'Custom Test Simulator', path: '/new', tag: '02' },
                { name: 'Performance Analytics', path: '/history', tag: '03' },
              ].map((link) => (
                <li key={link.path}>
                  <Link 
                    to={link.path}
                    className="group flex items-center justify-between p-2 -mx-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-all duration-200 border border-transparent hover:border-slate-200/80 dark:hover:border-white/10"
                  >
                    <span className="font-medium group-hover:translate-x-1 transition-transform duration-200">
                      {link.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-600 group-hover:text-[#9A7D3C] transition-colors">
                      [{link.tag}]
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Syllabus Matrix Modules */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A7D3C]" />
                SYLLABUS MATRIX
              </h4>
              <span className="text-[10px] font-mono text-[#9A7D3C] font-semibold">100% COVERAGE</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'General Awareness', weight: '80 Qs' },
                { label: 'Quantitative Aptitude', weight: '30 Qs' },
                { label: 'Reasoning Ability', weight: '60 Qs' },
                { label: 'English Language', weight: '30 Qs' },
                { label: 'Phase II: ESI', weight: 'Paper I' },
                { label: 'Phase II: Finance & Mgmt', weight: 'Paper II' },
              ].map((item) => (
                <div 
                  key={item.label}
                  className="group p-2 rounded-xl bg-slate-100/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] hover:border-[#9A7D3C]/40 dark:hover:border-[#9A7D3C]/40 transition-all duration-200"
                >
                  <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.label}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 group-hover:text-[#9A7D3C] transition-colors">
                    {item.weight}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 pt-1 flex items-center justify-between">
              <span>PENALTY RULE: 1/4th (0.25) NEGATIVE</span>
              <span>SECTIONAL TIMING: ACTIVE</span>
            </div>
          </div>

        </div>

        {/* Futuristic Deck Bar: Ayush Signature & Aerospace Elevate Button */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          
          {/* Security & Verification Check */}
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">&copy; {new Date().getFullYear()} RBI Grade B Engine.</span>
              <span className="hidden sm:inline text-slate-500 dark:text-slate-500"> All intellectual blueprints secured.</span>
            </div>
          </div>

          {/* Futuristic Centerpiece: Made with Love Ayush Capsule */}
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#9A7D3C]/30 via-rose-500/20 to-[#9A7D3C]/30 blur-md opacity-30 group-hover:opacity-75 transition-opacity duration-500" />
            
            <div className="relative flex items-center gap-2.5 px-4 sm:px-5 py-2 rounded-full bg-white/90 dark:bg-white/[0.05] border border-slate-200/90 dark:border-white/15 backdrop-blur-2xl shadow-sm text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#9A7D3C]/50 transition-all duration-300">
              <span className="font-mono text-[10px] tracking-widest text-[#9A7D3C] uppercase font-bold">CREATOR</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="tracking-tight text-slate-600 dark:text-slate-300">Made with Love</span>
              <div className="relative flex items-center justify-center">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
              </div>
              <span className="font-serif font-black tracking-wide text-slate-900 dark:text-white bg-gradient-to-r from-[#9A7D3C] to-[#d4bc82] bg-clip-text text-transparent">
                Ayush
              </span>
            </div>
          </div>

          {/* Aerospace Elevation Thruster (Scroll to Top) */}
          <div className="flex items-center gap-3">
            <button
              onClick={scrollToTop}
              className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.08] hover:border-[#9A7D3C]/40 transition-all duration-200 cursor-pointer shadow-xs"
              title="Ascend to top of viewport"
              aria-label="Back to top"
            >
              <span className="text-[10px] tracking-wider uppercase font-semibold">TOP</span>
              <div className="w-5 h-5 rounded-full bg-slate-200/70 dark:bg-white/10 flex items-center justify-center group-hover:-translate-y-0.5 transition-transform duration-200">
                <ArrowUp className="w-3 h-3 text-slate-700 dark:text-slate-200 group-hover:text-[#9A7D3C]" />
              </div>
            </button>
          </div>

        </div>

      </div>
    </footer>
  );
}
