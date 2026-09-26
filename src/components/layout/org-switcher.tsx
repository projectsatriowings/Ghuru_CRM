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
import { Building2, Check, ChevronsUpDown, PlusCircle } from "lucide-react";

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
          className="w-56 justify-between text-left font-normal bg-card hover:bg-accent border-border"
          disabled={switching}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-semibold text-foreground">
              {currentOrg.name}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userOrgs.map((org) => {
          const isSelected = org.organizationId === currentOrg.id;
          return (
            <DropdownMenuItem
              key={org.organizationId}
              onClick={() => handleSwitch(org.organizationId)}
              className="flex items-center justify-between cursor-pointer py-2"
            >
              <div className="flex flex-col">
                <span className="font-medium text-sm text-foreground">
                  {org.organizationName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {org.roleName}
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary ml-2 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/onboarding")}
          className="cursor-pointer text-primary focus:text-primary font-medium"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          <span>Create New Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
