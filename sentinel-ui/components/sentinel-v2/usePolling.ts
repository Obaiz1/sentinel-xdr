"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";

export type FetchState = "loading" | "data" | "empty" | "error" | "offline";

export interface PollingResult<T> {
  data: T | null;
  state: FetchState;
  error: ApiError | null;
  refetch: () => void;
}

/**
 * usePolling — runs an async fetcher immediately + on an interval, deriving a
 * UI state (loading / data / empty / error / offline). `isEmpty` decides when
 * a successful response should render the empty state instead of data.
 */
export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  isEmpty?: (data: T) => boolean,
): PollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<FetchState>("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const fetcherRef = useRef(fetcher);
  const emptyRef = useRef(isEmpty);
  useEffect(() => {
    fetcherRef.current = fetcher;
    emptyRef.current = isEmpty;
  });

  const run = useCallback(async (signal: AbortSignal) => {
    try {
      const result = await fetcherRef.current(signal);
      if (signal.aborted) return;
      setData(result);
      setError(null);
      setState(emptyRef.current?.(result) ? "empty" : "data");
    } catch (e) {
      if (signal.aborted) return;
      const err = e instanceof ApiError ? e : new ApiError("http", String(e));
      setError(err);
      setState(err.kind === "offline" || err.kind === "timeout" ? "offline" : "error");
    }
  }, []);

  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal);
    const id = setInterval(() => {
      if (!controller.signal.aborted) run(controller.signal);
    }, intervalMs);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [run, intervalMs, nonce]);

  return { data, state, error, refetch };
}
