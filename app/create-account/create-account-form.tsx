"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CreateAccountForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setMessage("Creating your account...");

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const next = encodeURIComponent("/login?signup=confirmed");

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${next}`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
        setIsLoading(false);
        return;
      }

      setMessage(
        "Account created. Check your email and click the confirmation link before signing in.",
      );
      setFirstName("");
      setLastName("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(
        `Unexpected error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-neutral-300">
            First name
          </label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
            placeholder="First name"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-300">
            Last name
          </label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
            placeholder="Last name"
          />
        </div>
      </div>

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
        <label className="text-sm font-medium text-neutral-300">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          placeholder="Create a password"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-300">
          Confirm password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          placeholder="Confirm your password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-70"
      >
        {isLoading ? "Creating Account..." : "Create Account"}
      </button>

      {message && <p className="text-sm leading-6 text-neutral-300">{message}</p>}
    </form>
  );
}
