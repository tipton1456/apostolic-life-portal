"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { uploadOneProjectTaskFile } from "@/lib/project-files";
import {
  MAX_PROJECT_FILE_BYTES,
  MAX_PROJECT_FILE_SIZE_LABEL,
} from "@/lib/project-files-utils";

const MAX_FILES_PER_TASK = 20;

export default function TaskFilesUploadForm({
  currentFileCount,
  projectId,
  taskId,
}: {
  currentFileCount: number;
  projectId: string;
  taskId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("taskFile") as HTMLInputElement | null;
    const files = Array.from(fileInput?.files ?? []);

    if (files.length === 0) {
      setMessage("Choose at least one file to upload.");
      return;
    }

    if (currentFileCount + files.length > MAX_FILES_PER_TASK) {
      setMessage(`Each task can have up to ${MAX_FILES_PER_TASK} files.`);
      return;
    }

    for (const file of files) {
      if (file.size > MAX_PROJECT_FILE_BYTES) {
        setMessage(`${file.name} must be smaller than ${MAX_PROJECT_FILE_SIZE_LABEL}.`);
        return;
      }
    }

    setIsUploading(true);
    setMessage("");
    setUploadProgress(`Uploading 0 of ${files.length}...`);

    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress(`Uploading ${index + 1} of ${files.length}...`);

        const formData = new FormData();
        formData.append("projectId", projectId);
        formData.append("taskId", taskId);
        formData.append("taskFile", file);

        await uploadOneProjectTaskFile(formData);
      }

      if (fileInput) {
        fileInput.value = "";
      }

      setUploadProgress("");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to upload project files.",
      );
      setUploadProgress("");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
    >
      <label className="block text-sm font-medium text-neutral-300">
        Attach files
        <input
          name="taskFile"
          type="file"
          multiple
          required
          disabled={isUploading}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
          className="mt-2 block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300 disabled:opacity-60"
        />
        <span className="mt-2 block text-xs text-neutral-500">
          Up to {MAX_PROJECT_FILE_SIZE_LABEL} per file. Multiple files upload one at a
          time.
        </span>
      </label>
      <button
        type="submit"
        disabled={isUploading}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-60 md:mt-7"
      >
        {isUploading ? "Uploading..." : "Upload Files"}
      </button>
      {uploadProgress ? (
        <p className="text-sm text-neutral-400 md:col-span-2">{uploadProgress}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-red-300 md:col-span-2">{message}</p>
      ) : null}
    </form>
  );
}