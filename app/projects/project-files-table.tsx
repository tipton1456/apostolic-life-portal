import Link from "next/link";
import { PortalIcon } from "@/app/icons";
import AdminFormButton from "@/app/admin/admin-form-button";
import { deleteProjectTaskFile } from "@/lib/project-files";
import {
  formatProjectFileDate,
  formatProjectFileSize,
} from "@/lib/project-files-utils";
import type { ProjectTaskFile } from "@/lib/project-files";

export default function ProjectFilesTable({
  files,
  currentUserId,
  isManager,
  showProjectColumn = true,
}: {
  files: ProjectTaskFile[];
  currentUserId: string;
  isManager: boolean;
  showProjectColumn?: boolean;
}) {
  if (files.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-neutral-400">
        No project files have been uploaded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
          <tr>
            <th className="px-5 py-3 font-medium">File</th>
            {showProjectColumn ? (
              <th className="px-5 py-3 font-medium">Project</th>
            ) : null}
            <th className="px-5 py-3 font-medium">Task</th>
            <th className="px-5 py-3 font-medium">Uploaded By</th>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {files.map((file) => {
            const canDelete = isManager || file.uploadedBy === currentUserId;

            return (
              <tr key={file.id} className="transition hover:bg-white/[0.04]">
                <td className="px-5 py-4">
                  <p className="font-semibold text-neutral-100">{file.fileName}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatProjectFileSize(file.fileSize)}
                  </p>
                </td>
                {showProjectColumn ? (
                  <td className="px-5 py-4 text-neutral-300">
                    <Link
                      href={`/projects/${file.projectId}`}
                      className="transition hover:text-lime-300"
                    >
                      {file.projectName}
                    </Link>
                  </td>
                ) : null}
                <td className="px-5 py-4 text-neutral-300">
                  <Link
                    href={`/projects/${file.projectId}?task=${file.taskId}`}
                    className="transition hover:text-lime-300"
                  >
                    {file.taskTitle}
                  </Link>
                </td>
                <td className="px-5 py-4 text-neutral-300">{file.uploadedByName}</td>
                <td className="px-5 py-4 text-neutral-300">
                  {formatProjectFileDate(file.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/api/projects/files/${file.id}/download`}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
                    >
                      Download
                    </a>
                    {canDelete ? (
                      <form action={deleteProjectTaskFile}>
                        <input type="hidden" name="fileId" value={file.id} />
                        <input type="hidden" name="projectId" value={file.projectId} />
                        <AdminFormButton
                          pendingLabel="Deleting..."
                          variant="danger"
                          className="rounded-lg px-3 py-2"
                        >
                          <PortalIcon className="h-4 w-4" name="trash" />
                        </AdminFormButton>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}