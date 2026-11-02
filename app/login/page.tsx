"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const LOGIN_TIMEOUT_MS = 15000;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Login timed out after 15 seconds. Check your phone's network connection and whether Supabase requests are being blocked."));
        }, LOGIN_TIMEOUT_MS);
      });

      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ]);

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      if (!result.data.session) {
        setMessage("Login returned no session. Please try again.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Login request failed:", error);
      setMessage(error instanceof Error ? error.message : "An unexpected login error occurred.");
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (mountedRef.current) setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8 sm:p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-md sm:p-8">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Log in</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block font-medium text-gray-900">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
              className="w-full min-h-11 rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block font-medium text-gray-900">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
              className="w-full min-h-11 rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-md bg-black px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-sm font-semibold text-teal-700 hover:underline">
              Forgot your password?
            </Link>
          </div>
        </form>

        {message && (
          <p role="alert" aria-live="polite" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {message}
          </p>
        )}

        <p className="mt-6 text-sm text-gray-900">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold underline">Register</Link>
        </p>
      </div>
    </main>
  );
}
