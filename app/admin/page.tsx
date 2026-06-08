import { redirect } from "next/navigation";
import {
  createPortalUser,
  deletePortalUser,
  getCurrentPortalUser,
  listPortalUsers,
  updatePortalUser,
} from "@/lib/portal-users";
import { hasAdminClientConfig } from "@/lib/supabase/admin";

export default async function AdminPage() {
  if (!hasAdminClientConfig()) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-3xl font-bold">Setup Required</h1>
          <p className="mt-3 text-neutral-400">
            Add the server-only Supabase service role key to enable portal user
            management.
          </p>
        </div>
      </main>
    );
  }

  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-3xl font-bold">Access Restricted</h1>
          <p className="mt-3 text-neutral-400">
            This page is only available to portal administrators.
          </p>
        </div>
      </main>
    );
  }

  const users = await listPortalUsers();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Portal Users
          </h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            Create, update, and remove users who can sign in to the portal.
          </p>
        </header>

        <details className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-semibold marker:hidden">
            <span>Add User</span>
            <span className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950">
              Add User
            </span>
          </summary>
          <form
            action={createPortalUser}
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
            <button
              type="submit"
              className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300 lg:col-start-5"
            >
              Create User
            </button>
          </form>
        </details>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="grid grid-cols-[1.1fr_1.4fr_0.7fr_1fr_auto] gap-4 border-b border-white/10 px-5 py-3 text-xs uppercase tracking-[0.18em] text-neutral-500 max-lg:hidden">
            <span>Name</span>
            <span>Email</span>
            <span>Admin</span>
            <span>Last Sign In</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-white/10">
            {users.map((user) => (
              <UserRow
                key={user.id}
                currentUserId={currentUser.id}
                user={user}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function UserRow({
  currentUserId,
  user,
}: {
  currentUserId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isAdmin: boolean;
    lastSignInAt: string | null;
  };
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-white/[0.05] marker:hidden lg:grid-cols-[1.1fr_1.4fr_0.7fr_1fr_auto] lg:items-center lg:gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Name
          </p>
          <p className="font-semibold text-neutral-100">
            {fullName || "Name not set"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Email
          </p>
          <p className="break-all text-neutral-300">{user.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Admin
          </p>
          {user.isAdmin ? (
            <span className="inline-flex items-center gap-2 text-neutral-200">
              <span
                aria-label="Admin"
                title="Admin"
                className="h-2.5 w-2.5 rounded-full bg-green-400"
              />
              Admin
            </span>
          ) : (
            <span className="text-neutral-500">User</span>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Last Sign In
          </p>
          <p className="text-neutral-300">{formatDateTime(user.lastSignInAt)}</p>
        </div>
        <div className="flex items-center gap-2 lg:justify-end">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-lime-300 transition group-open:border-lime-300/60 group-open:bg-lime-400/10"
            aria-label={`Update ${user.email}`}
            title={`Update ${user.email}`}
          >
            <PencilIcon />
          </span>
        </div>
      </summary>
      <div className="px-5 pb-5">
        <form
          id={`update-${user.id}`}
          action={updatePortalUser}
          className="grid gap-4 rounded-xl border border-white/10 bg-neutral-950/40 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1fr_auto]"
        >
          <input type="hidden" name="id" value={user.id} />
          <Field
            label="First name"
            name="firstName"
            defaultValue={user.firstName}
          />
          <Field
            label="Last name"
            name="lastName"
            defaultValue={user.lastName}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={user.email}
            required
          />
          <Field
            label="New password"
            name="password"
            type="password"
            minLength={8}
            placeholder="Leave blank"
          />
          <label className="flex items-end gap-2 pb-3 text-sm text-neutral-300">
            <input
              type="checkbox"
              name="isAdmin"
              defaultChecked={user.isAdmin}
              disabled={user.id === currentUserId}
              className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-lime-400 accent-lime-400 disabled:opacity-60"
            />
            Admin
          </label>
          {user.id === currentUserId ? (
            <p className="text-xs text-neutral-500 md:col-span-2 xl:col-span-4">
              Your admin access is locked here.
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300 md:w-fit"
          >
            Save User
          </button>
        </form>
        <form action={deletePortalUser} className="mt-3 flex justify-end">
          <input type="hidden" name="id" value={user.id} />
          <button
            type="submit"
            disabled={user.id === currentUserId}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:border-red-300/60 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              user.id === currentUserId
                ? "You cannot delete your own account"
                : `Delete ${user.email}`
            }
          >
            <TrashIcon />
            Delete User
          </button>
        </form>
      </div>
    </details>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  minLength,
  autoComplete,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
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
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
