"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { switchOrganizationAction } from "@/lib/actions/organization.actions";
import { Building2, Check, ChevronDown, PlusCircle } from "lucide-react";

interface OrgItem {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  roleName: string;
}

interface OrgSwitcherProps {
  currentOrg: {
    id: string;
    name: string;
    slug: string;
  };
  userOrgs: OrgItem[];
}

export function OrgSwitcher({ currentOrg, userOrgs }: OrgSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(orgId: string) {
    if (orgId === currentOrg.id || switching) return;
    setSwitching(true);
    await switchOrganizationAction(orgId);
    setSwitching(false);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-10 px-3.5 bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center gap-2.5 transition-colors shadow-2xs"
          disabled={switching}
        >
          <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-blue-100 text-blue-600 shrink-0">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <span className="truncate max-w-[130px] sm:max-w-[180px]">
            {currentOrg.name}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-1.5 rounded-xl shadow-lg border-slate-200" align="end">
        <DropdownMenuLabel className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">
          Your Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-100" />
        <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
          {userOrgs.map((org) => {
            const isSelected = org.organizationId === currentOrg.id;
            return (
              <DropdownMenuItem
                key={org.organizationId}
                onClick={() => handleSwitch(org.organizationId)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer hover:bg-slate-50"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-slate-800">
                    {org.organizationName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {org.roleName}
                  </span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator className="bg-slate-100" />
        <DropdownMenuItem
          onClick={() => router.push("/onboarding")}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-semibold text-xs"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Create New Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
