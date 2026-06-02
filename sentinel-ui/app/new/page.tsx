import NewDashboard from "@/components/sentinel-v2/NewDashboard";

/**
 * /new — ALWAYS renders the new Stitch SENTINEL XDR Command Center UI,
 * regardless of NEXT_PUBLIC_UI_VERSION. Used for side-by-side QA.
 */
export default function NewRoute() {
  return <NewDashboard />;
}
