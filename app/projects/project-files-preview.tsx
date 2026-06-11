import Link from "next/link";
import {
  formatProjectFileDate,
  formatProjectFileSize,
} from "@/lib/project-files-utils";
import type { ProjectTaskFile } from "@/lib/project-files";

export default function ProjectFilesPreview({
  files,
  viewAllHref,
  title = "Recent Project Files",
}: {
  files: ProjectTaskFile[];
  viewAllHref: string;
  title?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Files
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="text-sm font-semibold text-lime-400 transition hover:text-lime-300"
        >
          View All Files
        </Link>
      </div>
      {files.length > 0 ? (
        <div className="divide-y divide-white/10">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-neutral-100">{file.fileName}</p>
                <p className="mt-1 text-sm text-neutral-400">
                  {file.projectName} · {file.taskTitle} ·{" "}
                  {formatProjectFileSize(file.fileSize)} ·{" "}
                  {formatProjectFileDate(file.createdAt)}
                </p>
              </div>
              <a
                href={`/api/projects/files/${file.id}/download`}
                className="inline-flex w-fit items-center rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-neutral-400">
          No project files have been uploaded yet.
        </p>
      )}
    </section>
  );
}