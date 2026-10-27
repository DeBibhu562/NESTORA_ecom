"use client";
import { Button } from "@app/ui";
import { useState } from "react";
import { Card, Field, Input, Problems } from "@/components/form";
import { post } from "@/lib/api";
import { useMe } from "@/lib/me";

export default function Security() {
  const me = useMe();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [done, setDone] = useState(me.totpEnabled);
  const [error, setError] = useState<unknown>();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl">Security</h1>
      <Card title="Two-factor authentication">
        {done ? <p>Enabled. You will be asked for an authenticator code at every sign-in.</p> : !setup ? (
          <>
            <p className="text-sm text-muted">Use an authenticator app (Google Authenticator, 1Password, Authy).</p>
            <Button onClick={async () => { setError(undefined); try { setSetup(await post("/admin/auth/totp/setup")); } catch (e) { setError(e); } }}>Start setup</Button>
          </>
        ) : (
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault(); setError(undefined);
            try { await post("/admin/auth/totp/enable", { code: new FormData(e.currentTarget).get("code") }); setDone(true); } catch (err) { setError(err); }
          }}>
            <p className="text-sm">Add this key in your app (type it in, or open the link on your phone):</p>
            <code className="block break-all rounded bg-soft p-2 text-sm">{setup.secret}</code>
            <a className="text-sm underline" href={setup.otpauthUrl}>Open in authenticator</a>
            <Field label="6-digit code"><Input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" /></Field>
            <Button type="submit">Verify and enable</Button>
          </form>
        )}
        <Problems error={error} />
      </Card>
    </div>
  );
}
