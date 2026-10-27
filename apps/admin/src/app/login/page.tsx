"use client";
import { Button } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Card, Field, Input, Problems } from "@/components/form";
import { ApiError, post } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(undefined);
    try {
      await post("/admin/auth/login", { email: f.get("email"), password: f.get("password"), ...(f.get("totp") ? { totp: f.get("totp") } : {}) });
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOTP_REQUIRED") setNeedTotp(true);
      else setError(err);
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <Card title="Sign in">
          <Field label="Email"><Input name="email" type="email" required autoComplete="username" autoFocus /></Field>
          <Field label="Password"><Input name="password" type="password" required autoComplete="current-password" /></Field>
          {needTotp && <Field label="Authenticator code"><Input name="totp" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoFocus autoComplete="one-time-code" /></Field>}
          <Problems error={error} />
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
        </Card>
      </form>
    </main>
  );
}
