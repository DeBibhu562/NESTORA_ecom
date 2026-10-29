import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for has moved or no longer exists.</p>
      <Link href="/c/bottles" className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-navy px-6 text-sm font-semibold text-white">Browse bottles</Link>
    </main>
  );
}
