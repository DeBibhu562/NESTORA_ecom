"use client";
import { Button } from "@app/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { account, useAuth } from "@/lib/auth";
import { googleConfigured, googleIdToken } from "@/lib/firebase";

type Mode = "signin" | "signup" | "code" | "forgot";
const inputCls = "min-h-11 w-full rounded-lg border border-line bg-white px-3 focus-visible:outline-2 focus-visible:outline-brand";
const TITLE: Record<Mode, string> = { signin: "Sign in", signup: "Create your account", code: "Sign in with an email code", forgot: "Reset your password" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="font-semibold">{label}</span>{children}</label>;
}

export default function Login() {
  const router = useRouter();
  const { reload } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [verifying, setVerifying] = useState(false); // second step: enter the emailed code
  const [f, setF] = useState({ name: "", email: "", password: "", code: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const go = (m: Mode) => { setMode(m); setVerifying(false); setError(""); setInfo(""); };

  async function done() {
    await reload();
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account"); // same-site paths only
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setInfo("");
    const email = f.email.trim();
    let r;
    if (verifying && mode === "forgot") {
      r = await account("POST", "/reset", { email, code: f.code, password: f.password });
      if (r.ok) { go("signin"); setInfo("Password updated. Please sign in."); setBusy(false); return; }
    } else if (verifying) {
      r = await account("POST", "/verify", { email, code: f.code });
      if (r.ok) return void (await done());
    } else if (mode === "signin") {
      r = await account("POST", "/login", { email, password: f.password });
      if (r.ok) return void (await done());
      if (r.code === "EMAIL_UNVERIFIED") { setVerifying(true); setInfo("We've emailed you a 6-digit code to verify your address."); setError(""); setBusy(false); return; }
    } else if (mode === "signup") {
      r = await account("POST", "/register", { name: f.name, email, password: f.password });
      if (r.ok) { setVerifying(true); setInfo(`Check ${email}. A 6-digit code is on its way. If you already have an account, we have emailed you instead: sign in or reset your password.`); setBusy(false); return; }
    } else {
      r = await account("POST", mode === "code" ? "/code" : "/forgot", { email });
      if (r.ok) { setVerifying(true); setInfo(`If ${email} can receive mail, a 6-digit code is on its way.`); setBusy(false); return; }
    }
    setError(r.error); setBusy(false);
  }

  async function google() {
    setBusy(true); setError("");
    try {
      const r = await account("POST", "/google", { idToken: await googleIdToken() });
      if (r.ok) return void (await done());
      setError(r.error);
    } catch (er) {
      if ((er as { code?: string }).code !== "auth/popup-closed-by-user") setError("Google sign-in failed, please try again");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-10">
      <h1 className="text-3xl">{verifying ? (mode === "forgot" ? "Choose a new password" : "Enter your code") : TITLE[mode]}</h1>
      {info && <p role="status" className="rounded-lg bg-soft p-3 text-sm">{info}</p>}
      <form onSubmit={submit} className="space-y-4" aria-label={TITLE[mode]}>
        {mode === "signup" && !verifying && <Field label="Full name"><input className={inputCls} value={f.name} onChange={set("name")} autoComplete="name" required maxLength={80} /></Field>}
        <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={set("email")} autoComplete="email" required readOnly={verifying} /></Field>
        {verifying && <Field label="6-digit code"><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></Field>}
        {((mode === "signin" || mode === "signup") && !verifying || (mode === "forgot" && verifying)) && (
          <Field label={mode === "forgot" ? "New password" : "Password"}><input className={inputCls} type="password" value={f.password} onChange={set("password")} autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={mode === "signin" ? 1 : 8} maxLength={128} /></Field>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-brand">{error}</p>}
        <Button type="submit" variant="secondary" disabled={busy} className="w-full">{busy ? "Please wait…" : verifying ? (mode === "forgot" ? "Update password" : "Verify and continue") : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send code"}</Button>
      </form>

      {!verifying && googleConfigured && (
        <>
          <p className="text-center text-xs text-muted">or</p>
          <Button variant="primary" onClick={google} disabled={busy} className="w-full bg-white text-ink ring-1 ring-line hover:bg-soft">Continue with Google</Button>
        </>
      )}

      <nav aria-label="Other options" className="flex flex-wrap justify-between gap-2 text-sm underline">
        {mode !== "signin" && <button type="button" onClick={() => go("signin")}>Sign in with password</button>}
        {mode !== "signup" && <button type="button" onClick={() => go("signup")}>Create an account</button>}
        {mode !== "code" && <button type="button" onClick={() => go("code")}>Email me a code</button>}
        {mode === "signin" && <button type="button" onClick={() => go("forgot")}>Forgot password?</button>}
      </nav>
      <p className="text-center text-sm"><Link href="/track" className="underline">Track an order without an account</Link></p>
    </main>
  );
}
