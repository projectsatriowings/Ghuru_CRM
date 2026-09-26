"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRoleAction } from "@/lib/actions/role.actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateRoleDialog } from "./create-role-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
import { Shield, Trash2, Edit2, Users, Loader2, AlertCircle } from "lucide-react";
import { DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";

interface PermissionItem {
  id: string;
  key: string;
  description: string;
}

interface RoleWithPermissions {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  permissions: { id: string; key: string; description: string }[];
}

interface RolesListProps {
  roles: RoleWithPermissions[];
  systemPermissions: PermissionItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function RolesList({
  roles,
  systemPermissions,
  canCreate,
  canUpdate,
  canDelete,
}: RolesListProps) {
  const router = useRouter();
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(role: RoleWithPermissions) {
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      return;
    }

    setError(null);
    setDeletingId(role.id);

    try {
      const res = await deleteRoleAction(role.id);
      if (!res.success) {
        setError(res.error || "Failed to delete role");
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Roles & Permissions ({roles.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage granular access control roles for this organization.
          </p>
        </div>
        {canCreate && (
          <CreateRoleDialog systemPermissions={systemPermissions} />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => {
          const isDefaultAdmin = role.name === DEFAULT_ORG_ADMIN_ROLE;

          return (
            <Card key={role.id} className="border-border flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {role.name}
                      {isDefaultAdmin && (
                        <Badge variant="secondary" className="text-[10px] py-0">
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {role.description || "No description provided."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    <Users className="h-3.5 w-3.5" />
                    <span>{role.memberCount}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pb-3">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1.5">
                    Assigned Permissions ({role.permissions.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                    {role.permissions.map((p) => (
                      <span
                        key={p.id}
                        className="font-mono text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border"
                        title={p.description}
                      >
                        {p.key}
                      </span>
                    ))}
                    {role.permissions.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        No permissions assigned.
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t border-border flex justify-end gap-2">
                {canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRole(role)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}

                {canDelete && !isDefaultAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(role)}
                    disabled={deletingId === role.id || role.memberCount > 0}
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                    title={
                      role.memberCount > 0
                        ? "Reassign members before deleting this role"
                        : "Delete role"
                    }
                  >
                    {deletingId === role.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <EditRoleDialog
        open={!!editingRole}
        onOpenChange={(open) => !open && setEditingRole(null)}
        role={editingRole}
        systemPermissions={systemPermissions}
      />
    </div>
  );
}
