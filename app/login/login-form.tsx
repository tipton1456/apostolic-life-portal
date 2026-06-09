"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setMessage("Signing in...");

    try {
      if (email.trim().toLowerCase() === "demo" && password === "demo") {
        const response = await fetch("/api/demo-login", {
          body: JSON.stringify({ password, username: email }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({
            message: "Demo login failed.",
          }));
          setMessage(`Error: ${data.message}`);
          setIsLoading(false);
          return;
        }

        window.location.href = "/dashboard";
        return;
      }

      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
        setIsLoading(false);
        return;
      }

      if (!data.session) {
        setMessage("Error: No session was returned from Supabase.");
        setIsLoading(false);
        return;
      }

      if (!rememberMe) {
        convertSupabaseCookiesToSessionCookies();
      }

      const { data: portalUser, error: profileError } = await supabase
        .from("portal_users")
        .select("must_reset_password")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (profileError) {
        setMessage(`Error: ${profileError.message}`);
        setIsLoading(false);
        return;
      }

      if (portalUser?.must_reset_password) {
        window.location.href = "/change-password";
        return;
      }

      window.location.href = "/dashboard";
    } catch (error) {
      setMessage(
        `Unexpected error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="mt-8 space-y-4">
      <div>
        <label className="text-sm font-medium text-neutral-300">
          Email address or demo username
        </label>

        <input
          type="text"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          placeholder="you@example.com or demo"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-300">
          Password
        </label>

        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          placeholder="Enter password"
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-lime-400 accent-lime-400"
        />
        Remember me
      </label>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Signing In..." : "Sign In"}
      </button>

      {message && <p className="text-sm text-neutral-300">{message}</p>}
    </form>
  );
}

function convertSupabaseCookiesToSessionCookies() {
  const isSecure = window.location.protocol === "https:";
  const cookieAttributes = `path=/; SameSite=Lax${isSecure ? "; Secure" : ""}`;

  document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith("sb-"))
    .forEach((cookie) => {
      const separatorIndex = cookie.indexOf("=");

      if (separatorIndex === -1) return;

      const name = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);

      document.cookie = `${name}=${value}; ${cookieAttributes}`;
    });
}
