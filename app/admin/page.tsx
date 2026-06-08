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

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-semibold">Add User</h2>
          <form
            action={createPortalUser}
            className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr_1fr_auto]"
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
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Admin</th>
                  <th className="px-5 py-3 font-medium">Password</th>
                  <th className="px-5 py-3 font-medium">Last Sign In</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="px-5 py-4">
                      <form
                        id={`update-${user.id}`}
                        action={updatePortalUser}
                        className="grid grid-cols-2 gap-2"
                      >
                        <input type="hidden" name="id" value={user.id} />
                        <AdminInput
                          label="First name"
                          name="firstName"
                          defaultValue={user.firstName}
                        />
                        <AdminInput
                          label="Last name"
                          name="lastName"
                          defaultValue={user.lastName}
                        />
                      </form>
                    </td>
                    <td className="px-5 py-4">
                      <AdminInput
                        form={`update-${user.id}`}
                        label="Email"
                        name="email"
                        type="email"
                        defaultValue={user.email}
                        required
                      />
                    </td>
                    <td className="px-5 py-4">
                      <label className="inline-flex items-center gap-2 text-neutral-300">
                        <input
                          form={`update-${user.id}`}
                          type="checkbox"
                          name="isAdmin"
                          defaultChecked={user.isAdmin}
                          disabled={user.id === currentUser.id}
                          className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-lime-400 accent-lime-400 disabled:opacity-60"
                        />
                        {user.isAdmin ? "Admin" : "User"}
                      </label>
                      {user.id === currentUser.id ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Your admin access is locked here.
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <AdminInput
                        form={`update-${user.id}`}
                        label="New password"
                        name="password"
                        type="password"
                        minLength={8}
                        placeholder="Leave blank"
                      />
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {formatDateTime(user.lastSignInAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="submit"
                          form={`update-${user.id}`}
                          className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-lime-300"
                        >
                          Save
                        </button>
                        <form action={deletePortalUser}>
                          <input type="hidden" name="id" value={user.id} />
                          <button
                            type="submit"
                            disabled={user.id === currentUser.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-red-300 transition hover:border-red-300/60 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Delete ${user.email}`}
                            title={
                              user.id === currentUser.id
                                ? "You cannot delete your own account"
                                : `Delete ${user.email}`
                            }
                          >
                            <TrashIcon />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
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

function AdminInput({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  minLength,
  placeholder,
  form,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  form?: string;
}) {
  return (
    <label className="block text-xs font-medium text-neutral-500">
      <span className="sr-only">{label}</span>
      <input
        form={form}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none ring-lime-400 transition placeholder:text-neutral-600 focus:ring-2"
      />
    </label>
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
