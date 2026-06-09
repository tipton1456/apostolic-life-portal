import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getCognitoFormDetail,
  getCognitoForms,
  hasCognitoFormsConfig,
} from "@/lib/cognito-forms";
import { getCurrentPortalUser } from "@/lib/portal-users";

type PageProps = {
  searchParams: Promise<{
    formId?: string;
  }>;
};

export default async function CognitoFormsAdminPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  if (!hasCognitoFormsConfig()) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Cognito Forms
          </p>
          <h1 className="mt-3 text-3xl font-bold">Setup Required</h1>
          <p className="mt-3 text-neutral-400">
            Add COGNITO_FORMS_API_KEY to the environment to connect Cognito
            Forms.
          </p>
        </div>
      </main>
    );
  }

  const { formId } = await searchParams;
  const forms = await getCognitoForms();
  const selectedFormId = formId ?? forms[0]?.id;
  const selectedForm = selectedFormId
    ? await getCognitoFormDetail(selectedFormId)
    : null;

  if (selectedFormId && !selectedForm) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Cognito Forms
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            API connection status, available forms, and form schema fields.
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="h-fit overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-xl font-semibold">Forms</h2>
              <p className="mt-1 text-sm text-neutral-400">
                {forms.length} available
              </p>
            </div>

            <div className="divide-y divide-white/10">
              {forms.map((form) => (
                <Link
                  key={form.id}
                  href={`/admin/cognito-forms?formId=${encodeURIComponent(form.id)}`}
                  className={
                    selectedForm?.form.id === form.id
                      ? "block bg-lime-400 px-5 py-4 text-neutral-950"
                      : "block px-5 py-4 text-neutral-100 transition hover:bg-white/[0.06] hover:text-lime-300"
                  }
                >
                  <p className="font-semibold">{form.name}</p>
                  <p
                    className={
                      selectedForm?.form.id === form.id
                        ? "mt-1 text-xs uppercase tracking-[0.16em] text-neutral-800"
                        : "mt-1 text-xs uppercase tracking-[0.16em] text-neutral-500"
                    }
                  >
                    Form {form.id}
                  </p>
                </Link>
              ))}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 p-5">
              <h2 className="text-xl font-semibold text-lime-200">
                Connection Verified
              </h2>
              <p className="mt-3 text-sm leading-6 text-lime-50/80">
                Cognito Forms accepted the API key and returned your form list.
                The REST API supports forms, schemas, individual entries, files,
                documents, and entry creation/update/delete. A plain recent
                entries list endpoint was not available in this API response, so
                we should use webhooks or known entry IDs for entry workflows.
              </p>
            </div>

            {selectedForm ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">
                    Selected Form
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {selectedForm.form.name}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    Internal name: {selectedForm.form.internalName}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">JSON Field</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Description</th>
                        <th className="px-5 py-3 text-right font-medium">
                          Read Only
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {selectedForm.fields.map((field) => (
                        <tr
                          key={field.key}
                          className="transition hover:bg-white/[0.06]"
                        >
                          <td className="px-5 py-4 font-semibold text-lime-300">
                            {field.key}
                          </td>
                          <td className="px-5 py-4 text-neutral-200">
                            {field.type}
                          </td>
                          <td className="px-5 py-4 text-neutral-400">
                            {field.description || "No description"}
                          </td>
                          <td className="px-5 py-4 text-right text-neutral-300">
                            {field.readOnly ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-xl font-semibold">No forms found</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  Cognito Forms returned a successful response, but no forms
                  were visible to this integration key.
                </p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
