"use client";
import { Button } from "@app/ui";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ConfirmOpts = { title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean };
type Ctx = { toast: (message: string, tone?: "ok" | "error") => void; confirm: (o: ConfirmOpts) => Promise<boolean> };
const FeedbackCtx = createContext<Ctx | null>(null);
export const useFeedback = () => useContext(FeedbackCtx)!;

/** Toasts live in a polite live region; confirm uses a native <dialog> (focus trap + Escape for free). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: "ok" | "error" }[]>([]);
  const [ask, setAsk] = useState<(ConfirmOpts & { resolve: (ok: boolean) => void }) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const toast = useCallback<Ctx["toast"]>((message, tone = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 4000);
  }, []);
  const confirm = useCallback<Ctx["confirm"]>((o) => new Promise((resolve) => setAsk({ ...o, resolve })), []);

  useEffect(() => { if (ask && !dialog.current?.open) dialog.current?.showModal(); }, [ask]);
  const close = (ok: boolean) => { ask?.resolve(ok); setAsk(null); dialog.current?.close(); };

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((t) => <p key={t.id} className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.tone === "error" ? "bg-brand" : "bg-navy"}`}>{t.message}</p>)}
      </div>
      <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); close(false); }} aria-labelledby="confirm-title" className="m-auto w-full max-w-md rounded-2xl p-6 backdrop:bg-black/40">
        {ask && (
          <div className="space-y-4">
            <h2 id="confirm-title" className="text-xl">{ask.title}</h2>
            {ask.body && <div className="text-sm text-muted">{ask.body}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
              <Button onClick={() => close(true)} className={ask.danger ? "!bg-brand" : ""}>{ask.confirmLabel ?? "Confirm"}</Button>
            </div>
          </div>
        )}
      </dialog>
    </FeedbackCtx.Provider>
  );
}
