import React from 'react';

export function AtmosphericBackground() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 transform-gpu will-change-transform select-none"
      aria-hidden="true"
    >
      {/* 1. Top-Left Vibrant Gold & Emerald Nebula */}
      <div 
        className="absolute -top-[12%] -left-[10%] w-[65vw] h-[65vw] max-w-[850px] max-h-[850px] rounded-full bg-gradient-to-tr from-[#9A7D3C]/25 via-amber-500/20 to-emerald-500/15 dark:from-[#9A7D3C]/40 dark:via-amber-500/30 dark:to-emerald-500/25 blur-[120px] sm:blur-[140px] animate-pulse" 
        style={{ animationDuration: '9s' }} 
      />
      
      {/* 2. Mid-Right Radiant Emerald, Cyan & Indigo Nebula */}
      <div 
        className="absolute top-[20%] right-[-10%] w-[55vw] h-[55vw] max-w-[750px] max-h-[750px] rounded-full bg-gradient-to-bl from-emerald-500/20 via-teal-500/15 to-indigo-600/20 dark:from-emerald-400/30 dark:via-cyan-500/25 dark:to-indigo-500/35 blur-[130px] sm:blur-[160px]" 
      />
      
      {/* 3. Bottom-Left/Center Deep Sky, Violet & Rose Nebula */}
      <div 
        className="absolute -bottom-[15%] left-[25%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-t from-sky-500/15 via-purple-500/15 to-rose-500/10 dark:from-indigo-600/30 dark:via-purple-600/25 dark:to-rose-500/20 blur-[130px] sm:blur-[160px]" 
      />

      {/* 4. Dynamic Dark Mode Top Aurora Beam */}
      <div className="hidden dark:block absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-[#9A7D3C]/15 via-indigo-500/10 to-transparent blur-2xl opacity-60" />

      {/* 5. Cybernetic Micro-Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(154,125,60,0.15)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(217,178,89,0.18)_1px,transparent_1px)] [background-size:28px_28px] sm:[background-size:32px_32px] opacity-70 dark:opacity-40" />
    </div>
  );
}
