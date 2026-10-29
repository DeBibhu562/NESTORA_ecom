"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="mt-2 text-muted">We couldn't load this page. Please try again.</p>
      <button onClick={reset} className="mt-6 min-h-11 rounded-sm bg-navy px-6 text-sm font-semibold text-white">Try again</button>
    </main>
  );
}
