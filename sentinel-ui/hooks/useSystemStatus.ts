"use client";

import useSWR from "swr";
import { fetcher, SystemStatus } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function useSystemStatus(refreshInterval = 3000) {
  const { data, error, isLoading } = useSWR<SystemStatus>(
    `${API_URL}/status`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      errorRetryCount: 3,
    }
  );

  return {
    status: data ?? null,
    isLoading,
    isError: !!error,
  };
}
