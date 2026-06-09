import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PortalIconName =
  | "admin"
  | "assignments"
  | "contact"
  | "dashboard"
  | "events"
  | "expense"
  | "giving"
  | "groups"
  | "prayer"
  | "resources"
  | "search"
  | "trash"
  | "update";

const iconMap: Record<PortalIconName, LucideIcon> = {
  admin: ShieldCheck,
  assignments: ClipboardList,
  contact: Users,
  dashboard: LayoutDashboard,
  events: CalendarDays,
  expense: HandCoins,
  giving: CreditCard,
  groups: Users,
  prayer: HeartHandshake,
  resources: FileText,
  search: Search,
  trash: Trash2,
  update: Pencil,
};

export function PortalIcon({
  className = "h-5 w-5",
  name,
  strokeWidth = 2,
}: {
  className?: string;
  name: PortalIconName;
  strokeWidth?: number;
}) {
  const Icon = iconMap[name];

  return <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
}
