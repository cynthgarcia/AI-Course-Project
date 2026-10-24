"use client";

import Link from "next/link";
import { useState } from "react";
import { btn } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Something went wrong. Please try again.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="font-serif text-2xl">
          Your Life <span className="italic text-accent">Curator</span>
        </p>
        <h1 className="mt-6 font-serif text-3xl">{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted">{signup ? "Your plans, history and preferences are private to you." : "Sign in to see what's worth doing soon."}</p>
      </div>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label className="block text-sm">
          Email
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2.5" />
        </label>
        <label className="block text-sm">
          Password
          <input
            id="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2.5"
          />
          {signup && <span className="mt-1 block text-xs text-muted">At least 10 characters.</span>}
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${btn.primary} w-full py-3`}>
          {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-muted">
        {signup ? "Already have an account? " : "New here? "}
        <Link href={signup ? "/login" : "/signup"} className="text-accent underline">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}
