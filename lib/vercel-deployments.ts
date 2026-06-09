const VERCEL_API_BASE_URL = "https://api.vercel.com";
const DEFAULT_PROJECT_NAME = "apostolic-life-portal";

type VercelDeploymentResponse = {
  deployments?: VercelDeploymentApiItem[];
};

type VercelDeploymentApiItem = {
  createdAt?: number;
  creator?: {
    email?: string;
    username?: string;
  };
  inspectorUrl?: string;
  meta?: Record<string, string>;
  name?: string;
  readyState?: string;
  target?: string | null;
  type?: string;
  uid?: string;
  url?: string | null;
};

export type PortalDeployment = {
  author: string;
  branch: string;
  commitMessage: string;
  commitSha: string;
  createdAt: string;
  id: string;
  inspectorUrl: string;
  state: string;
  target: string;
  url: string;
};

export function hasVercelDeploymentConfig() {
  return Boolean(process.env.VERCEL_API_TOKEN);
}

export function getVercelDeploymentConfig() {
  return {
    hasToken: Boolean(process.env.VERCEL_API_TOKEN),
    project:
      process.env.VERCEL_PROJECT_ID ||
      process.env.VERCEL_PROJECT_NAME ||
      DEFAULT_PROJECT_NAME,
    teamId: process.env.VERCEL_TEAM_ID || "",
  };
}

export async function listPortalDeployments(): Promise<PortalDeployment[]> {
  const token = process.env.VERCEL_API_TOKEN;

  if (!token) {
    throw new Error("VERCEL_API_TOKEN is not configured.");
  }

  const { project, teamId } = getVercelDeploymentConfig();
  const params = new URLSearchParams({
    limit: "25",
    projectId: project,
    target: "production",
  });

  if (teamId) {
    params.set("teamId", teamId);
  }

  const response = await fetch(
    `${VERCEL_API_BASE_URL}/v6/deployments?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Vercel deployment lookup failed:", {
      status: response.status,
      body: errorText.slice(0, 500),
    });
    throw new Error("Unable to load Vercel deployments.");
  }

  const result = (await response.json()) as VercelDeploymentResponse;

  return (result.deployments ?? []).map(mapDeployment);
}

function mapDeployment(deployment: VercelDeploymentApiItem): PortalDeployment {
  const meta = deployment.meta ?? {};
  const url = deployment.url ? `https://${deployment.url}` : "";

  return {
    author:
      meta.githubCommitAuthorName ||
      meta.gitlabCommitAuthorName ||
      deployment.creator?.username ||
      deployment.creator?.email ||
      "Unknown",
    branch:
      meta.githubCommitRef ||
      meta.gitlabCommitRef ||
      meta.bitbucketCommitRef ||
      "Unknown",
    commitMessage:
      meta.githubCommitMessage ||
      meta.gitlabCommitMessage ||
      meta.bitbucketCommitMessage ||
      deployment.name ||
      "Deployment",
    commitSha:
      meta.githubCommitSha ||
      meta.gitlabCommitSha ||
      meta.bitbucketCommitSha ||
      "",
    createdAt: deployment.createdAt
      ? new Date(deployment.createdAt).toISOString()
      : "",
    id: deployment.uid ?? url,
    inspectorUrl: deployment.inspectorUrl ?? "",
    state: deployment.readyState ?? "UNKNOWN",
    target: deployment.target ?? "preview",
    url,
  };
}
