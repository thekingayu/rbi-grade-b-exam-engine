/**
 * Centralized API endpoint resolver.
 * Handles:
 * 1. Local AI Studio container runtime (relative `/api/...`)
 * 2. Vercel deployment at https://rbi-grade-b-exam-engine.vercel.app/ (auto routing to backend or rewrite)
 * 3. Custom API URL override via VITE_API_URL
 */

export const CLOUD_RUN_API_BASE = 'https://ais-pre-jzllizn5s3fhhw7kfwihpr-560411628824.asia-southeast1.run.app';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If explicit env var is set, use it
  if (import.meta.env.VITE_API_URL) {
    const base = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    return `${base}${cleanPath}`;
  }

  // When loaded on Vercel (e.g. https://rbi-grade-b-exam-engine.vercel.app),
  // fallback to direct Cloud Run backend if Vercel serverless proxy is not used
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    // Prefer relative path if vercel.json rewrite is handling it, but if needed direct backend URL works with CORS
    // Using relative path allows vercel.json rewrite to work without mixed content or CORS preflight
    return cleanPath;
  }

  return cleanPath;
}
