"use client";
import { Button } from "@app/ui";
import { useState } from "react";
import { Card, Field, Input, Problems } from "@/components/form";
import { post } from "@/lib/api";

export default function Security() {
  const [error, setError] = useState<unknown>();
  const [done, setDone] = useState(false);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl">Security</h1>
      <Card title="Change password">
        <p className="text-sm text-muted">Changing it signs out every other device; each will need a new emailed code next time.</p>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setError(undefined); setDone(false);
          const f = new FormData(e.currentTarget);
          try { await post("/admin/auth/password", { current: f.get("current"), password: f.get("password") }); setDone(true); e.currentTarget.reset(); } catch (err) { setError(err); }
        }}>
          <Field label="Current password"><Input name="current" type="password" required autoComplete="current-password" /></Field>
          <Field label="New password (12+ characters)"><Input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></Field>
          <Problems error={error} />
          {done && <p className="text-sm">Password changed.</p>}
          <Button type="submit">Change password</Button>
        </form>
      </Card>
    </div>
  );
}
