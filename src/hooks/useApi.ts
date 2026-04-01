"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useCallback } from "react";

export function useApi() {
  const { getIdToken } = useAuth();

  const apiFetch = useCallback(
    async <T>(url: string, options: RequestInit = {}): Promise<T> => {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Timezone":
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...options.headers,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${res.status}`);
      }

      return res.json();
    },
    [getIdToken]
  );

  return { apiFetch };
}
