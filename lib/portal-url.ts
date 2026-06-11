export function getPortalBaseUrl() {
  const configured =
    process.env.PORTAL_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_PORTAL_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function buildPortalLoginUrl(nextPath: string) {
  const safeNext = sanitizeNextPath(nextPath);
  const baseUrl = getPortalBaseUrl();

  return `${baseUrl}/login?next=${encodeURIComponent(safeNext)}`;
}

export function sanitizeNextPath(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/dashboard";
  }

  return trimmed;
}