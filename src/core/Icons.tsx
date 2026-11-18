const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const UndoIcon = () => (
  <svg {...base}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

export const HintIcon = () => (
  <svg {...base}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" />
  </svg>
);

export const ResetIcon = () => (
  <svg {...base}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const HelpIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 4" />
    <path d="M12 17.6h.01" strokeWidth={3} />
  </svg>
);

export const StatsIcon = () => (
  <svg {...base}>
    <path d="M5 20V11" />
    <path d="M12 20V4" />
    <path d="M19 20v-6" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...base} strokeWidth={3.2}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const BackIcon = () => (
  <svg {...base} strokeWidth={2.6}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const ShareIcon = () => (
  <svg {...base}>
    <path d="M12 15V3" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

export const ShuffleIcon = () => (
  <svg {...base}>
    <path d="M4 7h3.5c2 0 3.2 1 4.3 2.8l.4.7c1.1 1.8 2.3 2.8 4.3 2.8H20" />
    <path d="m17 10 3 3-3 3" />
    <path d="M4 17h3.5c1.4 0 2.4-.5 3.2-1.4" />
    <path d="M13.3 8.4c.8-.9 1.8-1.4 3.2-1.4H20" />
    <path d="m17 4 3 3-3 3" />
  </svg>
);

export const SoundOnIcon = () => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18.3 6.3a8 8 0 0 1 0 11.4" />
  </svg>
);

export const SoundOffIcon = () => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
    <path d="m16 9.5 5 5m0-5-5 5" />
  </svg>
);

export const MenuIcon = () => (
  <svg {...base}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </svg>
);

export const InstallIcon = () => (
  <svg {...base}>
    <path d="M12 3v11" />
    <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
    <path d="M5 16v2.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V16" />
  </svg>
);

/** The iPhone share button: a box with an arrow out of the top. */
export const IosShareIcon = () => (
  <svg {...base}>
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M8.5 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5h-2" />
  </svg>
);

/** "Add to Home Screen": a rounded square with a plus. */
export const AddSquareIcon = () => (
  <svg {...base}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

export const RefreshIcon = () => (
  <svg {...base}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 4v5h-5" />
  </svg>
);

export const CheckIcon = () => (
  <svg {...base}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const PencilIcon = () => (
  <svg {...base}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export const EraseIcon = () => (
  <svg {...base}>
    <path d="M20 20H9L4 15a2 2 0 0 1 0-2.8L13.2 3a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 19" />
    <path d="m9 8 7 7" />
  </svg>
);

/* ---------- game pieces ---------- */

export const Crown = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      d="M3.5 8.5 7.6 12 12 5l4.4 7 4.1-3.5-1.8 9.5H5.3L3.5 8.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <rect x="5.3" y="19.2" width="13.4" height="2.3" rx="1" fill="currentColor" />
  </svg>
);

export const Sun = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <circle cx="12" cy="12" r="8.6" fill="#f5b02e" />
    <circle cx="12" cy="12" r="8.6" fill="none" stroke="#c9801a" strokeWidth="1.6" />
    <circle cx="9.2" cy="9.2" r="2.4" fill="#ffd77a" />
  </svg>
);

export const Moon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      d="M15.6 3.6A8.8 8.8 0 1 0 20.4 15 7 7 0 0 1 15.6 3.6Z"
      fill="#4d6ac4"
      stroke="#2f458c"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/* ---------- hub icons (drawn in ivory on each game's felt) ---------- */

const ivory = "#fff8e8";

export const SumbrokeIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden>
    <rect x="9" y="8" width="30" height="30" rx="7" fill="#dccaa6" />
    <rect x="9" y="6" width="30" height="30" rx="7" fill={ivory} />
    <path d="M17 13h14v4h-8.6l4.4 4-4.4 4H31v4H17v-3l6-5-6-5v-3Z" fill="#1c3f94" />
  </svg>
);

export const KingsIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden>
    <rect x="6" y="6" width="17" height="17" rx="3" fill="#f7d67f" />
    <rect x="25" y="6" width="17" height="17" rx="3" fill="#c8b6ec" />
    <rect x="6" y="25" width="17" height="17" rx="3" fill="#9fd3e6" />
    <rect x="25" y="25" width="17" height="17" rx="3" fill="#f4b7a2" />
    <g transform="translate(26.5 26.5) scale(0.6)" color="#1d1d1f">
      <path d="M3.5 8.5 7.6 12 12 5l4.4 7 4.1-3.5-1.8 9.5H5.3L3.5 8.5Z" fill="currentColor" />
      <rect x="5.3" y="19.2" width="13.4" height="2.3" rx="1" fill="currentColor" />
    </g>
    <path d="m10 11 7 7m0-7-7 7" stroke="#1d1d1f" strokeWidth="2" strokeLinecap="round" opacity=".55" />
  </svg>
);

export const TangleIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden>
    <rect x="5" y="12" width="18" height="24" rx="4" fill={ivory} />
    <rect x="25" y="12" width="18" height="24" rx="4" fill={ivory} />
    <circle cx="14" cy="24" r="6" fill="#f5b02e" stroke="#c9801a" strokeWidth="1.4" />
    <path d="M36.6 17.6a6.6 6.6 0 1 0 3.6 8.6 5.2 5.2 0 0 1-3.6-8.6Z" fill="#4d6ac4" />
    <rect x="20.5" y="21" width="7" height="6" rx="2" fill="#2a2a2e" />
    <path d="M22.4 23h3.2M22.4 25h3.2" stroke={ivory} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const ZapIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden>
    <path d="M11 11h26v13H11v13h26" fill="none" stroke="#ff9a62" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="11" cy="11" r="6" fill="#1d1d1f" />
    <circle cx="37" cy="37" r="6" fill="#1d1d1f" />
    <text x="11" y="13.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={ivory} fontFamily="sans-serif">
      1
    </text>
    <text x="37" y="39.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={ivory} fontFamily="sans-serif">
      2
    </text>
  </svg>
);

export const SudokuIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden>
    <rect x="6" y="9" width="36" height="30" rx="4" fill={ivory} />
    <path d="M18 9v30M30 9v30M6 19h36M6 29h36" stroke="#cfc6b3" strokeWidth="1.2" />
    <path d="M24 9v30M6 24h36" stroke="#3a3f47" strokeWidth="2" />
    <text x="12" y="17.6" textAnchor="middle" fontSize="8" fontWeight="800" fill="#1d1d1f" fontFamily="sans-serif">
      3
    </text>
    <text x="36" y="37.6" textAnchor="middle" fontSize="8" fontWeight="800" fill="#1c3f94" fontFamily="sans-serif">
      6
    </text>
  </svg>
);

export const SwatchesIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden>
    <rect x="6" y="6" width="22" height="14" rx="3" fill="#f28b82" />
    <rect x="30" y="6" width="12" height="22" rx="3" fill="#a8d672" />
    <rect x="6" y="22" width="12" height="20" rx="3" fill="#6fc8e0" />
    <rect x="20" y="22" width="8" height="8" rx="2" fill="#fbbc04" />
    <rect x="20" y="32" width="22" height="10" rx="3" fill="#a28ce0" />
  </svg>
);
