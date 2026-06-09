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

  const result = await cognitoODataFetch<{
    value?: Record<string, unknown>[];
  }>(
    `/Forms(${EXPENSE_REIMBURSEMENT_FORM_ID})/Views(${EXPENSE_REIMBURSEMENT_VIEW_ID})/Entries`,
  );

  return (result.value ?? [])
    .map(mapExpenseEntry)
    .filter((entry): entry is CognitoExpenseEntry => Boolean(entry))
    .filter((entry) => entry.email.toLowerCase() === normalizedEmail)
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

  return {
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
