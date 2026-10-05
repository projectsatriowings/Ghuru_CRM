"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, ChevronDown } from "lucide-react";

interface UserMenuProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  roleName: string;
}

export function UserMenu({ user, roleName }: UserMenuProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 px-2.5 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 transition-colors"
        >
          <Avatar className="h-8 w-8 ring-2 ring-blue-600/20">
            {user.image && <AvatarImage src={user.image} alt={user.name} />}
            <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-blue-500 text-white font-bold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {user.name}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {roleName}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 hidden sm:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-1.5 rounded-xl shadow-lg border-slate-200" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal px-2.5 py-2">
            <div className="flex flex-col space-y-0.5">
              <p className="text-xs font-bold text-slate-900">{user.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              <span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit">
                {roleName}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-slate-100" />
        <DropdownMenuItem asChild>
          <Link
            href="/settings/organization"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <Settings className="h-3.5 w-3.5 text-slate-400" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-100" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
