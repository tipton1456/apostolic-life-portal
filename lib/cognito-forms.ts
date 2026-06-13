type CognitoFormResponse = {
  Id?: string;
  InternalName?: string;
  LoweredInternalName?: string;
  LoweredUrlName?: string;
  Name?: string;
};

type JsonSchemaProperty = {
  description?: string;
  format?: string;
  items?: {
    enum?: string[];
    type?: string;
  };
  properties?: Record<string, JsonSchemaProperty>;
  readOnly?: boolean;
  title?: string;
  type?: string;
};

type CognitoFormSchema = {
  properties?: Record<string, JsonSchemaProperty>;
  type?: string;
};

export type CognitoFormSummary = {
  id: string;
  internalName: string;
  name: string;
  urlName: string;
};

export type CognitoFormField = {
  description: string;
  key: string;
  readOnly: boolean;
  type: string;
};

export type CognitoFormDetail = {
  fields: CognitoFormField[];
  form: CognitoFormSummary;
};

export type CognitoEntryResult = {
  entryId?: string;
  entryNumber?: string;
};

export type CognitoEntryMetadata = {
  action: string;
  dateSubmitted: string;
  dateUpdated: string;
  number: string;
  role: string;
  status: string;
};

export type CognitoUploadedFile = {
  ContentType: string;
  Id: string;
  Name: string;
  Size: number;
};

export type CognitoExpenseEntry = {
  amountTotal: number;
  dateSubmitted: string;
  email: string;
  entryId: string;
  event: string;
  id: number;
  requestDate: string;
  reportType: string;
  status: string;
  /** Project name or ID captured from the Cognito form (user must add a "Project" / "Project Name" field or Lookup to their expense form). */
  project?: string;
  projectId?: string;
};

const COGNITO_API_BASE_URL = "https://www.cognitoforms.com/api";
const COGNITO_ODATA_BASE_URL = "https://www.cognitoforms.com/api/odata";
const EXPENSE_REIMBURSEMENT_FORM_ID = "3";
const EXPENSE_REIMBURSEMENT_VIEW_ID = "1";

export function hasCognitoFormsConfig() {
  return Boolean(process.env.COGNITO_FORMS_API_KEY);
}

export async function getCognitoForms(): Promise<CognitoFormSummary[]> {
  const forms = await cognitoFetch<CognitoFormResponse[]>("/forms");

  return forms
    .map(mapForm)
    .filter((form): form is CognitoFormSummary => Boolean(form))
    .sort((firstForm, secondForm) => firstForm.name.localeCompare(secondForm.name));
}

export async function getCognitoFormDetail(
  formId: string,
): Promise<CognitoFormDetail | null> {
  const forms = await getCognitoForms();
  const form = forms.find(
    (candidate) =>
      candidate.id === formId ||
      candidate.internalName.toLowerCase() === formId.toLowerCase() ||
      candidate.urlName.toLowerCase() === formId.toLowerCase(),
  );

  if (!form) return null;

  const schema = await cognitoFetch<CognitoFormSchema>(
    `/forms/${encodeURIComponent(form.id)}/schema`,
  );

  return {
    fields: mapSchemaFields(schema),
    form,
  };
}

export async function createCognitoFormEntry(
  formId: string,
  entry: Record<string, unknown>,
): Promise<CognitoEntryResult> {
  const result = await cognitoFetch<Record<string, unknown>>(
    `/forms/${encodeURIComponent(formId)}/entries`,
    {
      body: JSON.stringify(entry),
      method: "POST",
    },
  );
  const entryData = isObject(result.Entry) ? result.Entry : {};

  return {
    entryId: stringValue(result.Id) ?? stringValue(entryData.Id),
    entryNumber: stringValue(entryData.Number),
  };
}

export async function getCognitoFormEntry(
  formId: string,
  entryId: string,
): Promise<CognitoEntryMetadata | null> {
  const result = await cognitoFetch<Record<string, unknown>>(
    `/forms/${encodeURIComponent(formId)}/entries/${encodeURIComponent(entryId)}`,
  );
  const entryData = isObject(result.Entry) ? result.Entry : {};

  return {
    action: stringValue(entryData.Action) ?? "",
    dateSubmitted: stringValue(entryData.DateSubmitted) ?? "",
    dateUpdated: stringValue(entryData.DateUpdated) ?? "",
    number: stringValue(entryData.Number) ?? "",
    role: stringValue(entryData.Role) ?? "",
    status: stringValue(entryData.Status) ?? "",
  };
}

export async function uploadCognitoFile(file: File): Promise<CognitoUploadedFile> {
  const body = new FormData();
  body.append("File", file, file.name);

  const result = await cognitoFetch<Record<string, unknown>>("/files", {
    body,
    method: "POST",
  });

  return {
    ContentType: stringValue(result.ContentType) ?? file.type,
    Id: stringValue(result.Id) ?? "",
    Name: stringValue(result.Name) ?? file.name,
    Size: numberValue(result.Size) ?? file.size,
  };
}

export async function listCognitoExpenseEntriesByEmail(
  email: string,
): Promise<CognitoExpenseEntry[]> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) return [];

  const all = await listAllCognitoExpenseEntries();
  return all
    .filter((entry) => entry.email.toLowerCase() === normalizedEmail)
    .sort((firstEntry, secondEntry) =>
      secondEntry.dateSubmitted.localeCompare(firstEntry.dateSubmitted),
    );
}

/**
 * Returns (recent) expense entries from the Cognito reimbursement form.
 * Useful for reconciliation jobs that need to import all project-linked
 * expenses, not just the ones for the current viewer.
 */
export async function listAllCognitoExpenseEntries(): Promise<CognitoExpenseEntry[]> {
  const result = await cognitoODataFetch<{
    value?: Record<string, unknown>[];
  }>(
    `/Forms(${EXPENSE_REIMBURSEMENT_FORM_ID})/Views(${EXPENSE_REIMBURSEMENT_VIEW_ID})/Entries`,
  );

  return (result.value ?? [])
    .map(mapExpenseEntry)
    .filter((entry): entry is CognitoExpenseEntry => Boolean(entry))
    .sort((firstEntry, secondEntry) =>
      secondEntry.dateSubmitted.localeCompare(firstEntry.dateSubmitted),
    );
}

async function cognitoFetch<T>(
  path: string,
  init: {
    body?: BodyInit;
    method?: "GET" | "POST";
  } = {},
): Promise<T> {
  const apiKey = process.env.COGNITO_FORMS_API_KEY;

  if (!apiKey) {
    throw new Error("Cognito Forms API key is not configured.");
  }

  const response = await fetch(`${COGNITO_API_BASE_URL}${path}`, {
    body: init.body,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
    },
    method: init.method ?? "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Cognito Forms API request failed:", {
      path,
      status: response.status,
      body: errorText.slice(0, 500),
    });
    throw new Error("Cognito Forms API request failed.");
  }

  return response.json();
}

async function cognitoODataFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.COGNITO_FORMS_API_KEY;

  if (!apiKey) {
    throw new Error("Cognito Forms API key is not configured.");
  }

  const response = await fetch(`${COGNITO_ODATA_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Cognito Forms OData request failed:", {
      path,
      status: response.status,
      body: errorText.slice(0, 500),
    });
    throw new Error("Cognito Forms OData request failed.");
  }

  return response.json();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  return undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const number = Number(value);

    return Number.isFinite(number) ? number : undefined;
  }

  return undefined;
}

function mapExpenseEntry(
  entry: Record<string, unknown>,
): CognitoExpenseEntry | null {
  const id = numberValue(entry.Id);

  if (!id) return null;

  const base: CognitoExpenseEntry = {
    amountTotal: numberValue(entry.Total) ?? 0,
    dateSubmitted: stringValue(entry.Entry_DateSubmitted) ?? "",
    email: stringValue(entry.Email) ?? "",
    entryId: `${EXPENSE_REIMBURSEMENT_FORM_ID}-${id}`,
    event: stringValue(entry.Event) ?? "",
    id,
    requestDate: stringValue(entry.Date) ?? "",
    reportType:
      stringValue(entry.SelectTheTypeOfReportDoNotSelectMoreThanOneTypePerSubmission) ??
      "",
    status: stringValue(entry.Entry_Status) ?? "Submitted",
  };

  // Try to extract project context. The user must add a field (recommended name "Project"
  // or "Project Name", ideally a Lookup against a Projects catalog form) to the Cognito
  // expense form. The OData column name will be the internal title or the long name.
  const projectCandidates = [
    entry.Project,
    entry["Project Name"],
    entry.ProjectName,
    entry.Project_ID,
    entry["Project ID"],
    entry.SelectProject,
    entry["Project (Lookup)"],
    // Fallback: scan any key containing "project" (case-insensitive)
    ...Object.entries(entry)
      .filter(([k]) => /project/i.test(k))
      .map(([, v]) => v),
  ];

  const projectValue = projectCandidates.find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;

  if (projectValue) {
    // If the value looks like "Name (ID: uuid)" or just the name, store what we have.
    // Later sync code can resolve by name or by ID if the form includes the ID.
    base.project = projectValue.trim();
    // Try to pull an explicit ID if present in the same entry under common keys
    const idCandidates = [entry["Project ID"], entry.ProjectID, entry.Project_Id];
    const explicitId = idCandidates.find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;
    if (explicitId) base.projectId = explicitId.trim();
  }

  return base;
}

function mapForm(form: CognitoFormResponse): CognitoFormSummary | null {
  if (!form.Id || !form.Name) return null;

  return {
    id: form.Id,
    internalName: form.InternalName ?? form.Id,
    name: form.Name,
    urlName: form.LoweredUrlName ?? form.LoweredInternalName ?? form.Id,
  };
}

function mapSchemaFields(schema: CognitoFormSchema): CognitoFormField[] {
  return Object.entries(schema.properties ?? {})
    .map(([key, property]) => ({
      description: property.description ?? "",
      key,
      readOnly: Boolean(property.readOnly),
      type: describePropertyType(property),
    }))
    .sort((firstField, secondField) => Number(firstField.readOnly) - Number(secondField.readOnly));
}

function describePropertyType(property: JsonSchemaProperty) {
  if (property.type === "array" && property.items?.enum) {
    return `Choice: ${property.items.enum.join(", ")}`;
  }

  if (property.type === "array") {
    return `List${property.items?.type ? ` of ${property.items.type}` : ""}`;
  }

  if (property.type === "object") {
    const propertyCount = Object.keys(property.properties ?? {}).length;

    return propertyCount > 0 ? `Object (${propertyCount} fields)` : "Object";
  }

  return [property.type, property.format].filter(Boolean).join(" / ") || "Field";
}

const COGNITO_PROJECT_CATALOG_FORM_ID = process.env.COGNITO_PROJECT_CATALOG_FORM_ID || process.env.COGNITO_PROJECTS_FORM_ID;

/**
 * Returns true if a Cognito "Project Catalog" form ID has been configured.
 * 
 * To make the *published* Cognito expense form (the one at cognitoforms.com, outside the portal)
 * show a dropdown of your current projects:
 * 
 * 1. In Cognito Forms, create a simple auxiliary form called "Projects" (or "Project Catalog").
 *    Recommended fields:
 *      - Name (Text, required)          → the project name
 *      - ProjectID (Text)               → the portal UUID (useful for exact matching)
 *      - Status (Text or Choice)        → active / on_hold / completed / cancelled
 * 
 * 2. In your main Expense Reimbursement form (the one with ID 3 or whatever you use):
 *    - Add a new field, preferably a "Lookup" field (or Choice with "Allow multiple" off).
 *    - Configure it to look up entries from your "Projects" catalog form.
 *    - Map the lookup to show "Name" (and optionally Status).
 * 
 * 3. Set the env var:
 *      COGNITO_PROJECT_CATALOG_FORM_ID=the-form-id-of-your-projects-catalog
 * 
 * 4. The portal will keep the catalog roughly in sync by creating entries when
 *    projects are created or updated (see syncProjectToCognitoCatalog).
 * 
 * This is the standard, reliable way to get dynamic project choices inside a
 * standalone published Cognito form without custom JavaScript.
 */
export function hasCognitoProjectCatalogConfig() {
  return Boolean(COGNITO_PROJECT_CATALOG_FORM_ID);
}

export type ProjectForCatalog = {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  targetEndDate?: string | null;
};

/**
 * Push (or re-push) a project into the configured Cognito "Projects" catalog form.
 * Call this from project create/update hooks.
 *
 * The entry created will have fields the user can map in the catalog form:
 *   Name, ProjectID, Status, StartDate, TargetEndDate.
 *
 * Note: This always creates a *new* entry in the catalog. For a lookup source this is
 * usually fine (lookups can be filtered to latest or active). If you want deduping,
 * you can periodically clean the catalog form in Cognito or extend this with a query
 * + update flow using the OData API.
 */
export async function syncProjectToCognitoCatalog(project: ProjectForCatalog): Promise<void> {
  if (!hasCognitoProjectCatalogConfig()) return;

  const catalogFormId = COGNITO_PROJECT_CATALOG_FORM_ID!;

  const entry = {
    Name: project.name,
    ProjectID: project.id,
    Status: project.status,
    StartDate: project.startDate || "",
    TargetEndDate: project.targetEndDate || "",
  };

  try {
    await createCognitoFormEntry(catalogFormId, entry);
  } catch (err) {
    console.error("Failed to sync project to Cognito catalog:", err);
    // Non-fatal for project operations
  }
}

/**
 * Convenience: sync many projects (e.g. full refresh from an admin action).
 */
export async function syncAllProjectsToCognitoCatalog(projects: ProjectForCatalog[]): Promise<void> {
  if (!hasCognitoProjectCatalogConfig()) return;
  for (const p of projects) {
    await syncProjectToCognitoCatalog(p).catch(() => {});
  }
}

export type ProjectContext = {
  id?: string;
  name: string;
  status?: string;
  startDate?: string | null;
  targetEndDate?: string | null;
};

/**
 * Returns a flat map of field values you can spread into a Cognito entry
 * (for createCognitoFormEntry) or JSON-stringify for the official
 * ?entry={...} prefill syntax on Cognito public links and embeds.
 *
 * Form builders in Cognito can map these keys (or similar) to real fields:
 *   - Text / Choice field named "Project" or "Project Name"
 *   - Hidden fields for "Project ID"
 *
 * Usage example (inside a server action, after picking a project):
 *   const project = { id: "...", name: "Mexico Mission 2026", status: "active" };
 *   const entry = {
 *     Email: currentUser.email,
 *     ...buildCognitoProjectFields(project),
 *     Amount: "123.45",
 *     // ... other form fields
 *   };
 *   await createCognitoFormEntry("YOUR-FORM-ID", entry);
 *
 * For a clickable prefilled link (generated while user is authenticated):
 *   const entry = buildCognitoProjectFields(selectedProject);
 *   const prefill = encodeURIComponent(JSON.stringify(entry));
 *   const url = `https://www.cognitoforms.com/YourOrg/YourFormName?entry=${prefill}`;
 */
export function buildCognitoProjectFields(project: ProjectContext): Record<string, string> {
  const fields: Record<string, string> = {
    Project: project.name,
    "Project Name": project.name,
    "Project ID": project.id ?? "",
  };

  if (project.status) {
    fields["Project Status"] = project.status;
  }
  if (project.startDate) {
    fields["Project Start Date"] = project.startDate;
  }
  if (project.targetEndDate) {
    fields["Project Target End Date"] = project.targetEndDate;
  }

  return fields;
}
