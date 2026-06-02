// ── Typed API client for the IDS FastAPI backend ─────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit,
  retries = 2
): Promise<T> {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(options?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return request<T>(path, options, retries - 1);
    }
    throw err;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface SystemStatus {
  system: {
    name: string;
    version: string;
    platform: string;
  };
  sniffer: {
    is_running: boolean;
    interface: string;
    bpf_filter: string | null;
    packets_captured: number;
    packets_dropped: number;
    start_time: number | null;
  };
  triage: {
    packets_processed: number;
    packets_flagged: number;
    queue_size: number;
  };
  llm_analyzer: {
    analyzed_count: number;
    error_count: number;
    queue_size: number;
  };
  queues: {
    packet_queue_size: number;
    packet_queue_max: number;
    llm_queue_size: number;
    llm_queue_max: number;
  };
  database: {
    path: string;
    connected: boolean;
  };
}

export interface Alert {
  id: number;
  timestamp: number;
  src_ip: string;
  dst_ip: string;
  src_port: number | null;
  dst_port: number | null;
  protocol: string;
  threat_level: "Critical" | "High" | "Medium" | "Low" | null;
  attack_vector: string | null;
  explanation: string | null;
  recommended_action: string | null;
  status: "pending" | "analyzed" | "error";
  raw_payload_hex: string | null;
}

export interface Statistics {
  threat_distribution: Array<{ threat_level: string; count: number }>;
  top_sources: Array<{ src_ip: string; count: number }>;
  protocol_breakdown: Array<{ protocol: string; count: number }>;
  top_attack_vectors: Array<{ attack_vector: string; count: number }>;
  timeline: Array<{ minute_bucket: number; count: number; threat_level: string }>;
  counts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  real_time: {
    sniffer: any;
    triage: any;
    llm: any;
  };
}

// ── Fetcher (for SWR) ─────────────────────────────────────────────────────

export const fetcher = (url: string) => fetch(url, { headers: { "ngrok-skip-browser-warning": "true" } }).then((r) => r.json());

// ── API calls ─────────────────────────────────────────────────────────────

export const api = {
  getStatus: () => request<SystemStatus>("/status"),
  getAlerts: (limit = 50) => request<{ alerts: Alert[] }>("/alerts?limit=" + limit),
  getStatistics: () => request<Statistics>("/statistics"),
  getInterfaces: () => request<{ interfaces: string[] }>("/interfaces"),

  startSentinel: (iface: string) =>
    request("/toggle-sniffing", {
      method: "POST",
      body: JSON.stringify({ interface: iface }),
    }),

  stopSentinel: () => request("/toggle-sniffing", { method: "POST" }),

  analyzePacket: (packetData: any) =>
    request("/analyze-sample", {
      method: "POST",
      body: JSON.stringify(packetData),
    }),
};
