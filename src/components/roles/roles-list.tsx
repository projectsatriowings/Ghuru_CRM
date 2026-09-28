"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { deleteRoleAction } from "@/lib/actions/role.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateRoleDialog } from "./create-role-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
import {
  Shield,
  Trash2,
  Edit2,
  Users,
  Loader2,
  AlertCircle,
  Search,
  X,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase().trim();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.permissions.some((p) => p.key.toLowerCase().includes(q))
    );
  }, [roles, searchQuery]);

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
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setDeletingId(null);
    }
  }

  function toggleExpandRole(id: string) {
    setExpandedRoleId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Roles & permissions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure access control, member permissions, and custom security roles.
          </p>
        </div>
        {canCreate && (
          <CreateRoleDialog systemPermissions={systemPermissions} />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Summary Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search roles..."
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
            {filteredRoles.length}
          </span>
          <span>{filteredRoles.length === 1 ? "role" : "roles"} defined</span>
        </div>
      </div>

      {/* Role Cards List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRoles.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
            <Shield className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No roles found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? "Try a different search keyword."
                : "Create your first custom role using the button above."}
            </p>
          </div>
        ) : (
          filteredRoles.map((role) => {
            const isDefaultAdmin = role.name === DEFAULT_ORG_ADMIN_ROLE;
            const isExpanded = expandedRoleId === role.id;

            return (
              <div
                key={role.id}
                className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all p-5 space-y-4"
              >
                {/* Role Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 ring-4 ring-blue-50/50 shrink-0">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-base">
                          {role.name}
                        </h3>
                        {isDefaultAdmin && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            System Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {role.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Badge */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {canUpdate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRole(role)}
                        className="h-8 text-xs font-medium border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg gap-1.5"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Edit</span>
                      </Button>
                    )}

                    {canDelete && !isDefaultAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(role)}
                        disabled={
                          deletingId === role.id || role.memberCount > 0
                        }
                        className="h-8 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg gap-1.5"
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
                        <span>Delete</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Role Metrics & Quick Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        <strong className="text-slate-800 font-semibold">
                          {role.memberCount}
                        </strong>{" "}
                        {role.memberCount === 1 ? "member" : "members"} assigned
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
                      <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                      <span>
                        <strong className="text-blue-900 font-semibold">
                          {role.permissions.length}
                        </strong>{" "}
                        permissions granted
                      </span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpandRole(role.id)}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium text-xs transition-colors"
                  >
                    <span>
                      {isExpanded ? "Hide permissions" : "View permissions"}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Expanded Permissions Chip View */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100/80 bg-slate-50/50 p-3 rounded-lg space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Active Permission Keys:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.map((p) => (
                        <span
                          key={p.id}
                          className="font-mono text-[10px] font-medium bg-white text-slate-700 px-2 py-1 rounded-md border border-slate-200 shadow-2xs"
                          title={p.description}
                        >
                          {p.key}
                        </span>
                      ))}
                      {role.permissions.length === 0 && (
                        <span className="text-xs text-slate-400 italic">
                          No permissions assigned to this role.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Role Dialog */}
      <EditRoleDialog
        open={!!editingRole}
        onOpenChange={(open) => !open && setEditingRole(null)}
        role={editingRole}
        systemPermissions={systemPermissions}
      />
    </div>
  );
}
