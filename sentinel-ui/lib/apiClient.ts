/**
 * apiClient.ts — single, robust data layer for the SENTINEL XDR (v2) UI.
 *
 * - Base URL: NEXT_PUBLIC_API_BASE_URL (preferred) → NEXT_PUBLIC_API_URL (fallback)
 *   → http://127.0.0.1:8000 (dev default).
 * - Always sends `ngrok-skip-browser-warning: true` (harmless on non-tunnel hosts).
 * - Per-request timeout (default 8s) via AbortController.
 * - Light retry (default 1 extra attempt) for transient network/5xx failures.
 * - Typed errors that distinguish OFFLINE vs HTTP vs TIMEOUT vs PARSE, so the UI
 *   can render offline / error / empty states correctly (never infinite spinners).
 * - NEVER calls an LLM directly; ARIA goes only through the backend /api/aria/chat.
 *
 * Legacy components keep using lib/backend.ts — this client is additive.
 */

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 1;

export type ApiErrorKind = "offline" | "http" | "timeout" | "parse";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

function buildUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller passed a signal, abort our controller when it fires.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(buildUrl(path), {
      method,
      headers: BASE_HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Core JSON request with timeout + retry + typed errors. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await rawFetch(path, opts);

      if (!res.ok) {
        // Retry only transient 5xx; surface 4xx immediately.
        const err = new ApiError("http", `Backend ${path} → HTTP ${res.status}`, res.status);
        if (res.status >= 500 && attempt < retries) {
          lastError = err;
          continue;
        }
        throw err;
      }

      // 204 / empty body guard.
      const text = await res.text();
      if (!text) return undefined as unknown as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError("parse", `Backend ${path} → invalid JSON`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.kind === "http" && (e.status ?? 0) < 500) throw e; // don't retry 4xx
        if (e.kind === "parse") throw e;
        lastError = e;
      } else if (e instanceof DOMException && e.name === "AbortError") {
        lastError = new ApiError("timeout", `Backend ${path} → timed out`);
      } else {
        // Network failure (fetch threw) → backend unreachable / offline.
        lastError = new ApiError("offline", `Backend ${path} → unreachable`);
      }
      if (attempt >= retries) break;
    }
  }

  throw lastError ?? new ApiError("offline", `Backend ${path} → unreachable`);
}

function get<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>(path, { ...opts, method: "GET" });
}
function post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>(path, { ...opts, method: "POST", body: body ?? {} });
}

/* ── Types (shapes from API_REQUIREMENTS_MAP.md) ─────────────────────── */

export interface SystemStatus {
  system?: { status?: string; version?: string; name?: string; platform?: string };
  sniffer?: { is_running?: boolean; packets_captured?: number; interface?: string };
  demo?: { running?: boolean; generated?: number };
  triage?: { packets_flagged?: number };
  llm_analyzer?: { is_running?: boolean; analyzed_count?: number; queue_size?: number };
  rag_engine?: { initialized?: boolean; document_count?: number };
  database?: { connected?: boolean };
  queues?: {
    packet_queue_size?: number;
    packet_queue_max?: number;
    llm_queue_size?: number;
    llm_queue_max?: number;
  };
}

export interface InterfacesResponse {
  interfaces: string[];
  current?: string;
  count?: number;
}

export interface Alert {
  id: number | string;
  timestamp: string;
  src_ip?: string;
  dst_ip?: string;
  src_port?: number;
  dst_port?: number;
  protocol?: string;
  tcp_flags?: string;
  triage_flags?: string[] | string;
  threat_level?: "Critical" | "High" | "Medium" | "Low" | string;
  confidence?: number;
  attack_vector?: string;
  mitre_technique?: string;
  explanation?: string;
  recommended_action?: string;
  status?: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  pagination?: { total?: number; limit?: number; offset?: number };
  filters?: Record<string, unknown>;
}

export interface RecentAlertsResponse {
  alerts: Alert[];
  count?: number;
}

export interface CountPair {
  count: number;
}
export interface Statistics {
  threat_distribution?: Array<{ threat_level: string } & CountPair>;
  protocol_breakdown?: Array<{ protocol: string } & CountPair>;
  threat_timeline?: Array<{ minute_bucket: string } & CountPair>;
  top_attack_vectors?: Array<{ attack_vector: string } & CountPair>;
  top_sources?: Array<{ src_ip: string } & CountPair>;
  counts?: Record<string, number>;
  real_time?: Record<string, unknown>;
}

export interface Chain {
  chain_id: string;
  actor_id?: string;
  chain_score?: number;
  kill_chain_phases?: string[] | string;
  mitre_techniques?: string[] | string;
  first_seen?: string;
  last_seen?: string;
  status?: string;
  attacker_intent?: string;
  ai_confidence?: number;
}
export interface ChainsResponse {
  chains: Chain[];
}

export type EngineId = "mace" | "aria" | "adrs" | "phantom" | "aegis" | "chronicle";

export interface EngineResult {
  engine?: string;
  status?: "success" | "error" | "empty" | "not_configured" | string;
  title?: string;
  summary?: string;
  metrics?: Record<string, unknown>;
  items?: Array<{ label: string; value: string | number }>;
  timestamp?: string;
}

export interface ChronicleReport {
  report_id?: string;
  chain_id?: string;
  actor_id?: string;
  executive_summary?: string;
  technical_details?: string;
  generated_at?: string;
}

export interface ToggleSniffingResponse {
  action?: "started" | "stopped" | string;
  message?: string;
  session_id?: string;
  stats?: Record<string, unknown>;
}

export interface DemoResponse {
  action?: string;
  demo?: { running?: boolean; generated?: number };
}

/* ── Typed endpoint helpers ──────────────────────────────────────────── */

export const api = {
  // System / health
  getStatus: (opts?: RequestOptions) => get<SystemStatus>("/status", opts),
  getInterfaces: (opts?: RequestOptions) => get<InterfacesResponse>("/interfaces", opts),

  // Sniffer / capture
  toggleSniffing: (body?: { interface?: string; bpf_filter?: string }) =>
    post<ToggleSniffingResponse>("/toggle-sniffing", body ?? {}),
  startDemo: () => post<DemoResponse>("/api/sniffer/demo/start", {}),
  stopDemo: () => post<DemoResponse>("/api/sniffer/demo/stop", {}),

  // Alerts
  getAlerts: (params?: { limit?: number; offset?: number; level?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.offset != null) q.set("offset", String(params.offset));
    if (params?.level) q.set("level", params.level);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return get<AlertsResponse>(`/alerts${qs ? `?${qs}` : ""}`);
  },
  getRecentAlerts: (opts?: RequestOptions) => get<RecentAlertsResponse>("/alerts/recent", opts),
  getAlertById: (id: number | string, opts?: RequestOptions) => get<Alert>(`/alerts/${id}`, opts),

  // Analytics
  getStatistics: (opts?: RequestOptions) => get<Statistics>("/statistics", opts),

  // MACE / engines
  getChains: (opts?: RequestOptions) => get<ChainsResponse>("/chains", opts),
  runEngine: (engine: EngineId) => post<EngineResult>(`/api/engines/${engine}/run`, {}),
  generateChronicle: (chainId: string) => post<ChronicleReport>(`/api/chronicle/${chainId}`, {}),
};

/* ── Deep Learning IDS API (separate FastAPI service) ────────────────────
 * The DL model is served by deployment/dl_api.py — a DIFFERENT service from the
 * XDR backend, so it has its own base URL. Defaults to the public Hugging Face
 * Space deployment; override with NEXT_PUBLIC_DL_API_URL (e.g. http://127.0.0.1:8000
 * for a local DL API). Unreachable → honest offline/error state (never faked).
 */
const DEFAULT_DL_API_URL = "https://obaiz-sentinel-xdr-dl.hf.space";
export const DL_API_URL: string = (process.env.NEXT_PUBLIC_DL_API_URL ?? DEFAULT_DL_API_URL).replace(/\/$/, "");
export const DL_API_CONFIGURED = DL_API_URL.length > 0;

export interface DlFlowInput {
  duration: number;
  protocol_type: string;
  service: string;
  src_bytes: number;
  dst_bytes: number;
  count: number;
  srv_count: number;
  same_srv_rate: number;
}

export interface DlPrediction {
  label: number; // 0 = normal, 1 = attack
  label_name: string;
  attack_probability: number;
  confidence: number;
}

export interface DlPredictResponse {
  model_path: string;
  threshold: number;
  count: number;
  predictions: DlPrediction[];
}

export interface DlHealth {
  status: string;
  model_loaded: boolean;
  model_path?: string;
  threshold?: number;
  reason?: string;
}

async function dlFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!DL_API_CONFIGURED) {
    throw new ApiError("offline", "DL API not configured (set NEXT_PUBLIC_DL_API_URL)");
  }
  const { method = "GET", body, timeoutMs = 12000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${DL_API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      headers: BASE_HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError("timeout", `DL API ${path} → timed out`);
    }
    throw new ApiError("offline", `DL API ${path} → unreachable`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new ApiError("http", `DL API ${path} → HTTP ${res.status}`, res.status);
  }
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("parse", `DL API ${path} → invalid JSON`);
  }
}

export const dlApi = {
  configured: DL_API_CONFIGURED,
  baseUrl: DL_API_URL,
  health: () => dlFetch<DlHealth>("/health"),
  predict: (flows: DlFlowInput[]) =>
    dlFetch<DlPredictResponse>("/predict", { method: "POST", body: { flows } }),
};

/**
 * Stream ARIA chat (text/plain SSE-style chunks) from the Python backend.
 * Yields decoded text chunks. Backend handles provider fallback + context injection.
 */
export async function* streamAriaChat(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  let res: Response;
  try {
    res = await fetch(buildUrl("/api/aria/chat"), {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({ message, history }),
      signal,
    });
  } catch {
    throw new ApiError("offline", "ARIA backend unreachable");
  }
  if (!res.ok || !res.body) {
    throw new ApiError("http", `ARIA → HTTP ${res.status}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
