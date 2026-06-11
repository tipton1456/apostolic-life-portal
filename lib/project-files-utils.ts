const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;

const ALLOWED_PROJECT_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function validateProjectTaskUploadFile(file: File) {
  if (!ALLOWED_PROJECT_FILE_TYPES.has(file.type)) {
    throw new Error(
      "File type not allowed. Use PDF, Office documents, text, CSV, or images.",
    );
  }

  if (file.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error("Project files must be smaller than 25MB.");
  }
}

export function parseProjectTaskUploadFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;

  validateProjectTaskUploadFile(value);
  return value;
}

export function parseProjectTaskUploadFiles(values: FormDataEntryValue[]) {
  const files = values.filter(
    (value): value is File => value instanceof File && value.size > 0,
  );

  for (const file of files) {
    validateProjectTaskUploadFile(file);
  }

  return files;
}

export function formatProjectFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatProjectFileDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}