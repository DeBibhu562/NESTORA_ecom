"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API } from "./api";

export type User = { id: string; email: string; name: string | null; phone: string | null; hasPassword: boolean; google: boolean };
type Ctx = { user: User | null; ready: boolean; reload: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => { const c = useContext(AuthCtx); if (!c) throw new Error("useAuth outside AuthProvider"); return c; };

/** POST JSON to the account API with cookies. Returns the parsed body and the first error message, if any. */
export async function account<T = unknown>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; data: T | null; error: string; code?: string }> {
  try {
    const res = await fetch(`${API}/account${path}`, { method, credentials: "include", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data, error: res.ok ? "" : data?.errors?.[0]?.message ?? data?.title ?? "Something went wrong", code: data?.code };
  } catch { return { ok: false, data: null, error: "Network error, please try again" }; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    let r = await account<User>("GET", "/me");
    if (!r.ok && (await account("POST", "/refresh")).ok) r = await account<User>("GET", "/me"); // access cookie is short-lived; the refresh cookie renews it
    setUser(r.ok ? r.data : null); setReady(true);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const value = useMemo<Ctx>(() => ({ user, ready, reload, logout: async () => { await account("POST", "/logout"); setUser(null); } }), [user, ready, reload]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
