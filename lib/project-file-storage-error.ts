export class ProjectFileStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileStorageError";
  }
}