import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { EASE_OUT_EXPO, SPRING_SNAPPY, SPRING_BUTTERY, SPRING_BOUNCY } from './MotionPrimitives';

/**
 * 1. Station Signboard + Architectural Skyline Line Art
 * Animated yellow platform signboards (PF 1 / PF 2 / PF 3) with full skyline & rail motion.
 */
export function StationSignboard({
  title,
  subtitle,
  variant = 1
}: {
  title: string;
  subtitle: string;
  variant?: 1 | 2 | 3;
}) {
  const baseDelay = (variant - 1) * 0.08;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ ...SPRING_BOUNCY, delay: baseDelay, opacity: { duration: 0.24, delay: baseDelay } }}
      whileHover="hovered"
      whileTap={{ scale: 0.98 }}
      className="relative w-full pt-2 select-none group will-change-transform cursor-pointer"
    >
      {/* Yellow Signboard with visible harmonic hover/float & glossy diagonal sheen */}
      <motion.div
        animate={{
          y: [0, -5, 0],
          rotate: variant === 2 ? [1.2, -1.2, 1.2] : [-1.3, 1.3, -1.3]
        }}
        transition={{
          y: { duration: 2.6 + variant * 0.25, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 3.1 + variant * 0.35, repeat: Infinity, ease: 'easeInOut' }
        }}
        variants={{
          hovered: {
            y: -9,
            scale: 1.035,
            rotate: 0,
            transition: SPRING_BOUNCY
          }
        }}
        className="relative z-10 mx-auto w-[86%] max-w-[270px] bg-[#FFD426] border-[1.75px] border-[#141413] rounded-2xl px-4 py-3 text-center shadow-[3px_3px_0px_#141413] group-hover:shadow-[6px_6px_0px_#141413] transition-shadow text-[#141413] overflow-hidden will-change-transform"
      >
        {/* Continuous smooth glossy sheen sweep across the signboard */}
        <motion.div
          aria-hidden="true"
          initial={{ x: '-160%', skewX: -20 }}
          animate={{ x: ['-160%', '260%'], skewX: -20 }}
          transition={{
            duration: 2.4,
            delay: (variant - 1) * 0.55,
            repeat: Infinity,
            repeatDelay: 1.0,
            ease: EASE_OUT_EXPO
          }}
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/55 to-transparent will-change-transform"
        />

        <div className="relative z-10 border border-[#141413]/70 rounded-xl px-2 py-2">
          <div className="font-heading font-black text-base sm:text-lg tracking-tight uppercase leading-none">
            {title}
          </div>
          <div className="mt-1.5 pt-1 border-t border-[#141413]/40 font-mono text-[10px] font-bold tracking-widest uppercase">
            {subtitle}
          </div>
        </div>
      </motion.div>

      {/* Black & white striped poles + Fully Animated Skyline & Gliding Commuter */}
      <div className="relative -mt-1 flex flex-col items-center">
        <svg viewBox="0 0 320 98" className="w-full max-w-[320px] h-24 overflow-visible">
          <defs>
            <clipPath id={`curb-clip-${variant}`}>
              <rect x="8" y="80" width="304" height="12" rx="3" />
            </clipPath>
          </defs>

          {/* Two striped signpost legs rising smoothly from the base */}
          <motion.g
            initial={{ scaleY: 0, opacity: 0 }}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.05 }}
            style={{ transformOrigin: '160px 84px' }}
          >
            <rect x="76" y="0" width="8" height="84" fill="#FFFFFF" stroke="#141413" strokeWidth="1.5" />
            <rect x="76" y="10" width="8" height="10" fill="#141413" />
            <rect x="76" y="30" width="8" height="10" fill="#141413" />
            <rect x="76" y="50" width="8" height="10" fill="#141413" />
            <rect x="76" y="70" width="8" height="10" fill="#141413" />

            <rect x="236" y="0" width="8" height="84" fill="#FFFFFF" stroke="#141413" strokeWidth="1.5" />
            <rect x="236" y="10" width="8" height="10" fill="#141413" />
            <rect x="236" y="30" width="8" height="10" fill="#141413" />
            <rect x="236" y="50" width="8" height="10" fill="#141413" />
            <rect x="236" y="70" width="8" height="10" fill="#141413" />
          </motion.g>

          {/* Variant 1: Financial District — animated buildings, blinking windows, floating bird/cloud */}
          {variant === 1 && (
            <g className="stroke-[#141413] dark:stroke-[#FAF8EC]/75" strokeWidth="1.3" fill="none">
              {/* Gentle drifting breeze cloud */}
              <motion.path
                d="M178 24 H206 C206 19 201 16 196 18 C193 13 185 13 183 18 C179 18 178 21 178 24 Z"
                fill="#FCFBF2"
                className="dark:fill-[#242421]"
                animate={{ x: [-8, 12, -8], y: [0, -2.5, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Left block + glowing windows */}
              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.08 }}
                style={{ transformOrigin: '35px 84px' }}
              >
                <rect x="24" y="46" width="22" height="38" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                <motion.line
                  x1="30" y1="54" x2="40" y2="54"
                  animate={{ opacity: [0.35, 1, 0.35], scaleX: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: '35px 54px' }}
                />
                <motion.line
                  x1="30" y1="62" x2="40" y2="62"
                  animate={{ opacity: [0.35, 1, 0.35], scaleX: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.8, delay: 0.35, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: '35px 62px' }}
                />
              </motion.g>

              {/* Pointed spire building */}
              <motion.polygon
                points="52,84 52,38 64,22 74,38 74,84"
                fill="#FCFBF2"
                className="dark:fill-[#1C1C1A]"
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.14 }}
                style={{ transformOrigin: '63px 84px' }}
              />

              {/* Archway building */}
              <motion.path
                d="M98 84 L98 62 Q112 46 126 62 L126 84 Z"
                fill="#FCFBF2"
                className="dark:fill-[#1C1C1A]"
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.18 }}
                style={{ transformOrigin: '112px 84px' }}
              />

              {/* Tall central tower with animated signal bars */}
              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.22 }}
                variants={{ hovered: { y: -3, transition: SPRING_BOUNCY } }}
                style={{ transformOrigin: '150px 84px' }}
              >
                <rect x="136" y="32" width="28" height="52" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                {[42, 50, 58].map((yPos, i) => (
                  <motion.line
                    key={yPos}
                    x1="143"
                    y1={yPos}
                    x2="157"
                    y2={yPos}
                    animate={{ opacity: [0.35, 1, 0.35], scaleX: [0.85, 1, 0.85] }}
                    transition={{ duration: 1.6, delay: i * 0.28, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: `150px ${yPos}px` }}
                  />
                ))}
              </motion.g>

              {/* Slanted modern block */}
              <motion.polygon
                points="182,84 182,58 206,52 206,84"
                fill="#FCFBF2"
                className="dark:fill-[#1C1C1A]"
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.26 }}
                style={{ transformOrigin: '194px 84px' }}
              />

              {/* Right gabled house */}
              <motion.polygon
                points="262,84 262,48 278,34 294,48 294,84"
                fill="#FCFBF2"
                className="dark:fill-[#1C1C1A]"
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.3 }}
                style={{ transformOrigin: '278px 84px' }}
              />
            </g>
          )}

          {/* Variant 2: Broadcast Hub — radar concentric waves + swaying spire + cycling floors */}
          {variant === 2 && (
            <g className="stroke-[#141413] dark:stroke-[#FAF8EC]/75" strokeWidth="1.3" fill="none">
              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.08 }}
                style={{ transformOrigin: '38px 84px' }}
              >
                <rect x="22" y="36" width="32" height="48" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                {[45, 53, 61].map((yPos, i) => (
                  <motion.line
                    key={yPos}
                    x1="29" y1={yPos} x2="47" y2={yPos}
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.5, delay: i * 0.24, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </motion.g>

              {/* Transmission Spire + Triple Concentric Radar Rings */}
              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.14 }}
                style={{ transformOrigin: '112px 84px' }}
              >
                <line x1="106" y1="84" x2="112" y2="28" />
                <line x1="118" y1="84" x2="112" y2="28" />
                {[0, 0.55, 1.1].map((rippleDelay, i) => (
                  <motion.circle
                    key={i}
                    cx="112"
                    cy="26"
                    r="3.4"
                    fill="none"
                    stroke="#0D47FF"
                    strokeWidth="1.2"
                    animate={{ scale: [1, 3.8], opacity: [0.9, 0] }}
                    transition={{ duration: 1.75, delay: rippleDelay, repeat: Infinity, ease: 'easeOut' }}
                    style={{ transformOrigin: '112px 26px' }}
                  />
                ))}
                <motion.circle
                  cx="112"
                  cy="26"
                  r="3.5"
                  fill="#FFD426"
                  animate={{ scale: [1, 1.38, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: '112px 26px' }}
                />
              </motion.g>

              <motion.polygon
                points="134,84 134,64 150,54 166,64 166,84"
                fill="#FCFBF2"
                className="dark:fill-[#1C1C1A]"
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.18 }}
                style={{ transformOrigin: '150px 84px' }}
              />

              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.22 }}
                variants={{ hovered: { y: -3, transition: SPRING_BOUNCY } }}
                style={{ transformOrigin: '193px 84px' }}
              >
                <rect x="176" y="34" width="34" height="50" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                {[44, 52, 60].map((yPos, i) => (
                  <motion.line
                    key={yPos}
                    x1="184" y1={yPos} x2="202" y2={yPos}
                    animate={{ opacity: [0.35, 1, 0.35], scaleX: [0.8, 1, 0.8] }}
                    transition={{ duration: 1.6, delay: i * 0.25 + 0.2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: `193px ${yPos}px` }}
                  />
                ))}
              </motion.g>

              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.28 }}
                style={{ transformOrigin: '278px 84px' }}
              >
                <rect x="260" y="56" width="36" height="28" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                <line x1="256" y1="56" x2="300" y2="56" />
              </motion.g>
            </g>
          )}

          {/* Variant 3: RBI Mint Heritage Clock Tower — swaying trees, pulsing clock halo, brisk clock hands & sparkles */}
          {variant === 3 && (
            <g className="stroke-[#141413] dark:stroke-[#FAF8EC]/75" strokeWidth="1.3" fill="none">
              {/* Left tree gently swaying in breeze */}
              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.08 }}
                style={{ transformOrigin: '48px 84px' }}
              >
                <motion.g
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: '48px 84px' }}
                >
                  <circle cx="48" cy="64" r="14" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                  <line x1="48" y1="78" x2="48" y2="84" />
                </motion.g>
              </motion.g>

              {/* Central RBI Mint & Clock Tower */}
              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.16 }}
                variants={{ hovered: { y: -3, transition: SPRING_BOUNCY } }}
                style={{ transformOrigin: '160px 84px' }}
              >
                <rect x="92" y="54" width="136" height="30" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                <rect x="144" y="28" width="32" height="56" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                <polygon points="140,28 160,12 180,28" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />

                {/* Pulsing golden aura ring around clock face */}
                <motion.circle
                  cx="160"
                  cy="44"
                  r="8"
                  fill="none"
                  stroke="#FFD426"
                  strokeWidth="1.4"
                  animate={{ scale: [1, 1.75], opacity: [0.85, 0] }}
                  transition={{ duration: 2.0, repeat: Infinity, ease: 'easeOut' }}
                  style={{ transformOrigin: '160px 44px' }}
                />

                <circle cx="160" cy="44" r="8" fill="#FFD426" stroke="#141413" strokeWidth="1.4" />
                {/* Visible, smooth spinning minute & hour hands */}
                <motion.line
                  x1="160"
                  y1="44"
                  x2="160"
                  y2="38.2"
                  stroke="#141413"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
                  style={{ transformOrigin: '160px 44px' }}
                />
                <motion.line
                  x1="160"
                  y1="44"
                  x2="164.5"
                  y2="44"
                  stroke="#141413"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                  style={{ transformOrigin: '160px 44px' }}
                />

                {[104, 118, 132, 188, 202, 216].map((x, idx) => (
                  <motion.line
                    key={x}
                    x1={x}
                    y1="64"
                    x2={x}
                    y2="74"
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 1.6, delay: idx * 0.16, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}

                {/* Twinkling spire star sparkles */}
                <motion.path
                  d="M126 16 L127.6 19.6 L131.2 21.2 L127.6 22.8 L126 26.4 L124.4 22.8 L120.8 21.2 L124.4 19.6 Z"
                  fill="#ECD5FF"
                  stroke="#141413"
                  strokeWidth="1"
                  animate={{ scale: [0.75, 1.2, 0.75], rotate: [0, 20, 0], opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: '126px 21.2px' }}
                />
                <motion.path
                  d="M194 14 L195.4 17 L198.4 18.4 L195.4 19.8 L194 22.8 L192.6 19.8 L189.6 18.4 L192.6 17 Z"
                  fill="#FFD426"
                  stroke="#141413"
                  strokeWidth="1"
                  animate={{ scale: [0.8, 1.25, 0.8], rotate: [0, -20, 0], opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 2.2, delay: 0.7, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: '194px 18.4px' }}
                />
              </motion.g>

              {/* Right tree gently swaying out of phase */}
              <motion.g
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING_BOUNCY, delay: baseDelay + 0.24 }}
                style={{ transformOrigin: '276px 84px' }}
              >
                <motion.g
                  animate={{ rotate: [5, -5, 5] }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: '276px 84px' }}
                >
                  <circle cx="276" cy="64" r="14" fill="#FCFBF2" className="dark:fill-[#1C1C1A]" />
                  <line x1="276" y1="78" x2="276" y2="84" />
                </motion.g>
              </motion.g>
            </g>
          )}

          {/* Gliding mini metro train pulse racing smoothly along the platform top */}
          <g clipPath={`url(#curb-clip-${variant})`}>
            <motion.g
              animate={{ x: [-36, 330] }}
              transition={{
                duration: 3.4,
                delay: (variant - 1) * 0.9,
                repeat: Infinity,
                ease: 'linear'
              }}
              className="will-change-transform"
            >
              <rect x="0" y="79" width="26" height="5" rx="2" fill="#0D47FF" stroke="#141413" strokeWidth="1" />
              <rect x="19" y="80" width="4" height="2" rx="0.5" fill="#FFD426" />
              <rect x="4" y="80.5" width="4" height="1.8" rx="0.5" fill="#ECD5FF" />
              <rect x="10" y="80.5" width="4" height="1.8" rx="0.5" fill="#ECD5FF" />
            </motion.g>
          </g>

          {/* Yellow platform curb base */}
          <rect x="8" y="84" width="304" height="7" rx="3" fill="#FFD426" stroke="#141413" strokeWidth="1.5" />
          <rect x="8" y="91" width="304" height="4" rx="2" fill="#E5E1CE" stroke="#141413" strokeWidth="1.2" />
        </svg>
      </div>
    </motion.div>
  );
}

/**
 * 2. Horizontal Railway Preparation Timeline (Matches Screenshot 2)
 * Displays Phase 1, Phase 2, Interview nodes on a dotted rail with a vector train sliding smoothly to progressPct.
 */
export function RailwayTimeline({
  milestones,
  progressPct = 35
}: {
  milestones: { label: string; caption: string }[];
  progressPct?: number;
}) {
  const clamped = Math.max(4, Math.min(94, progressPct));

  return (
    <div className="w-full py-4 select-none">
      {/* Labels row */}
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] mb-4 px-1 gap-2">
        {milestones.map((m, idx) => (
          <div
            key={idx}
            className={
              idx === 0
                ? 'text-left'
                : idx === milestones.length - 1
                  ? 'text-right'
                  : 'text-center'
            }
          >
            <span className="font-bold text-[#141413] dark:text-[#FAF8EC]">{m.label}</span>
            <span className="hidden sm:inline"> · {m.caption}</span>
          </div>
        ))}
      </div>

      {/* Rail track + nodes + train SVG */}
      <div className="relative h-8 flex items-center">
        {/* Continuous cross-tie rail track */}
        <div
          className="w-full h-[6px] border-y border-[#141413]/40 dark:border-[#FAF8EC]/35"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(20,20,19,0.5) 0 2px, transparent 2px 7px)'
          }}
        />

        {/* Yellow square milestone stops */}
        <div className="absolute inset-x-0 flex items-center justify-between pointer-events-none">
          {milestones.map((_, idx) => {
            const nodePct = milestones.length > 1 ? (idx / (milestones.length - 1)) * 100 : 0;
            const passed = clamped >= nodePct;
            return (
              <motion.div
                key={idx}
                initial={{ scale: 0.6, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.12, ...SPRING_SNAPPY }}
                className={`w-3.5 h-3.5 rounded-[3px] border-[1.5px] border-[#141413] shadow-[1px_1px_0px_#141413] transition-colors ${
                  passed ? 'bg-[#FFD426]' : 'bg-[#FAF8EC] dark:bg-[#242421]'
                }`}
              />
            );
          })}
        </div>

        {/* Sliding vector train at progressPct */}
        <motion.div
          initial={{ left: '2%', opacity: 0 }}
          whileInView={{ left: `calc(${clamped}% - 28px)`, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1.45, ease: EASE_OUT_EXPO }}
          className="absolute -top-3.5 pointer-events-none will-change-transform"
        >
          <svg width="56" height="22" viewBox="0 0 64 24" className="drop-shadow-xs animate-train-bob">
            {/* Passenger coach 1 */}
            <rect x="2" y="5" width="24" height="14" rx="2.5" fill="#B8D4FF" stroke="#141413" strokeWidth="1.5" />
            <rect x="5" y="8" width="4" height="4" fill="#FFFFFF" stroke="#141413" strokeWidth="1" />
            <rect x="11" y="8" width="4" height="4" fill="#FFFFFF" stroke="#141413" strokeWidth="1" />
            <rect x="17" y="8" width="4" height="4" fill="#FFFFFF" stroke="#141413" strokeWidth="1" />
            {/* Connector */}
            <line x1="26" y1="13" x2="31" y2="13" stroke="#141413" strokeWidth="1.5" />
            {/* Locomotive engine */}
            <path d="M31 5 H52 L58 10 V19 H31 Z" fill="#ECD5FF" stroke="#141413" strokeWidth="1.5" />
            <rect x="35" y="8" width="6" height="4" fill="#FFFFFF" stroke="#141413" strokeWidth="1" />
            <rect x="44" y="8" width="6" height="4" fill="#FFD426" stroke="#141413" strokeWidth="1" />
            {/* Wheels */}
            <circle cx="8" cy="20" r="2.2" fill="#141413" />
            <circle cx="20" cy="20" r="2.2" fill="#141413" />
            <circle cx="38" cy="20" r="2.2" fill="#141413" />
            <circle cx="52" cy="20" r="2.2" fill="#141413" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * 3. Crisscrossing Diagonal Ticker Marquee + Rotating Circular Stamp Emblem
 */
export function DiagonalMarquee() {
  const lavenderItems = [
    'PHASE I · 200 MARKS',
    'PHASE II · 300 MARKS',
    'DUAL-TRACK STATIC & DYNAMIC',
    'OFFICIAL PYQ ARCHETYPES',
    'RBI ACT 1934 & BR ACT 1949',
    'INTERVIEW · 75 MARKS'
  ];

  const charcoalItems = [
    'GENERAL AWARENESS · 80 QS',
    'ECONOMIC & SOCIAL ISSUES',
    'FINANCE & MANAGEMENT',
    'SPACED MISTAKE NOTEBOOK',
    'CADRE CYCLE 2026–27',
    'STRICT 1/4TH PENALTY ENGINE'
  ];

  return (
    <div className="relative w-full overflow-hidden py-10 sm:py-14 select-none pointer-events-none">
      {/* Ribbon 1: Soft Lavender with crisp ink borders tilted -2.2deg */}
      <div className="-mx-8 -rotate-[2.2deg] bg-[#ECD5FF] border-y-[1.5px] border-[#141413] text-[#141413] py-2.5 overflow-hidden">
        <div className="animate-marquee-left gpu-layer items-center gap-8 font-mono text-[11px] sm:text-xs font-bold tracking-widest uppercase whitespace-nowrap">
          {[...lavenderItems, ...lavenderItems].map((txt, idx) => (
            <span key={idx} className="inline-flex items-center gap-8">
              <span>{txt}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#141413]" />
            </span>
          ))}
        </div>
      </div>

      {/* Ribbon 2: Charcoal Ink tilted +2.2deg */}
      <div className="-mx-8 -mt-4 rotate-[2.2deg] bg-[#141413] border-y-[1.5px] border-[#FAF8EC]/25 text-[#FAF8EC] py-2.5 overflow-hidden shadow-md">
        <div className="animate-marquee-right gpu-layer items-center gap-8 font-mono text-[11px] sm:text-xs font-bold tracking-widest uppercase whitespace-nowrap">
          {[...charcoalItems, ...charcoalItems].map((txt, idx) => (
            <span key={idx} className="inline-flex items-center gap-8">
              <span>{txt}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#ECD5FF]" />
            </span>
          ))}
        </div>
      </div>

      {/* Center Rotating Circular Seal Emblem overlapping the X-intersection */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#FFFFFF] border-[2px] border-[#141413] shadow-[3px_3px_0px_#141413] flex items-center justify-center relative">
          {/* Outer rotating circular typography */}
          <svg viewBox="0 0 100 100" className="w-full h-full p-1 animate-spin-slow">
            <defs>
              <path
                id="sealCirclePath"
                d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
              />
            </defs>
            <text
              fill="#141413"
              fontSize="7.6"
              fontWeight="800"
              letterSpacing="2.2"
              className="font-mono uppercase"
            >
              <textPath href="#sealCirclePath">
                RBI GRADE B · OFFICER CADRE · 2026 ·
              </textPath>
            </text>
          </svg>
          {/* Central Equalizer / Waveform mark upright & gently pulsing */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-[3px] h-7">
              {[0, 1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className="w-[3px] h-full rounded-full bg-[#141413] origin-center"
                  style={{
                    animation: `equalizerPulse ${0.95 + (bar % 3) * 0.25}s ease-in-out infinite`,
                    animationDelay: `${bar * 0.14}s`
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 4. Hanging Lavender Officer Lanyard Pass (Interactive pendulum physics + twinkling RBI map pins)
 */
const INDIA_DOTS: Array<[number, number, boolean?]> = [
  [7, 1], [8, 1],
  [6, 2], [7, 2], [8, 2, true], [9, 2],
  [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
  [5, 4], [6, 4], [7, 4], [8, 4, true], [9, 4],
  [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5],
  [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
  [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [13, 7], [14, 7], [15, 7],
  [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8, true], [12, 8], [13, 8], [14, 8, true], [15, 8], [16, 8],
  [2, 9], [3, 9, true], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [14, 9], [15, 9],
  [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
  [4, 11], [5, 11, true], [6, 11], [7, 11], [8, 11], [9, 11],
  [4, 12], [5, 12], [6, 12], [7, 12, true], [8, 12], [9, 12],
  [5, 13], [6, 13], [7, 13], [8, 13],
  [5, 14], [6, 14, true], [7, 14], [8, 14],
  [5, 15], [6, 15], [7, 15, true],
  [6, 16], [7, 16],
  [6, 17],
];

export function OfficerLanyardPass({
  name,
  stream = 'General',
  passNumber = '0389',
  photoURL,
  subtitle = 'Officer Candidate'
}: {
  name: string;
  stream?: string;
  passNumber?: string;
  photoURL?: string;
  subtitle?: string;
}) {
  const cleanName = (name || 'Cadre Officer').trim();
  const cardRef = useRef<HTMLDivElement>(null);

  // Interactive 3D spring tilt & back-card parallax motion values
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 170, damping: 20, mass: 0.7 });
  const smoothY = useSpring(pointerY, { stiffness: 170, damping: 20, mass: 0.7 });

  const tiltRotateY = useTransform(smoothX, [-0.5, 0.5], [-10, 10]);
  const tiltRotateX = useTransform(smoothY, [-0.5, 0.5], [10, -10]);
  const backOffsetX = useTransform(smoothX, [-0.5, 0.5], [6, -6]);
  const backOffsetY = useTransform(smoothY, [-0.5, 0.5], [6, -6]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(nx);
    pointerY.set(ny);
  };

  const handleMouseLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -32, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
      className="flex flex-col items-center select-none will-change-transform"
    >
      {/* Hanging Lavender Strap + Clasp + Card with visible, silky harmonic pendulum motion */}
      <motion.div
        animate={{
          rotate: [-3.2, 3.2, -3.2],
          y: [0, -7, 0]
        }}
        transition={{
          rotate: { duration: 5.0, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
        }}
        style={{ transformOrigin: 'top center' }}
        className="flex flex-col items-center will-change-transform"
      >
        {/* Woven Ribbon Strap */}
        <div className="w-10 h-16 sm:h-20 bg-[#ECD5FF] border-x-[1.5px] border-t-[1.5px] border-[#141413] flex items-center justify-center relative overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/10 pointer-events-none"
            aria-hidden="true"
          />
          <span
            className="font-mono text-[8px] font-black tracking-[0.22em] text-[#141413] uppercase relative z-10"
            style={{ writingMode: 'vertical-rl' }}
          >
            RBI × ENGINE
          </span>
        </div>

        {/* Metal Clasp Ring */}
        <motion.div
          whileHover={{ rotate: 12, scale: 1.1 }}
          transition={SPRING_BUTTERY}
          className="w-7 h-5 rounded-full border-[2.5px] border-[#E5E1CE] bg-[#141413] -my-1 z-10 shadow-sm"
        />

        {/* Pass Card Stack with 3D perspective & pointer spring tilt */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ perspective: 950 }}
          className="relative w-64 sm:w-[276px] cursor-pointer"
        >
          <motion.div
            style={{
              rotateX: tiltRotateX,
              rotateY: tiltRotateY,
              transformStyle: 'preserve-3d'
            }}
            whileHover={{ scale: 1.03 }}
            transition={SPRING_BUTTERY}
            className="relative will-change-transform"
          >
            {/* Depth card behind with subtle parallax shift */}
            <motion.div
              style={{ x: backOffsetX, y: backOffsetY }}
              className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-[#D8B8F8] border-[1.5px] border-[#141413] will-change-transform"
            />

            {/* Main Front Lavender Pass Card */}
            <div className="relative rounded-2xl bg-[#ECD5FF] border-[1.75px] border-[#141413] p-5 text-[#141413] flex flex-col justify-between min-h-[340px] overflow-hidden shadow-[0_18px_38px_-12px_rgba(236,213,255,0.22)]">
              {/* Buttery Diagonal Holographic Sheen Sweep */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-sheen-sweep"
              />

              {/* Lanyard slot hole */}
              <div className="w-12 h-2.5 rounded-full bg-[#141413]/85 mx-auto mb-3 relative z-10" />

              {/* Dotted Matrix Map of India with pulsing RBI HQ radar beacons */}
              <div className="flex items-center justify-center my-1 relative z-10">
                <svg viewBox="0 0 180 185" className="w-36 h-36 sm:w-40 sm:h-40 overflow-visible">
                  {INDIA_DOTS.map(([col, row, isPin], idx) => {
                    const cx = col * 9.5 + 10;
                    const cy = row * 9.5 + 8;
                    if (isPin) {
                      return (
                        <g key={idx}>
                          {/* Expanding radar beacon ring */}
                          <motion.circle
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill="none"
                            stroke="#0D47FF"
                            strokeWidth="1.2"
                            animate={{
                              scale: [1, 2.9],
                              opacity: [0.85, 0]
                            }}
                            transition={{
                              duration: 2.4,
                              delay: (idx % 6) * 0.35,
                              repeat: Infinity,
                              ease: 'easeOut'
                            }}
                            style={{ transformOrigin: `${cx}px ${cy}px` }}
                          />
                          {/* Core pulsing pin */}
                          <motion.circle
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill="#0D47FF"
                            animate={{ scale: [1, 1.32, 1] }}
                            transition={{
                              duration: 2.0,
                              delay: (idx % 6) * 0.25,
                              repeat: Infinity,
                              ease: 'easeInOut'
                            }}
                            style={{ transformOrigin: `${cx}px ${cy}px` }}
                          />
                        </g>
                      );
                    }
                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={2.1}
                        fill="rgba(20, 20, 19, 0.28)"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Candidate Identity Footer */}
              <div className="mt-3 space-y-2 relative z-10">
                <div className="flex items-center gap-2.5">
                  {photoURL && (photoURL.startsWith('http') || photoURL.startsWith('data:')) ? (
                    <img
                      src={photoURL}
                      alt={cleanName}
                      className="w-9 h-9 rounded-lg object-cover border-[1.5px] border-[#141413] shrink-0"
                    />
                  ) : photoURL ? (
                    <div className="w-9 h-9 rounded-lg bg-[#141413] text-[#FAF8EC] flex items-center justify-center text-base shrink-0">
                      {photoURL}
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-heading font-black text-xl sm:text-2xl tracking-tight leading-tight text-[#141413] truncate">
                      {cleanName}
                    </p>
                    <p className="text-xs font-medium text-[#141413]/70 truncate">
                      {subtitle} · {stream} Stream
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#141413]/15 flex items-center justify-between text-[11px] font-mono font-bold">
                  <span className="inline-flex items-center gap-1.5 text-[#141413]">
                    <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0D47FF] opacity-65" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0D47FF] border border-[#141413]" />
                    </span>
                    RBI Grade B
                  </span>
                  <span className="text-[#141413]/65">Phase I & II / 2026</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Candidate ID below card */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="mt-4 font-mono text-[11px] font-bold tracking-widest uppercase text-[#A3A399]"
      >
        CANDIDATE #{passNumber}
      </motion.span>
    </motion.div>
  );
}

/** Download the personalized Officer Lanyard Pass as clean SVG */
export function downloadOfficerPassSVG(name: string, stream = 'General', passNumber = '0389') {
  const safeName = (name || 'Cadre Officer').replace(/[<>&'"]/g, '');
  const dotsSvg = INDIA_DOTS.map(
    ([col, row, isPin]) =>
      `<circle cx="${col * 11 + 65}" cy="${row * 11 + 52}" r="${isPin ? 3.8 : 2.5}" fill="${isPin ? '#0D47FF' : 'rgba(20,20,19,0.28)'}" />`
  ).join('');

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="470" viewBox="0 0 360 470">
  <rect width="360" height="470" fill="#141413" />
  <rect x="44" y="34" width="280" height="390" rx="22" fill="#D8B8F8" stroke="#141413" stroke-width="2" />
  <rect x="34" y="24" width="280" height="390" rx="22" fill="#ECD5FF" stroke="#141413" stroke-width="2" />
  <rect x="148" y="42" width="52" height="10" rx="5" fill="#141413" />
  ${dotsSvg}
  <text x="58" y="328" font-family="system-ui, sans-serif" font-size="26" font-weight="800" fill="#141413">${safeName}</text>
  <text x="58" y="352" font-family="system-ui, sans-serif" font-size="14" font-weight="500" fill="#3D3D38">RBI Officer Candidate · ${stream} Stream</text>
  <line x1="58" y1="370" x2="290" y2="370" stroke="rgba(20,20,19,0.2)" stroke-width="1.5" />
  <circle cx="65" cy="390" r="6" fill="#0D47FF" stroke="#141413" stroke-width="1.2" />
  <text x="78" y="394" font-family="monospace" font-size="12" font-weight="700" fill="#141413">RBI Grade B</text>
  <text x="206" y="394" font-family="monospace" font-size="11" fill="#4D4D47">CANDIDATE #${passNumber}</text>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RBI_Officer_Pass_${safeName.replace(/\s+/g, '_')}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 5. Crisp Line-Art Prize / Achievement Badges (With sparkling twinkle animation)
 */
export function PrizeBadgeIcon({ type = 'trophy' }: { type?: 'trophy' | 'medal2' | 'medal3' }) {
  if (type === 'trophy') {
    return (
      <motion.svg
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        viewBox="0 0 64 64"
        className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 will-change-transform"
      >
        {/* Sparkles */}
        <path d="M12 24 L14 28 L18 30 L14 32 L12 36 L10 32 L6 30 L10 28 Z" fill="#ECD5FF" stroke="#141413" strokeWidth="1.5" className="animate-sparkle" />
        <path d="M52 10 L54 14 L58 16 L54 18 L52 22 L50 18 L46 16 L50 14 Z" fill="#ECD5FF" stroke="#141413" strokeWidth="1.5" className="animate-sparkle" style={{ animationDelay: '0.7s' }} />
        {/* Handles */}
        <path d="M22 18 H14 V28 C14 33 18 36 22 36" fill="none" stroke="#141413" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M42 18 H50 V28 C50 33 46 36 42 36" fill="none" stroke="#141413" strokeWidth="2.2" strokeLinecap="round" />
        {/* Trophy Cup */}
        <path d="M20 14 H44 V30 C44 37 38.6 42 32 42 C25.4 42 20 37 20 30 V14 Z" fill="#FF9E44" stroke="#141413" strokeWidth="2.2" />
        {/* Star inside */}
        <polygon points="32,20 34.4,25 39.8,25.8 35.9,29.6 36.8,35 32,32.4 27.2,35 28.1,29.6 24.2,25.8 29.6,25" fill="#FFFFFF" stroke="#141413" strokeWidth="1.6" />
        {/* Stem & Base */}
        <rect x="29" y="42" width="6" height="8" fill="#141413" />
        <rect x="19" y="50" width="26" height="6" rx="2" fill="#ECD5FF" stroke="#141413" strokeWidth="2.2" />
      </motion.svg>
    );
  }

  return (
    <motion.svg
      animate={{ y: [0, -3.5, 0] }}
      transition={{ duration: 3.1, delay: type === 'medal2' ? 0.35 : 0.7, repeat: Infinity, ease: 'easeInOut' }}
      viewBox="0 0 64 64"
      className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 will-change-transform"
    >
      <path d="M51 22 L53 25 L56 26.5 L53 28 L51 31 L49 28 L46 26.5 L49 25 Z" fill="#ECD5FF" stroke="#141413" strokeWidth="1.4" className="animate-sparkle" />
      {/* Ribbon straps */}
      <polygon points="22,8 28,8 32,24 26,24" fill="#0D47FF" stroke="#141413" strokeWidth="1.8" />
      <polygon points="42,8 36,8 32,24 38,24" fill={type === 'medal2' ? '#70B5FF' : '#FFB8D0'} stroke="#141413" strokeWidth="1.8" />
      {/* Medal Coin */}
      <circle cx="32" cy="39" r="16" fill={type === 'medal2' ? '#F3F0E0' : '#F3C08E'} stroke="#141413" strokeWidth="2.2" />
      <circle cx="32" cy="39" r="12" fill="none" stroke="#141413" strokeWidth="1.2" strokeDasharray="2 2" />
      <text x="32" y="44" textAnchor="middle" fontFamily="monospace" fontWeight="800" fontSize="14" fill="#141413">
        {type === 'medal2' ? 'II' : 'I'}
      </text>
    </motion.svg>
  );
}

