import {
  Activity,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardList,
  CreditCard,
  FileText,
  Files,
  FolderKanban,
  HandCoins,
  HardHat,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareText,
  PauseCircle,
  Pencil,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PortalIconName =
  | "active"
  | "admin"
  | "assignments"
  | "cancelled"
  | "caution"
  | "check"
  | "contact"
  | "communications"
  | "dashboard"
  | "deployments"
  | "events"
  | "expense"
  | "files"
  | "giving"
  | "groups"
  | "manager"
  | "onHold"
  | "prayer"
  | "projects"
  | "resources"
  | "search"
  | "settings"
  | "trash"
  | "update"
  | "userPlus"
  | "worker";

const iconMap: Record<PortalIconName, LucideIcon> = {
  active: Activity,
  admin: ShieldCheck,
  assignments: ClipboardList,
  cancelled: CircleX,
  caution: AlertTriangle,
  check: CheckCircle2,
  contact: Users,
  communications: MessageSquareText,
  dashboard: LayoutDashboard,
  deployments: Rocket,
  events: CalendarDays,
  expense: HandCoins,
  files: Files,
  giving: CreditCard,
  groups: Users,
  manager: Briefcase,
  onHold: PauseCircle,
  prayer: HeartHandshake,
  projects: FolderKanban,
  resources: FileText,
  search: Search,
  settings: Settings,
  trash: Trash2,
  update: Pencil,
  userPlus: UserPlus,
  worker: HardHat,
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
