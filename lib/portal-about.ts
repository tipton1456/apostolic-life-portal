import { countPortalDeploymentsThisMonth } from "@/lib/vercel-deployments";

export const PORTAL_CREATION_DATE = "2026-06-04";

export type PortalAboutInfo = {
  version: string;
};

export function getPortalMonthNumber(
  now = new Date(),
  creationDate = PORTAL_CREATION_DATE,
) {
  const creation = new Date(`${creationDate}T12:00:00`);

  return (
    (now.getFullYear() - creation.getFullYear()) * 12 +
    (now.getMonth() - creation.getMonth()) +
    1
  );
}

export function formatPortalVersion(
  deploymentsThisMonth: number,
  now = new Date(),
  creationDate = PORTAL_CREATION_DATE,
) {
  return `V${getPortalMonthNumber(now, creationDate)}.${deploymentsThisMonth}`;
}

export async function getPortalAboutInfo(): Promise<PortalAboutInfo> {
  const deploymentsThisMonth = await countPortalDeploymentsThisMonth();

  return {
    version: formatPortalVersion(deploymentsThisMonth),
  };
}