import type { SVGProps } from "react";

/** Thin-line cyber icons (stroke = currentColor) to match the Stitch command-center look. */
const base = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", ...props,
});

export const IconCommand = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
);
export const IconControl = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" /><line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="8" cy="18" r="2" /></svg>
);
export const IconAria = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="5" y="8" width="14" height="11" rx="2" /><path d="M12 8V4" /><circle cx="12" cy="3" r="1" /><circle cx="9.5" cy="13" r="1" /><circle cx="14.5" cy="13" r="1" /><line x1="3" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21" y2="12" /></svg>
);
export const IconEngine = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" /></svg>
);
export const IconThreat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3a4 4 0 0 0-4 4c-2 .5-3 2-3 4 0 1 .5 2 1 2.5C5.5 14 5 15 5 16a4 4 0 0 0 5.5 3.7M12 3a4 4 0 0 1 4 4c2 .5 3 2 3 4 0 1-.5 2-1 2.5.5.5 1 1.5 1 2.5a4 4 0 0 1-5.5 3.7M12 3v17" /></svg>
);
export const IconChain = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6h-1" /><path d="M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6h1" /></svg>
);
export const IconAlerts = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
);
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>
);
export const IconLegacy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></svg>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
);
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
);
export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const IconWifi = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0" /><circle cx="12" cy="19" r="1" /></svg>
);
export const IconWarning = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3 2 20h20L12 3z" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17" r="0.6" /></svg>
);
export const IconScan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconGauge = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 18a8 8 0 1 1 16 0" /><line x1="12" y1="18" x2="15" y2="11" /></svg>
);
export const IconPulse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M2 12h4l2-6 4 12 2-6h6" /></svg>
);
export const IconNetwork = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M12 7v4M12 11l-5 6M12 11l5 6" /></svg>
);
export const IconSupport = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M14.5 9.5 18 6M9.5 14.5 6 18M14.5 14.5 18 18M9.5 9.5 6 6" /></svg>
);
export const IconDoc = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
);
export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
);
export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 12 20 4l-6 16-3-7-7-1z" /></svg>
);
