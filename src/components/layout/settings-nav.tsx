"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, Users, Shield } from "lucide-react";

interface SettingsNavProps {
  permissions: string[];
}

export function SettingsNav({ permissions }: SettingsNavProps) {
  const pathname = usePathname();
  const permSet = new Set(permissions);

  const tabs = [
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
      icon: Shield,
      permission: "roles.view",
    },
  ];

  return (
    <div className="border-b border-border">
      <nav className="flex space-x-6 overflow-x-auto" aria-label="Settings Tabs">
        {tabs.map((tab) => {
          if (tab.permission && !permSet.has(tab.permission)) {
            return null;
          }

          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
