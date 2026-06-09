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

const COGNITO_API_BASE_URL = "https://www.cognitoforms.com/api";

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

async function cognitoFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.COGNITO_FORMS_API_KEY;

  if (!apiKey) {
    throw new Error("Cognito Forms API key is not configured.");
  }

  const response = await fetch(`${COGNITO_API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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
