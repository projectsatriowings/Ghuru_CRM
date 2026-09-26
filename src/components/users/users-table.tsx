"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddUserDialog } from "./add-user-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
import { Shield, Trash2, Edit2, Loader2, AlertCircle } from "lucide-react";

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

  async function handleRemove(memberId: string) {
    if (!confirm("Are you sure you want to remove this member from the organization?")) {
      return;
    }

    setError(null);
    setDeletingId(memberId);

    try {
      const res = await removeMemberAction({ memberId });
      if (!res.success) {
        setError(res.error || "Failed to remove member");
        setDeletingId(null);
        return;
      }
      setDeletingId(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Members ({members.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage users with access to this organization.
          </p>
        </div>
        {canCreate && <AddUserDialog roles={roles} />}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const initials = member.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {member.image && (
                          <AvatarImage src={member.image} alt={member.name} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground flex items-center gap-1.5">
                          {member.name}
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                              You
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center w-fit gap-1 text-xs">
                      <Shield className="h-3 w-3 text-primary" />
                      {member.roleName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMember(member)}
                          className="h-8 w-8 p-0"
                          title="Change Role"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(member.id)}
                          disabled={deletingId === member.id}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remove Member"
                        >
                          {deletingId === member.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <EditRoleDialog
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        member={editingMember}
        roles={roles}
      />
    </div>
  );
}
