import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LogoMark(props: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" {...props}>
      <defs>
        <linearGradient id="aniswipe-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#be123c" />
        </linearGradient>
      </defs>
      <rect x="4" y="7" width="20" height="18" rx="4" fill="url(#aniswipe-g)" opacity="0.45" transform="rotate(-10 16 16)" />
      <rect x="7" y="6" width="18" height="17" rx="4" fill="url(#aniswipe-g)" />
      <rect x="10.5" y="9.5" width="11" height="10" rx="2.5" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

export function XIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CheckIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function BookmarkIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function UndoIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7v6h6" />
      <path d="M3.5 13a9 9 0 1 0 2.1-5.6L3 10" />
    </svg>
  );
}

export function SearchIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function LogoutIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function StarIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  );
}

export function BoltIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

export function InfoIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </svg>
  );
}

export function AlertIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  );
}

export function ChartIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 15v-4M12 15V7M17 15v-7" />
    </svg>
  );
}

export function PlayCircleIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5.5 3.5-5.5 3.5z" />
    </svg>
  );
}

export function ClockIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function CalendarIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

export function RefreshIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 11a8 8 0 1 0-2.4 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function LockIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function LibraryIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function BookOpenIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2Z" />
      <path d="M12 6.5v14" />
    </svg>
  );
}

export function BookIcon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
      <path d="M5 17a3 3 0 0 1 3-3h10" />
    </svg>
  );
}

export function Spinner(props: Props) {
  return (
    <svg {...base} {...props} className={`animate-spin-slow ${props.className ?? ""}`}>
      <path d="M21 12a9 9 0 1 1-6.2-8.6" opacity="0.9" />
    </svg>
  );
}
