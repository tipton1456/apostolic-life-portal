"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("Signing in...");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/contact";
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

      <button
        type="submit"
        className="w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-lime-300"
      >
        Sign In
      </button>

      {message && (
        <p className="text-sm text-neutral-300">
          {message}
        </p>
      )}
    </form>
  );
}