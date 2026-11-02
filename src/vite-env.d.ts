/// <reference types="vite/client" />

declare module 'sketchbook-ui' {
  import React from 'react';

  export interface SpinnerProps {
    variant?: 'spiral' | 'dots' | 'circle' | 'pulse';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    colors?: {
      stroke?: string;
      fill?: string;
    };
    className?: string;
  }

  export const Spinner: React.FC<SpinnerProps>;

  export interface DividerProps {
    variant?: 'scribble' | 'solid' | 'dashed' | 'gradient';
    color?: string;
    className?: string;
  }

  export const Divider: React.FC<DividerProps>;

  export interface ProgressProps {
    value?: number;
    max?: number;
    variant?: 'scribble' | 'solid' | 'striped';
    color?: string;
    className?: string;
  }

  export const Progress: React.FC<ProgressProps>;

  export const SketchProvider: React.FC<{ children: React.ReactNode }>;
}
