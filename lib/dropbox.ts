type DropboxTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type DropboxUploadResponse = {
  path_display?: string;
  id?: string;
  name?: string;
  size?: number;
};

type DropboxTemporaryLinkResponse = {
  link?: string;
  metadata?: {
    name?: string;
  };
  error_summary?: string;
};

let cachedAccessToken: {
  token: string;
  expiresAt: number;
} | null = null;

export function hasDropboxConfig() {
  return Boolean(
    process.env.DROPBOX_APP_KEY &&
      process.env.DROPBOX_APP_SECRET &&
      process.env.DROPBOX_REFRESH_TOKEN,
  );
}

export function getDropboxRootPath() {
  const configured = process.env.DROPBOX_ROOT_PATH?.trim();

  return configured || "/Apostolic Life Portal";
}

export async function uploadDropboxFile({
  contents,
  destinationPath,
}: {
  contents: Buffer;
  destinationPath: string;
}) {
  const accessToken = await getDropboxAccessToken();
  const response = await fetch(
    "https://content.dropboxapi.com/2/files/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          autorename: true,
          mode: "add",
          mute: false,
          path: normalizeDropboxPath(destinationPath),
        }),
      },
      body: new Uint8Array(contents),
      cache: "no-store",
    },
  );

  const result = (await response.json()) as DropboxUploadResponse & {
    error_summary?: string;
  };

  if (!response.ok) {
    console.error("Dropbox upload failed:", result);
    throw new Error(result.error_summary ?? "Dropbox upload failed.");
  }

  if (!result.path_display) {
    throw new Error("Dropbox upload did not return a file path.");
  }

  return {
    dropboxId: result.id ?? "",
    dropboxPath: result.path_display,
    fileName: result.name ?? "",
    fileSize: result.size ?? contents.byteLength,
  };
}

export async function deleteDropboxFile(path: string) {
  const accessToken = await getDropboxAccessToken();
  const response = await fetch(
    "https://api.dropboxapi.com/2/files/delete_v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: normalizeDropboxPath(path),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const result = (await response.json()) as { error_summary?: string };
    console.error("Dropbox delete failed:", result);
    throw new Error(result.error_summary ?? "Dropbox delete failed.");
  }
}

export async function getDropboxTemporaryDownloadLink(path: string) {
  const accessToken = await getDropboxAccessToken();
  const response = await fetch(
    "https://api.dropboxapi.com/2/files/get_temporary_link",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: normalizeDropboxPath(path),
      }),
      cache: "no-store",
    },
  );

  const result = (await response.json()) as DropboxTemporaryLinkResponse;

  if (!response.ok || !result.link) {
    console.error("Dropbox temporary link failed:", result);
    throw new Error(result.error_summary ?? "Unable to create Dropbox download link.");
  }

  return result.link;
}

export function buildProjectTaskDropboxPath({
  fileName,
  projectId,
  taskId,
}: {
  fileName: string;
  projectId: string;
  taskId: string;
}) {
  const safeName = sanitizeDropboxFileName(fileName);

  return `${getDropboxRootPath()}/Projects/${projectId}/tasks/${taskId}/${Date.now()}-${safeName}`;
}

async function getDropboxAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

  if (!appKey || !appSecret || !refreshToken) {
    throw new Error("Dropbox is not configured.");
  }

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: appKey,
      client_secret: appSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  const result = (await response.json()) as DropboxTokenResponse;

  if (!response.ok || !result.access_token) {
    console.error("Dropbox token refresh failed:", result);
    throw new Error(result.error_description ?? result.error ?? "Dropbox auth failed.");
  }

  cachedAccessToken = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max((result.expires_in ?? 3600) - 60, 60) * 1000,
  };

  return cachedAccessToken.token;
}

function normalizeDropboxPath(path: string) {
  const trimmed = path.trim();

  if (!trimmed.startsWith("/")) {
    return `/${trimmed}`;
  }

  return trimmed.replace(/\/+/g, "/");
}

function sanitizeDropboxFileName(fileName: string) {
  const baseName = fileName.split(/[/\\]/).pop() ?? "file";

  return baseName.replace(/[^\w.\-() ]+/g, "_").slice(0, 180) || "file";
}