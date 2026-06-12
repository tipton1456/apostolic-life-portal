"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import { PortalIcon } from "@/app/icons";
import {
  addProjectManager,
  deleteProject,
  removeProjectManager,
  updateProject,
  uploadProjectImage,
  type Project,
  type ProjectManager,
} from "@/lib/project-management";
import {
  createProjectMilestone,
  deleteProjectMilestone,
} from "@/lib/project-milestones";
import type { ProjectMilestone } from "@/lib/project-milestone-utils";

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export default function ProjectSettingsModal({
  project,
  canManageProject,
  managers,
  eligibleManagers,
  milestones,
}: {
  project: Project;
  canManageProject: boolean;
  managers: ProjectManager[];
  eligibleManagers: Array<{ id: string; fullName: string; email: string }>;
  milestones: ProjectMilestone[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOpen = searchParams.get("settings") === "1";
  const closeHref = `/projects/${project.id}`;

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!canManageProject || !isOpen) {
    return null;
  }

  function closeModal() {
    router.push(closeHref);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
      onClick={closeModal}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-neutral-950/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-lime-400">
              Project Settings
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-100">
              {project.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Project Managers
            </h3>
            <div className="mt-4 space-y-3">
              {managers.map((manager) => (
                <div
                  key={manager.id}
                  className="flex flex-col gap-3 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-neutral-100">{manager.fullName}</p>
                    <p className="mt-1 text-xs text-neutral-500">{manager.email}</p>
                  </div>
                  {managers.length > 1 ? (
                    <form action={removeProjectManager}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="userId" value={manager.userId} />
                      <AdminFormButton
                        pendingLabel="Removing..."
                        variant="danger"
                        className="rounded-lg px-3 py-2 text-sm"
                      >
                        Remove
                      </AdminFormButton>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            {eligibleManagers.length > 0 ? (
              <form action={addProjectManager} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="block flex-1 text-sm font-medium text-neutral-300">
                  Add project manager
                  <select
                    name="userId"
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
                  >
                    {eligibleManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.fullName} ({manager.email})
                      </option>
                    ))}
                  </select>
                </label>
                <AdminFormButton pendingLabel="Adding..." className="rounded-lg px-4 py-3">
                  Add Manager
                </AdminFormButton>
              </form>
            ) : (
              <p className="mt-4 text-xs text-neutral-500">
                Every eligible project manager is already assigned to this project.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Milestones
            </h3>
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              Milestone dates must fall between the project start and target end dates.
            </p>
            {milestones.length > 0 ? (
              <div className="mt-4 space-y-3">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex flex-col gap-3 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-neutral-100">{milestone.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {milestone.milestoneDate}
                      </p>
                    </div>
                    <form action={deleteProjectMilestone}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="milestoneId" value={milestone.id} />
                      <AdminFormButton
                        pendingLabel="Deleting..."
                        variant="danger"
                        className="rounded-lg px-3 py-2 text-sm"
                      >
                        Delete
                      </AdminFormButton>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-neutral-500">No milestones yet.</p>
            )}
            <form action={createProjectMilestone} className="mt-4 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="projectId" value={project.id} />
              <ModalField label="Milestone name" name="name" required />
              <ModalField
                label="Milestone date"
                name="milestoneDate"
                type="date"
                min={project.startDate ?? undefined}
                max={project.targetEndDate ?? undefined}
                required
              />
              <div className="flex items-end justify-end md:col-span-2">
                <AdminFormButton pendingLabel="Adding...">Add Milestone</AdminFormButton>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Project Details
            </h3>
            <form
              action={updateProject}
              className="mt-4 grid gap-4 md:grid-cols-2"
            >
              <input type="hidden" name="id" value={project.id} />
              <ModalField
                label="Project name"
                name="name"
                defaultValue={project.name}
                required
              />
              <ModalField
                label="Description"
                name="description"
                defaultValue={project.description}
              />
              <ModalField
                label="Start date"
                name="startDate"
                type="date"
                defaultValue={project.startDate ?? ""}
              />
              <ModalField
                label="Target end date"
                name="targetEndDate"
                type="date"
                defaultValue={project.targetEndDate ?? ""}
              />
              <ModalSelectField
                label="Status"
                name="status"
                defaultValue={project.status}
                options={PROJECT_STATUS_OPTIONS}
              />
              <div className="flex items-end justify-end md:col-span-2">
                <AdminFormButton pendingLabel="Saving...">Save Project</AdminFormButton>
              </div>
            </form>
          </section>

          {project.status === "completed" ? (
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Archived Files
              </h3>
              <form action={updateProject} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="name" value={project.name} />
                <input type="hidden" name="description" value={project.description} />
                <input type="hidden" name="status" value={project.status} />
                <input type="hidden" name="startDate" value={project.startDate ?? ""} />
                <input
                  type="hidden"
                  name="targetEndDate"
                  value={project.targetEndDate ?? ""}
                />
                <ModalField
                  label="Archived project files URL"
                  name="archivedFilesUrl"
                  defaultValue={project.archivedFilesUrl ?? ""}
                />
                <p className="text-xs leading-5 text-neutral-500">
                  Paste the Dropbox shared-folder link after you upload the project
                  files. This link is only shown once the project is completed.
                </p>
                <div className="flex justify-end">
                  <AdminFormButton pendingLabel="Saving...">
                    Save Archive Link
                  </AdminFormButton>
                </div>
              </form>
            </section>
          ) : null}

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Project Image
            </h3>
            <form
              action={uploadProjectImage}
              encType="multipart/form-data"
              className="mt-4 space-y-4"
            >
              <input type="hidden" name="projectId" value={project.id} />
              <label className="block text-sm font-medium text-neutral-300">
                Project image
                <input
                  name="projectImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-2 block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300"
                />
                <span className="mt-2 block text-xs leading-5 text-neutral-500">
                  Upload a 16:9 image (JPG, PNG, or WebP under 5MB). It appears beside
                  the project details at the top of this dashboard.
                </span>
              </label>
              <div className="flex justify-end">
                <AdminFormButton pendingLabel="Uploading...">Save Image</AdminFormButton>
              </div>
            </form>
            {project.imageUrl ? (
              <form action={uploadProjectImage} className="mt-3 flex justify-end">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="removeImage" value="on" />
                <AdminFormButton
                  pendingLabel="Removing..."
                  variant="danger"
                  className="rounded-lg px-3 py-2"
                >
                  Remove Image
                </AdminFormButton>
              </form>
            ) : null}
          </section>

          <form action={deleteProject} className="flex justify-end">
            <input type="hidden" name="id" value={project.id} />
            <AdminFormButton
              pendingLabel="Deleting..."
              variant="danger"
              className="rounded-lg px-3 py-2"
            >
              <PortalIcon className="h-4 w-4" name="trash" />
              Delete Project
            </AdminFormButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function ModalSelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}