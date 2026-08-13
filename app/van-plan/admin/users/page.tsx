import { redirect } from "next/navigation";
import { canManageUsers, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import { listVanPlanUsers } from "@/lib/van-plan/users";
import VanPlanPermissionForm from "./permission-form";
import VanPlanUserForm from "./user-form";

export default async function VanPlanUsersPage() {
  const user = await getCurrentVanPlanUser();

  if (!user) {
    redirect(
      `${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(`${VAN_PLAN_BASE_PATH}/admin/users`)}`,
    );
  }

  if (!canManageUsers(user)) {
    redirect(VAN_PLAN_BASE_PATH);
  }

  const users = await listVanPlanUsers();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="vp-subhead text-sm">auction desk</p>
      <h1 className="vp-heading mt-2 text-4xl">Add users</h1>
      <p className="vp-description mt-4 max-w-2xl leading-7">
        Create auction accounts with a name, email, phone number, and
        permission. People sign in with their email and phone number. Admins
        can add users and items. Auctioneers can add items and update status.
        Users can bid.
      </p>

      <div className="vp-card mt-8 p-6">
        <h2 className="vp-heading text-2xl">New user</h2>
        <VanPlanUserForm />
      </div>

      <section className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left">
          <thead>
            <tr className="vp-subhead text-sm">
              <th className="pb-3 font-normal">name</th>
              <th className="pb-3 font-normal">email</th>
              <th className="pb-3 font-normal">phone</th>
              <th className="pb-3 font-normal">permission</th>
            </tr>
          </thead>
          <tbody>
            {users.map((entry) => (
              <tr key={entry.id} className="border-t border-[rgba(70,67,60,0.12)]">
                <td className="py-4">{entry.name}</td>
                <td className="py-4">{entry.email}</td>
                <td className="py-4">{entry.phone}</td>
                <td className="py-4">
                  <VanPlanPermissionForm
                    userId={entry.id}
                    permission={entry.permission}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
