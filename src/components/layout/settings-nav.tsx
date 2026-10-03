"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, Users, ShieldCheck, SlidersHorizontal, GitBranch } from "lucide-react";

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
    {
      title: "Custom Fields",
      href: "/settings/custom-fields",
      icon: SlidersHorizontal,
      permission: "custom_fields.view",
    },
    {
      title: "Pipelines",
      href: "/settings/pipelines",
      icon: GitBranch,
      permission: "pipelines.view",
    },
  ];

  return (
    <div className="border-b border-slate-200">
      <nav className="flex space-x-8" aria-label="Settings Navigation">
        {tabs.map((tab) => {
          if (tab.permission && !permSet.has(tab.permission)) {
            return null;
          }

          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-2 pb-3.5 pt-1 text-sm font-semibold transition-all relative",
                isActive
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span>{tab.title}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
