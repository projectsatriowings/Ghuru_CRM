"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import {
  LayoutDashboard,
  Building2,
  Building,
  Users,
  ShieldCheck,
  UserPlus,
  Contact,
  Briefcase,
  Zap,
} from "lucide-react";

interface SidebarProps {
  permissions: string[];
}

export function Sidebar({ permissions }: SidebarProps) {
  const pathname = usePathname();
  const permSet = new Set(permissions);

  const mainNav = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  const crmNav = [
    {
      title: "Leads",
      href: "/leads",
      icon: UserPlus,
      permission: "leads.view",
    },
    {
      title: "Contacts",
      href: "/contacts",
      icon: Contact,
      permission: "contacts.view",
    },
    {
      title: "Companies",
      href: "/companies",
      icon: Building,
      permission: "companies.view",
    },
    {
      title: "Deals",
      href: "/deals",
      icon: Briefcase,
      permission: "deals.view",
    },
    {
      title: "Automations",
      href: "/automations",
      icon: Zap,
      permission: "automations.view",
    },
  ];

  const settingsNav = [
    {
      title: "Organization",
      href: "/settings/organization",
      icon: Building2,
      permission: "organization.view",
    },
    {
      title: "Users",
      href: "/settings/users",
      icon: Users,
      permission: "users.view",
    },
    {
      title: "Roles",
      href: "/settings/roles",
      icon: ShieldCheck,
      permission: "roles.view",
    },
  ];

  return (
    <aside className="w-60 xl:w-64 bg-[#081B33] text-slate-300 flex flex-col h-screen shrink-0 sticky top-0 border-r border-[#0E2644] select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#0E2644]">
        <Logo variant="dark" size="sm" />
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3.5 py-6 space-y-6">
        {/* MAIN Section */}
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Main
          </p>
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-xs"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* CRM Section */}
        {permSet.has("leads.view") && (
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              CRM
            </p>
            <nav className="space-y-1">
              {crmNav.map((item) => {
                if (item.permission && !permSet.has(item.permission)) {
                  return null;
                }
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* SETTINGS Section */}
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Settings
          </p>
          <nav className="space-y-1">
            {settingsNav.map((item) => {
              if (item.permission && !permSet.has(item.permission)) {
                return null;
              }
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-xs"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Footer Box */}
      <div className="p-4 border-t border-[#0E2644]">
        <div className="rounded-lg bg-[#0C2442] border border-[#143258] p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Ghuru CRM</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">SaaS Platform</p>
        </div>
      </div>
    </aside>
  );
}
