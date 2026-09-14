import {
  LayoutDashboard,
  ListChecks,
  Settings,
  Activity,
  Users,
  ListOrdered,
  LayoutGrid,
  User as UserIcon,
} from "lucide-react";
import type { NavItem } from "@/components/layout/AppShell";

// Shared so /results (reachable from both the admin console and the
// regular participant area) can show the right sidebar for whoever's
// looking at it, instead of always dropping an admin into the participant
// nav and stranding them there with no way back to Dashboard/Users/System.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/positions", label: "Positions", icon: <ListChecks className="h-4 w-4" /> },
  { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/settings", label: "System", icon: <Settings className="h-4 w-4" /> },
  { href: "/admin/monitor", label: "Monitor", icon: <Activity className="h-4 w-4" /> },
  { href: "/results", label: "Results", icon: <ListOrdered className="h-4 w-4" /> },
];

export const USER_NAV_ITEMS: NavItem[] = [
  { href: "/positions", label: "Positions", icon: <LayoutGrid className="h-4 w-4" /> },
  { href: "/my-position", label: "My Position", icon: <UserIcon className="h-4 w-4" /> },
  { href: "/results", label: "Results", icon: <ListOrdered className="h-4 w-4" /> },
];
