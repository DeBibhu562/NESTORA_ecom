"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function AccountButton() {
  const { user, ready } = useAuth();
  return (
    <Link href={user ? "/account" : "/login"} aria-label={user ? "Your account" : "Sign in"} className="grid size-11 place-items-center rounded-full hover:bg-soft">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
      {ready && user && <span className="sr-only">{user.name ?? user.email}</span>}
    </Link>
  );
}
