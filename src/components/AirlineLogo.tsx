// Generated logos for the fictional airlines - simple geometric marks so
// nothing resembles a real carrier's trademark.
import { AIRLINE_BY_CODE, type LogoGlyph } from "@/lib/sim/airlines";

function Glyph({ glyph }: { glyph: LogoGlyph }) {
  switch (glyph) {
    case "sun":
      return (
        <g fill="#fff">
          <circle cx="20" cy="22" r="7" />
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x="19" y="7" width="2" height="5" rx="1" transform={`rotate(${i * 45} 20 22)`} />
          ))}
        </g>
      );
    case "drop":
      return <path d="M20 8c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15Z" fill="#fff" />;
    case "lotus":
      return (
        <g fill="#fff">
          <path d="M20 9c3 4 4 8 0 15-4-7-3-11 0-15Z" />
          <path d="M10 15c4 1 7 4 9 10-6-1-9-4-9-10Z" opacity="0.85" />
          <path d="M30 15c-4 1-7 4-9 10 6-1 9-4 9-10Z" opacity="0.85" />
          <rect x="11" y="27" width="18" height="2.5" rx="1.25" />
        </g>
      );
    case "wave":
      return (
        <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <path d="M8 17c3-3 6-3 9 0s6 3 9 0 4-2 6-1" />
          <path d="M8 25c3-3 6-3 9 0s6 3 9 0 4-2 6-1" opacity="0.8" />
        </g>
      );
    case "feather":
      return (
        <g fill="#fff">
          <path d="M28 8c-9 1-15 8-16 18l-3 6 2 1 3-6c9-1 15-8 14-19Z" />
          <circle cx="23" cy="15" r="2.5" fill="currentColor" />
        </g>
      );
    case "falcon":
      return <path d="M7 24c6-1 10-5 13-12 2 5 5 8 13 9-6 2-10 2-13 1-3 2-7 3-13 2Z" fill="#fff" />;
    case "orchid":
      return (
        <g fill="#fff">
          {Array.from({ length: 5 }, (_, i) => (
            <ellipse key={i} cx="20" cy="13" rx="3.6" ry="6.5" transform={`rotate(${i * 72} 20 21)`} />
          ))}
          <circle cx="20" cy="21" r="3" fill="currentColor" />
        </g>
      );
    case "star":
      return <path d="m20 7 3.4 8.6 9.1.6-7 5.9 2.2 8.9L20 26l-7.7 5 2.2-8.9-7-5.9 9.1-.6Z" fill="#fff" />;
  }
}

export function AirlineLogo({ code, size = 40, className = "" }: { code: string; size?: number; className?: string }) {
  const al = AIRLINE_BY_CODE[code];
  if (!al) return null;
  const gid = `al-${code}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={`${al.name} logo`}
      className={`shrink-0 ${className}`}
      style={{ color: al.color2 }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={al.color} />
          <stop offset="1" stopColor={al.color2} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gid})`} />
      <Glyph glyph={al.glyph} />
    </svg>
  );
}
