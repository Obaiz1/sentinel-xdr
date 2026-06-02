"use client";

import useSWR from "swr";
import { fetcher, Statistics } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function useStatistics(refreshInterval = 2000) {
  const { data, error, isLoading } = useSWR<Statistics>(
    `${API_URL}/statistics`,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: false,
      errorRetryCount: 3,
    }
  );

  return {
    stats: data ?? null,
    isLoading,
    isError: !!error,
  };
}
