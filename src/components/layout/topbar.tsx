import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { Search } from "lucide-react";

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
    <header className="h-16 border-b border-slate-200/80 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left Search Bar */}
      <div className="flex items-center gap-3 w-full max-w-xs sm:max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50/80 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            readOnly
          />
        </div>
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
