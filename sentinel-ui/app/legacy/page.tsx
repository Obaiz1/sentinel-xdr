import LegacyDashboard from "@/components/legacy/LegacyDashboard";

/**
 * /legacy — ALWAYS renders the original SENTINEL XDR dashboard, unchanged.
 * Guaranteed escape hatch regardless of NEXT_PUBLIC_UI_VERSION.
 */
export default function LegacyRoute() {
  return <LegacyDashboard />;
}
