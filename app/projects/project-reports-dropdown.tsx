"use client";

import { PortalIcon } from "@/app/icons";

const BASE_REPORT_OPTIONS = [
  { label: "Project Summary", path: "summary-report" },
  { label: "Tasks by Milestone", path: "milestone-report" },
] as const;

const FINANCIAL_REPORT_OPTIONS = [
  { label: "Expense Summary", path: "cost-summary-report" },
  { label: "Income Summary", path: "income-summary-report" },
  { label: "Financial Summary", path: "financial-summary-report" },
  { label: "Financial Export", path: "financial-export" },
] as const;

export default function ProjectReportsDropdown({
  projectId,
  canViewFinancialReports = false,
}: {
  projectId: string;
  canViewFinancialReports?: boolean;
}) {
  const reportOptions = canViewFinancialReports
    ? [...BASE_REPORT_OPTIONS, ...FINANCIAL_REPORT_OPTIONS]
    : [...BASE_REPORT_OPTIONS];

  return (
    <label className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-lime-400">
      <span className="inline-flex items-center gap-2">
        <PortalIcon className="h-4 w-4" name="report" />
        Project Reports
      </span>
      <select
        defaultValue=""
        onChange={(event) => {
          const path = event.target.value;
          if (!path) return;

          window.open(`/api/projects/${projectId}/${path}`, "_blank", "noopener,noreferrer");
          event.target.value = "";
        }}
        className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm font-semibold text-lime-300 outline-none ring-lime-400 transition focus:ring-2"
      >
        <option value="" disabled>
          Select a report...
        </option>
        {reportOptions.map((option) => (
          <option key={option.path} value={option.path}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}