"use client";
// Small fetch helper + hook with loading / error states for API routes.
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public fields?: Record<string, string[]>,
  ) {
    super(code);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("offline", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "server", res.status, (data as { fields?: Record<string, string[]> }).fields);
  return data as T;
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    api<T>(url)
      .then((d) => {
        if (id === seq.current) setData(d);
      })
      .catch((e: ApiError) => {
        if (id === seq.current) {
          setError(e);
          setData(null);
        }
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}
