export type RevenueCategory =
  | "donations"
  | "grants"
  | "sales"
  | "sponsorship"
  | "services"
  | "other";

export type RevenueStatus = "planned" | "committed" | "received" | "cancelled";

export type ProjectRevenue = {
  id: string;
  projectId: string;
  description: string;
  category: RevenueCategory;
  amount: number;
  revenueDate: string;
  source: string;
  notes: string;
  status: RevenueStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRevenueStats = {
  totalEntries: number;
  activeEntries: number;
  totalAmount: number;
  receivedAmount: number;
  committedAmount: number;
  plannedAmount: number;
  outstandingAmount: number;
};

const CATEGORY_LABELS: Record<RevenueCategory, string> = {
  donations: "Donations",
  grants: "Grants",
  sales: "Sales",
  sponsorship: "Sponsorship",
  services: "Services",
  other: "Other",
};

const STATUS_LABELS: Record<RevenueStatus, string> = {
  planned: "Planned",
  committed: "Committed",
  received: "Received",
  cancelled: "Cancelled",
};

export function formatRevenueCategory(category: RevenueCategory) {
  return CATEGORY_LABELS[category];
}

export function formatRevenueStatus(status: RevenueStatus) {
  return STATUS_LABELS[status];
}

export function calculateProjectRevenueStats(
  revenue: ProjectRevenue[],
): ProjectRevenueStats {
  const activeEntries = revenue.filter((entry) => entry.status !== "cancelled");
  const sumByStatus = (status: RevenueStatus) =>
    activeEntries
      .filter((entry) => entry.status === status)
      .reduce((total, entry) => total + entry.amount, 0);

  const receivedAmount = sumByStatus("received");
  const committedAmount = sumByStatus("committed");
  const plannedAmount = sumByStatus("planned");
  const totalAmount = activeEntries.reduce((total, entry) => total + entry.amount, 0);

  return {
    totalEntries: revenue.length,
    activeEntries: activeEntries.length,
    totalAmount,
    receivedAmount,
    committedAmount,
    plannedAmount,
    outstandingAmount: plannedAmount + committedAmount,
  };
}