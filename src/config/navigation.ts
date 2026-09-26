import {
  LayoutDashboard,
  Settings,
  Building2,
  Users,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  badge?: string;
  children?: NavItem[];
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      {
        title: "Organization",
        href: "/settings/organization",
        icon: Building2,
        permission: "organization.view",
      },
      {
        title: "Users & Members",
        href: "/settings/users",
        icon: Users,
        permission: "users.view",
      },
      {
        title: "Roles & Permissions",
        href: "/settings/roles",
        icon: ShieldCheck,
        permission: "roles.view",
      },
    ],
  },
];
