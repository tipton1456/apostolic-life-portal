export const REVENUE_CATEGORY_OPTIONS = [
  { value: "donations", label: "Donations" },
  { value: "grants", label: "Grants" },
  { value: "sales", label: "Sales" },
  { value: "sponsorship", label: "Sponsorship" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
] as const;

export const REVENUE_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "committed", label: "Committed" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
] as const;