// Custom SVG illustrations (original artwork, no external assets).
import type { SVGProps } from "react";

/** Side-view airliner silhouette, nose to the right. */
export function PlaneIcon({ className, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 32" fill="currentColor" aria-hidden="true" className={className} {...p}>
      <path d="M2 18c0-1.3 1-2.2 2.4-2.3l14.8-.9L28.6 3.3c.5-.6 1.2-.9 2-.9h3.1c.8 0 1.3.8 1 1.5l-4.7 11.1 13.7-.8 5-6.1c.4-.5 1-.8 1.7-.8h2.3c.7 0 1.1.7.9 1.3l-2.8 6.1 7.3-.4c2.6-.2 4.9 1.8 4.9 4.1 0 1.9-1.6 3.2-3.6 3.4l-7.7.6 3 5.9c.3.7-.2 1.4-.9 1.4h-2.3c-.7 0-1.3-.3-1.7-.8l-5.1-5.8-13.9 1.1 4.8 10.4c.3.7-.2 1.5-1 1.5h-3.1c-.8 0-1.5-.3-2-.9l-9.6-10.6-14.6 1.1C3.1 20.6 2 19.5 2 18Z" />
    </svg>
  );
}

/** Animated plane flying across a dashed route (loading state). */
export function PlaneLoader({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}>
      <div className="relative h-16 w-64 overflow-hidden">
        <svg viewBox="0 0 256 64" className="absolute inset-0 h-full w-full text-brand-300 dark:text-brand-800" aria-hidden="true">
          <path d="M8 52 C 80 4, 176 4, 248 52" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" />
          <circle cx="8" cy="52" r="4" className="fill-brand-500" />
          <circle cx="248" cy="52" r="4" className="fill-sun-500" />
        </svg>
        <div className="absolute inset-x-0 top-2 flex justify-center">
          <PlaneIcon className="rtl-flip h-8 w-16 animate-fly text-brand-600 drop-shadow dark:text-brand-300" />
        </div>
      </div>
      {label && <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>}
    </div>
  );
}

/** Small plane that gently "takes off" - used on the Book now recommendation. */
export function TakeoffPlane({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex ${className}`} aria-hidden="true">
      <PlaneIcon className="rtl-flip h-5 w-10 animate-takeoff" />
    </span>
  );
}

/** Empty state: a plane parked under a cloud. */
export function EmptySky({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="es-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9e2ff" />
          <stop offset="1" stopColor="#eef8ff" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="220" height="130" rx="24" fill="url(#es-sky)" className="dark:opacity-30" />
      <circle cx="190" cy="40" r="14" fill="#fbbf24" opacity="0.9" />
      <g fill="#fff">
        <ellipse cx="70" cy="52" rx="26" ry="12" />
        <ellipse cx="92" cy="46" rx="18" ry="13" />
        <ellipse cx="52" cy="56" rx="14" ry="9" />
      </g>
      <path d="M30 112 H210" stroke="#89d1ff" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 10" />
      <g transform="translate(78 78) scale(1.35)" className="text-brand-600 dark:text-brand-400">
        <PlaneIconPaths />
      </g>
      <g fill="#2a97f8" opacity="0.5">
        <circle cx="150" cy="70" r="2" />
        <circle cx="162" cy="62" r="2" />
        <circle cx="174" cy="56" r="2" />
      </g>
    </svg>
  );
}

function PlaneIconPaths() {
  return (
    <path
      fill="currentColor"
      d="M2 18c0-1.3 1-2.2 2.4-2.3l14.8-.9L28.6 3.3c.5-.6 1.2-.9 2-.9h3.1c.8 0 1.3.8 1 1.5l-4.7 11.1 13.7-.8 5-6.1c.4-.5 1-.8 1.7-.8h2.3c.7 0 1.1.7.9 1.3l-2.8 6.1 7.3-.4c2.6-.2 4.9 1.8 4.9 4.1 0 1.9-1.6 3.2-3.6 3.4l-7.7.6 3 5.9c.3.7-.2 1.4-.9 1.4h-2.3c-.7 0-1.3-.3-1.7-.8l-5.1-5.8-13.9 1.1 4.8 10.4c.3.7-.2 1.5-1 1.5h-3.1c-.8 0-1.5-.3-2-.9l-9.6-10.6-14.6 1.1C3.1 20.6 2 19.5 2 18Z"
    />
  );
}

/** Illustrated fallback for destinations without a photo. */
export function DestinationArt({ code, className = "" }: { code: string; className?: string }) {
  const hue = (code.charCodeAt(0) * 37 + code.charCodeAt(1) * 11 + code.charCodeAt(2) * 5) % 360;
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`d-${code}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 80% 70%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 85% 88%)`} />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill={`url(#d-${code})`} />
      <circle cx="230" cy="60" r="26" fill="#fff7d6" opacity="0.85" />
      <path d="M0 150 L60 105 L110 140 L170 90 L230 135 L300 100 V200 H0Z" fill={`hsl(${hue} 45% 45%)`} opacity="0.55" />
      <path d="M0 170 L80 135 L150 165 L220 130 L300 160 V200 H0Z" fill={`hsl(${hue} 45% 32%)`} opacity="0.7" />
      <text x="20" y="48" fontSize="34" fontWeight="800" fill="#ffffff" opacity="0.9" fontFamily="ui-sans-serif, system-ui">
        {code}
      </text>
    </svg>
  );
}
