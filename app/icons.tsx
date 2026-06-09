import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareText,
  Pencil,
  Rocket,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PortalIconName =
  | "admin"
  | "assignments"
  | "caution"
  | "check"
  | "contact"
  | "communications"
  | "dashboard"
  | "deployments"
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
  caution: AlertTriangle,
  check: CheckCircle2,
  contact: Users,
  communications: MessageSquareText,
  dashboard: LayoutDashboard,
  deployments: Rocket,
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
