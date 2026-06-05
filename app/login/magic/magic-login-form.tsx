"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MagicLoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setMessage("Sending sign-in link...");

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/contact`,
        },
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
        setIsLoading(false);
        return;
      }

      setMessage("Check your email for a sign-in link.");
      setIsLoading(false);
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
          Email address
        </label>

        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-70"
      >
        {isLoading ? "Sending Link..." : "Send Sign-In Link"}
      </button>

      {message && <p className="text-sm text-neutral-300">{message}</p>}
    </form>
  );
}
