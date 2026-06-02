/**
 * Centralised backend client — ALWAYS adds the ngrok bypass header.
 * All components must use these helpers instead of raw fetch().
 */

export const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const NGROK_HEADERS = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

/** Generic JSON GET */
export async function backendGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { headers: NGROK_HEADERS });
  if (!res.ok) throw new Error(`Backend ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Generic JSON POST */
export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: NGROK_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Backend ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Streaming POST — returns the ReadableStream body directly */
export async function backendStream(path: string, body: unknown): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: NGROK_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`Backend stream ${path} → HTTP ${res.status}`);
  return res.body;
}
