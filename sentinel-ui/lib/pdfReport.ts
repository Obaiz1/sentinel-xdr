/**
 * pdfReport.ts — professional SENTINEL XDR PDF reports (frontend, jsPDF).
 * Pulls LIVE data from the backend (/status, /statistics, /alerts, /chains) and
 * builds a branded report. No backend changes needed.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { api, type Statistics, type Alert } from "./apiClient";

export type ReportType = "threats" | "packets" | "ai" | "alerts" | "mace" | "full";

const TITLES: Record<ReportType, string> = {
  threats: "Critical Threat Report",
  packets: "Packet Sniffing Session Report",
  ai: "AI Analysis Report",
  alerts: "Alerts Report",
  mace: "MACE Attack Chain Report",
  full: "Full Incident Report",
};

const NAVY: [number, number, number] = [10, 22, 44];
const CYAN: [number, number, number] = [0, 150, 190];
const TEXT: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [110, 125, 145];
const LIGHTROW: [number, number, number] = [237, 243, 249];

function rid(type: ReportType): string {
  const s = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  return `SXDR-${type.toUpperCase().slice(0, 4)}-${s}`;
}

function asList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  try { const p = JSON.parse(v as string); return Array.isArray(p) ? p.map(String) : [String(v)]; } catch { return [String(v)]; }
}

function riskScore(stats: Statistics): { score: number; label: string } {
  const dist = stats.threat_distribution ?? [];
  const total = dist.reduce((s, d) => s + d.count, 0) || 1;
  const crit = dist.find((d) => d.threat_level === "Critical")?.count ?? 0;
  const high = dist.find((d) => d.threat_level === "High")?.count ?? 0;
  const score = Math.max(0, Math.min(100, Math.round(((crit + high * 0.5) / total) * 100)));
  const label = score >= 70 ? "CRITICAL" : score >= 40 ? "ELEVATED" : "NOMINAL";
  return { score, label };
}

async function fetchData() {
  const [status, stats, alerts, chains] = await Promise.all([
    api.getStatus(), api.getStatistics(), api.getAlerts({ limit: 200 }), api.getChains(),
  ]);
  return { status, stats, alerts, chains };
}

function drawHeader(doc: jsPDF, type: ReportType, id: string, dateStr: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 70, "F");
  doc.setFillColor(0, 200, 255); doc.rect(0, 70, W, 2.5, "F");
  doc.setTextColor(0, 210, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text("SENTINEL XDR", 40, 32);
  doc.setTextColor(150, 175, 205); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text("AUTONOMOUS THREAT INTELLIGENCE", 40, 46);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(TITLES[type], W - 40, 30, { align: "right" });
  doc.setTextColor(150, 175, 205); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(`Report ID: ${id}`, W - 40, 44, { align: "right" });
  doc.text(`Generated: ${dateStr}`, W - 40, 55, { align: "right" });
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(text, 40, y);
  doc.setDrawColor(...CYAN); doc.setLineWidth(1.2); doc.line(40, y + 4, 130, y + 4);
  return y + 18;
}

function paragraph(doc: jsPDF, y: number, text: string): number {
  doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const W = doc.internal.pageSize.getWidth();
  const lines = doc.splitTextToSize(text, W - 80);
  doc.text(lines, 40, y);
  return y + lines.length * 13 + 6;
}

function table(doc: jsPDF, startY: number, head: string[], body: (string | number)[][]): number {
  autoTable(doc, {
    startY,
    head: [head],
    body: body.length ? body : [["—", ...head.slice(1).map(() => "")]],
    margin: { top: 86, left: 40, right: 40, bottom: 40 },
    styles: { fontSize: 8, cellPadding: 4, textColor: TEXT, lineColor: [210, 220, 230], lineWidth: 0.3 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHTROW },
    didDrawPage: () => { /* header re-drawn in finalize for all pages */ },
  });
  // @ts-expect-error autotable augments doc at runtime
  return (doc.lastAutoTable?.finalY ?? startY) + 18;
}

export async function generateReport(type: ReportType): Promise<{ doc: jsPDF; id: string }> {
  const { status, stats, alerts, chains } = await fetchData();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const id = rid(type);
  const dateStr = new Date().toLocaleString();

  const al = alerts.alerts ?? [];
  const ch = chains.chains ?? [];
  const dist = stats.threat_distribution ?? [];
  const crit = dist.find((d) => d.threat_level === "Critical")?.count ?? 0;
  const risk = riskScore(stats);

  let y = 92;

  // ── Report meta + executive summary (page 1) ──
  doc.setTextColor(...MUTED); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`System: ${status.system?.name ?? "SENTINEL XDR"} v${status.system?.version ?? "1.0.0"}  ·  Platform: ${status.system?.platform ?? "—"}  ·  Mode: ${status.demo?.running ? "Demo telemetry" : status.sniffer?.is_running ? "Live capture" : "Idle"}`, 40, y);
  y += 18;

  y = sectionTitle(doc, y, "Executive Summary");
  const summary = `This report summarizes the current SENTINEL XDR security posture. The platform captured ${(status.sniffer?.packets_captured ?? 0).toLocaleString()} packets, recorded ${(alerts.pagination?.total ?? al.length).toLocaleString()} alerts (${crit} critical), and the AI analyzer processed ${(status.llm_analyzer?.analyzed_count ?? 0).toLocaleString()} events. MACE correlated ${ch.length} active attack chain(s). Derived risk level: ${risk.label} (${risk.score}/100).`;
  y = paragraph(doc, y, summary);

  // ── Dashboard metrics ──
  y = sectionTitle(doc, y, "Dashboard Metrics");
  y = table(doc, y, ["Metric", "Value"], [
    ["Packets captured", (status.sniffer?.packets_captured ?? 0).toLocaleString()],
    ["Critical threats", String(crit)],
    ["AI analyzed events", (status.llm_analyzer?.analyzed_count ?? 0).toLocaleString()],
    ["Alerts detected", (alerts.pagination?.total ?? al.length).toLocaleString()],
    ["Active MACE chains", String(ch.length)],
    ["Packet queue", `${status.queues?.packet_queue_size ?? 0} / ${status.queues?.packet_queue_max ?? 0}`],
    ["Risk score", `${risk.score}/100 (${risk.label})`],
  ]);

  // ── Threats / alerts / AI / packets table ──
  if (type !== "mace") {
    const rows = (type === "threats" ? al.filter((a) => a.threat_level === "Critical") : al).slice(0, 60);
    y = sectionTitle(doc, y, type === "ai" ? "AI-Analyzed Events" : type === "packets" ? "Captured / Analyzed Packets" : type === "threats" ? "Critical Threats" : "Alerts");
    y = table(doc, y, ["Sev", "Type", "Source", "Destination", "Proto", "MITRE", "Conf"],
      rows.map((a) => [
        (a.threat_level ?? "—").slice(0, 4),
        (a.attack_vector ?? "Anomaly").slice(0, 22),
        `${a.src_ip ?? "?"}${a.src_port ? ":" + a.src_port : ""}`,
        `${a.dst_ip ?? "?"}${a.dst_port ? ":" + a.dst_port : ""}`,
        a.protocol ?? "—",
        (a.mitre_technique ?? "—").slice(0, 16),
        a.confidence != null ? `${Math.round(a.confidence)}%` : "—",
      ]));
  }

  // ── MACE chains ──
  if (type === "mace" || type === "full") {
    y = sectionTitle(doc, y, "MACE Attack Chains");
    y = table(doc, y, ["Chain ID", "Score", "Kill-chain phases", "Status"],
      ch.slice(0, 30).map((c) => [
        String(c.chain_id).slice(0, 18),
        String(c.chain_score ?? 0),
        asList(c.kill_chain_phases).join(" → ").slice(0, 60) || "—",
        c.status ?? "active",
      ]));
  }

  // ── MITRE ATT&CK mapping ──
  if (type === "full" || type === "threats" || type === "mace") {
    const techniques = Array.from(new Set(al.map((a) => a.mitre_technique).filter(Boolean) as string[]));
    if (techniques.length) {
      y = sectionTitle(doc, y, "MITRE ATT&CK Mapping");
      y = table(doc, y, ["MITRE technique"], techniques.slice(0, 30).map((t) => [t]));
    }
  }

  // ── Top source IPs ──
  if (type === "full" || type === "packets") {
    const sources = stats.top_sources ?? [];
    if (sources.length) {
      y = sectionTitle(doc, y, "Top Source IPs");
      y = table(doc, y, ["Source IP", "Events"], sources.slice(0, 15).map((s) => [s.src_ip, String(s.count)]));
    }
  }

  // ── Recommended actions ──
  y = sectionTitle(doc, y, "Recommended Actions");
  const actions = Array.from(new Set(al.map((a) => a.recommended_action).filter(Boolean) as string[])).slice(0, 5);
  const recs = actions.length ? actions : [
    "Enable Demo Mode or run the local sniffer (Npcap + Admin) to collect telemetry.",
    "Review critical threats and block repeat-offender source IPs.",
    "Generate a CHRONICLE report for any active MACE chain.",
  ];
  doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  recs.forEach((r) => { const lines = doc.splitTextToSize(`•  ${r}`, doc.internal.pageSize.getWidth() - 80); doc.text(lines, 44, y); y += lines.length * 13 + 2; });
  y += 8;

  // ── Conclusion ──
  y = sectionTitle(doc, y, "Conclusion");
  y = paragraph(doc, y, `Overall risk is assessed as ${risk.label}. ${crit > 0 ? `${crit} critical threat(s) require immediate operator review.` : "No critical threats are currently outstanding."} Continue monitoring; export this report and the JSON evidence for the incident record.`);

  // ── Finalize: header + footer on every page ──
  const pages = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawHeader(doc, type, id, dateStr);
    doc.setDrawColor(...CYAN); doc.setLineWidth(0.5); doc.line(40, H - 28, W - 40, H - 28);
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text("SENTINEL XDR · Confidential — authorized recipients only", 40, H - 16);
    doc.text(`Page ${p} of ${pages}`, W - 40, H - 16, { align: "right" });
  }

  return { doc, id };
}

export async function downloadReport(type: ReportType): Promise<void> {
  const { doc, id } = await generateReport(type);
  doc.save(`${id}.pdf`);
}

export async function previewReport(type: ReportType): Promise<void> {
  const { doc } = await generateReport(type);
  const url = doc.output("bloburl");
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Single-alert PDF (Live Alert detail). */
export function downloadAlertPdf(a: Alert, nodeId?: string): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const id = `SXDR-ALERT-${a.id}-${new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14)}`;
  const dateStr = new Date().toLocaleString();
  let y = 92;
  y = sectionTitle(doc, y, "Alert Overview");
  y = table(doc, y, ["Field", "Value"], [
    ["Alert ID", String(a.id)],
    ["Timestamp", a.timestamp ?? "—"],
    ["Severity", a.threat_level ?? "—"],
    ["Vector / Type", a.attack_vector ?? "Anomaly"],
    ["Source", `${a.src_ip ?? "?"}${a.src_port ? ":" + a.src_port : ""}`],
    ["Destination", `${a.dst_ip ?? "?"}${a.dst_port ? ":" + a.dst_port : ""}`],
    ["Node ID", nodeId ?? "—"],
    ["Protocol", a.protocol ?? "—"],
    ["TCP flags", a.tcp_flags ?? "—"],
    ["MITRE technique", a.mitre_technique ?? "—"],
    ["Confidence", a.confidence != null ? `${Math.round(a.confidence)}%` : "—"],
    ["Status", a.status ?? "open"],
  ]);
  if (a.explanation) { y = sectionTitle(doc, y, "AI Analysis"); y = paragraph(doc, y, a.explanation); }
  y = sectionTitle(doc, y, "Recommended Action");
  y = paragraph(doc, y, a.recommended_action ?? "Investigate the affected node, isolate if confirmed, and generate a forensic report.");
  sectionTitle(doc, y, "Conclusion");
  paragraph(doc, y + 18, `This ${a.threat_level ?? "alert"} requires operator review. Correlate with related alerts and the active MACE chains before remediation.`);

  const pages = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawHeader(doc, "threats", id, dateStr);
    doc.setTextColor(110, 125, 145); doc.setFontSize(7.5);
    doc.text("SENTINEL XDR · Confidential — authorized recipients only", 40, H - 16);
    doc.text(`Page ${p} of ${pages}`, W - 40, H - 16, { align: "right" });
  }
  doc.save(`${id}.pdf`);
}
