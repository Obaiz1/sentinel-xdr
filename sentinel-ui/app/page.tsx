import LegacyDashboard from "@/components/legacy/LegacyDashboard";
import NewDashboard from "@/components/sentinel-v2/NewDashboard";

/**
 * Root route — chooses the UI via NEXT_PUBLIC_UI_VERSION.
 *   NEXT_PUBLIC_UI_VERSION=new     → new Stitch UI
 *   NEXT_PUBLIC_UI_VERSION=legacy  → original UI (DEFAULT)
 * Default is "legacy" until the new UI is explicitly approved.
 * Hard routes /legacy and /new always render their respective UI.
 * Note: NEXT_PUBLIC_* is inlined at build time — redeploy after changing it.
 */
export default function Page() {
  const version = process.env.NEXT_PUBLIC_UI_VERSION ?? "legacy";
  return version === "new" ? <NewDashboard /> : <LegacyDashboard />;
}
