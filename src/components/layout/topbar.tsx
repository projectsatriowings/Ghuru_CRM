import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { Badge } from "@/components/ui/badge";

interface TopbarProps {
  currentOrg: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  roleName: string;
  userOrgs: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    roleName: string;
  }>;
}

export function Topbar({
  currentOrg,
  user,
  roleName,
  userOrgs,
}: TopbarProps) {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <OrgSwitcher currentOrg={currentOrg} userOrgs={userOrgs} />
        <Badge variant="secondary" className="hidden sm:inline-flex text-[11px] font-normal">
          Multi-tenant Active
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex flex-col text-right">
          <span className="text-sm font-medium text-foreground">{user.name}</span>
          <span className="text-xs text-muted-foreground">{roleName}</span>
        </div>
        <UserMenu user={user} roleName={roleName} />
      </div>
    </header>
  );
}
