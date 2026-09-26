"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface SidebarProps {
  permissions: string[];
}

export function Sidebar({ permissions }: SidebarProps) {
  const pathname = usePathname();
  const permSet = new Set(permissions);

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-screen shrink-0 sticky top-0">
      {/* Brand / Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
          <Layers className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight text-foreground">
            Ghuru CRM
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            SaaS Platform
          </span>
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div>
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Main
          </p>
          <nav className="space-y-1">
            {MAIN_NAV_ITEMS.map((item) => {
              if (item.permission && !permSet.has(item.permission)) {
                return null;
              }

              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href;

              return (
                <div key={item.title} className="space-y-1">
                  <Link
                    href={item.children ? item.children[0].href : item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>

                  {/* Submenu if exists */}
                  {item.children && (
                    <div className="pl-4 space-y-1 mt-1 border-l border-border/60 ml-4">
                      {item.children.map((sub) => {
                        if (sub.permission && !permSet.has(sub.permission)) {
                          return null;
                        }
                        const isSubActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                              isSubActive
                                ? "bg-accent text-accent-foreground font-semibold"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                          >
                            <sub.icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{sub.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-border">
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Ghuru CRM Core</p>
          <p className="text-[11px] mt-0.5">SaaS Foundation v0.1</p>
        </div>
      </div>
    </aside>
  );
}
