import React from 'react';

export function AtmosphericBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none bg-[#FAF8EC] dark:bg-[#141413] transition-colors duration-300"
      aria-hidden="true"
    >
      {/* Clean editorial dot-grid paper texture (no blurry neon clouds) */}
      <div
        className="absolute inset-0 bg-[radial-gradient(rgba(20,20,19,0.065)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(250,248,236,0.06)_1px,transparent_1px)] [background-size:28px_28px]"
      />
    </div>
  );
}
