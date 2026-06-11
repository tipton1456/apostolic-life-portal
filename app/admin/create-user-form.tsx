"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createPortalUserWithState,
  type PortalActionState,
} from "@/lib/portal-users";
import AdminFormButton from "./admin-form-button";

const initialState: PortalActionState = {
  message: "",
  status: "idle",
  version: 0,
};

export default function CreateUserForm() {
  const [state, formAction] = useActionState(
    createPortalUserWithState,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;

    formRef.current?.reset();
    router.refresh();
  }, [router, state.status, state.version]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-[1fr_1fr_1.3fr_1fr_auto]"
    >
      <Field label="First name" name="firstName" autoComplete="given-name" />
      <Field label="Last name" name="lastName" autoComplete="family-name" />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        label="Temporary password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      <label className="flex items-end gap-2 pb-3 text-sm text-neutral-300">
        <input
          type="checkbox"
          name="isAdmin"
          className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-lime-400 accent-lime-400"
        />
        Admin
      </label>
      <label className="flex items-end gap-2 pb-3 text-sm text-neutral-300">
        <input
          type="checkbox"
          name="canAccessProjects"
          className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-lime-400 accent-lime-400"
        />
        Project Management
      </label>
      <AdminFormButton pendingLabel="Creating..." className="lg:col-start-5">
        Create User
      </AdminFormButton>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-sm text-red-300 lg:col-span-5"
              : "text-sm text-lime-300 lg:col-span-5"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  minLength,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}
