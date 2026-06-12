import Link from "next/link";
import type { ProjectTaskFile } from "@/lib/project-files";

const MAX_RECENT_FILES = 3;

export default function ProjectRecentFilesHeaderCard({
  files,
}: {
  files: ProjectTaskFile[];
}) {
  const recentFiles = files.slice(0, MAX_RECENT_FILES);

  return (
    <aside className="w-full shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:max-w-md lg:max-w-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-lime-400">
          Recent Files
        </p>
        <Link
          href="/projects/files"
          className="text-xs font-semibold text-lime-400 transition hover:text-lime-300"
        >
          View all
        </Link>
      </div>

      {recentFiles.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {recentFiles.map((file) => (
            <li
              key={file.id}
              className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
            >
              <span
                className="min-w-0 truncate text-sm text-neutral-200"
                title={file.fileName}
              >
                {file.fileName}
              </span>
              <a
                href={`/api/projects/files/${file.id}/download`}
                className="shrink-0 text-sm font-semibold text-lime-400 transition hover:text-lime-300"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No files uploaded yet.</p>
      )}
    </aside>
  );
}