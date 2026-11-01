import React from 'react';

export function AtmosphericBackground() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 transform-gpu will-change-transform select-none"
      aria-hidden="true"
    >
      {/* 1. Top-Left Vibrant Teal-Green & Emerald Mint Nebula */}
      <div 
        className="absolute -top-[12%] -left-[10%] w-[65vw] h-[65vw] max-w-[850px] max-h-[850px] rounded-full bg-gradient-to-tr from-teal-500/20 via-emerald-500/18 to-cyan-500/15 dark:from-teal-500/30 dark:via-emerald-500/25 dark:to-cyan-400/20 blur-[120px] sm:blur-[140px] animate-pulse" 
        style={{ animationDuration: '9s' }} 
      />
      
      {/* 2. Mid-Right Radiant Electric Cyan, Teal & Indigo Nebula */}
      <div 
        className="absolute top-[20%] right-[-10%] w-[55vw] h-[55vw] max-w-[750px] max-h-[750px] rounded-full bg-gradient-to-bl from-cyan-500/18 via-teal-500/15 to-indigo-600/20 dark:from-cyan-400/25 dark:via-teal-500/25 dark:to-indigo-500/35 blur-[130px] sm:blur-[160px]" 
      />
      
      {/* 3. Bottom-Left Deep Oceanic Azure, Indigo & Teal Nebula */}
      <div 
        className="absolute -bottom-[15%] left-[25%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-t from-indigo-600/15 via-teal-600/15 to-cyan-500/12 dark:from-indigo-600/30 dark:via-teal-600/25 dark:to-cyan-400/20 blur-[130px] sm:blur-[160px]" 
      />

      {/* 4. Dynamic Dark Mode Top Aurora Beam */}
      <div className="hidden dark:block absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-teal-500/18 via-cyan-500/12 to-transparent blur-2xl opacity-60" />

      {/* 5. Cybernetic Micro-Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(13,148,136,0.12)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(45,212,191,0.15)_1px,transparent_1px)] [background-size:28px_28px] sm:[background-size:32px_32px] opacity-70 dark:opacity-40" />
    </div>
  );
}
