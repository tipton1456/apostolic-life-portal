"use client";

import { useState } from "react";
import { completePasswordReset } from "@/lib/portal-users";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordForm() {
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
    setMessage("Updating password...");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(`Error: ${error.message}`);
        setIsLoading(false);
        return;
      }

      await completePasswordReset();
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
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label className="text-sm font-medium text-neutral-300">
          New password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          placeholder="Create a new password"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-300">
          Confirm new password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          placeholder="Confirm new password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Updating Password..." : "Update Password"}
      </button>

      {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
    </form>
  );
}
