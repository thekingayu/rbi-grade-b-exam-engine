import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const location = useLocation();

  const isExam = location.pathname.startsWith('/exam/');

  useEffect(() => {
    if (isExam) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
        window.__lenis = undefined;
      }
      document.documentElement.classList.remove('lenis', 'lenis-stopped', 'lenis-smooth');
      document.body.classList.remove('lenis', 'lenis-stopped', 'lenis-smooth');
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
      return;
    }

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Initialize Lenis for momentum smooth scrolling without jitter on desktop
    // touchMultiplier: 0 ensures iOS Safari's native momentum scrolling is never intercepted or locked
    let lenis: Lenis | null = null;
    let rafId: number;

    try {
      lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.95,
        touchMultiplier: 0,
        infinite: false,
      });

      lenisRef.current = lenis;
      window.__lenis = lenis;

      function raf(time: number) {
        if (lenis) {
          lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        }
      }
      rafId = requestAnimationFrame(raf);
    } catch (err) {
      console.warn('Lenis smooth scrolling not supported in this browser context:', err);
      return;
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (lenis) lenis.destroy();
      lenisRef.current = null;
      window.__lenis = undefined;
      document.documentElement.classList.remove('lenis', 'lenis-stopped', 'lenis-smooth');
      document.body.classList.remove('lenis', 'lenis-stopped', 'lenis-smooth');
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
    };
  }, [isExam]);

  // Handle route transitions smoothly
  useEffect(() => {
    if (!lenisRef.current || isExam) return;
    lenisRef.current.scrollTo(0, { immediate: true });
  }, [location.pathname, isExam]);

  return <>{children}</>;
}
