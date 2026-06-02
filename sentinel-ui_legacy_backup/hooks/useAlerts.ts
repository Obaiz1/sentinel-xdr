"use client";

import useSWR from "swr";
import { fetcher, Alert } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function useAlerts(limit = 50) {
  // Use aggressive SWR polling (1000ms) to simulate real-time WebSockets
  // This bypasses the Ngrok WebSocket cookie restriction on Vercel
  const { data, error, isLoading } = useSWR<{ alerts: Alert[] }>(
    `${API_URL}/alerts?limit=${limit}`,
    fetcher,
    { 
      refreshInterval: 1000, 
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      errorRetryInterval: 3000
    }
  );

  return { 
    alerts: data?.alerts || [], 
    isConnected: !error && !isLoading 
  };
}
