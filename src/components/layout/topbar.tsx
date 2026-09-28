import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";

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
    <header className="h-16 border-b border-slate-200/80 bg-white px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left Breadcrumb / Workspace Context */}
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <span className="font-semibold text-slate-900">{currentOrg.name}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Workspace</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <OrgSwitcher currentOrg={currentOrg} userOrgs={userOrgs} />
        <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />
        <UserMenu user={user} roleName={roleName} />
      </div>
    </header>
  );
}
