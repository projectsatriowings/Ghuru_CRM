"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { removeMemberAction } from "@/lib/actions/user.actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddUserDialog } from "./add-user-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
import {
  Shield,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  Search,
  MoreHorizontal,
  X,
  UserCheck,
} from "lucide-react";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  image?: string | null;
  roleId: string;
  roleName: string;
  joinedAt: Date;
}

interface RoleOption {
  id: string;
  name: string;
}

interface UsersTableProps {
  members: Member[];
  roles: RoleOption[];
  currentUserId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function UsersTable({
  members,
  roles,
  currentUserId,
  canCreate,
  canUpdate,
  canDelete,
}: UsersTableProps) {
  const router = useRouter();
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.roleName.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  async function handleRemove(member: Member) {
    if (
      !confirm(
        `Are you sure you want to remove "${member.name}" (${member.email}) from the organization?`
      )
    ) {
      return;
    }

    setError(null);
    setDeletingId(member.id);

    try {
      const res = await removeMemberAction({ memberId: member.id });
      if (!res.success) {
        setError(res.error || "Failed to remove member");
        setDeletingId(null);
        return;
      }
      setDeletingId(null);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Team members
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your organization members, permissions, and roles.
          </p>
        </div>
        {canCreate && <AddUserDialog roles={roles} />}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:border-blue-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium px-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
            {filteredMembers.length}
          </span>
          <span>{filteredMembers.length === 1 ? "member" : "members"}</span>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 pl-6">
                Member
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Email
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Role
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Joined
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 pr-6 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-36 text-center text-slate-500 text-sm"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <UserCheck className="h-8 w-8 text-slate-300 mb-1" />
                    <p className="font-semibold text-slate-700">No members found</p>
                    <p className="text-xs text-slate-400">
                      {searchQuery
                        ? "Try adjusting your search query."
                        : "Add your first team member using the button above."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => {
                const isCurrentUser = member.userId === currentUserId;
                const initials = member.name
                  .split(" ")
                  .map((n) => n[0])
                  .filter(Boolean)
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <TableRow
                    key={member.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Member Column */}
                    <TableCell className="py-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 ring-1 ring-slate-200">
                          {member.image && (
                            <AvatarImage src={member.image} alt={member.name} />
                          )}
                          <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold text-xs">
                            {initials || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                            {member.name}
                            {isCurrentUser && (
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-slate-200">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-slate-400 sm:hidden">
                            {member.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Email Column */}
                    <TableCell className="py-3.5 text-xs text-slate-600 font-normal">
                      {member.email}
                    </TableCell>

                    {/* Role Column */}
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                        <Shield className="h-3 w-3 text-blue-600" />
                        {member.roleName}
                      </span>
                    </TableCell>

                    {/* Status Column */}
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    </TableCell>

                    {/* Joined Column */}
                    <TableCell className="py-3.5 text-xs text-slate-500">
                      {new Date(member.joinedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell className="py-3.5 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate || canDelete ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                              >
                                {deletingId === member.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44 p-1 rounded-xl shadow-lg border-slate-200"
                            >
                              {canUpdate && (
                                <DropdownMenuItem
                                  onClick={() => setEditingMember(member)}
                                  className="flex items-center gap-2 px-2.5 py-2 text-xs text-slate-700 rounded-lg cursor-pointer hover:bg-slate-50"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Change role</span>
                                </DropdownMenuItem>
                              )}
                              {canDelete && !isCurrentUser && (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-100" />
                                  <DropdownMenuItem
                                    onClick={() => handleRemove(member)}
                                    disabled={deletingId === member.id}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs text-red-600 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Remove member</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Read-only
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Role Dialog */}
      <EditRoleDialog
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        member={editingMember}
        roles={roles}
      />
    </div>
  );
}
