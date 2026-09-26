"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateRoleAction } from "@/lib/actions/role.actions";
import { updateRoleSchema } from "@/lib/validations/role";
import { formatZodError } from "@/lib/validations/helpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Shield } from "lucide-react";
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
  permissions: { id: string; key: string; description: string }[];
}

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleWithPermissions | null;
  systemPermissions: PermissionItem[];
}

function EditRoleFormContent({
  role,
  systemPermissions,
  onClose,
}: {
  role: RoleWithPermissions;
  systemPermissions: PermissionItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || "");
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    role.permissions.map((p) => p.key)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const permissionGroups = useMemo(() => {
    const groups: { [key: string]: { id: string; title: string; items: PermissionItem[] } } = {
      organization: { id: "organization", title: "Organization Management", items: [] },
      users: { id: "users", title: "Team & Member Access", items: [] },
      roles: { id: "roles", title: "Roles & Security Controls", items: [] },
    };

    const other: PermissionItem[] = [];

    systemPermissions.forEach((perm) => {
      const prefix = perm.key.split(".")[0];
      if (groups[prefix]) {
        groups[prefix].items.push(perm);
      } else {
        other.push(perm);
      }
    });

    const result = Object.values(groups).filter((g) => g.items.length > 0);
    if (other.length > 0) {
      result.push({ id: "other", title: "Additional Permissions", items: other });
    }
    return result;
  }, [systemPermissions]);

  function togglePermission(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleGroup(items: PermissionItem[]) {
    const itemKeys = items.map((i) => i.key);
    const allSelected = itemKeys.every((k) => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys((prev) => prev.filter((k) => !itemKeys.includes(k)));
    } else {
      setSelectedKeys((prev) => Array.from(new Set([...prev, ...itemKeys])));
    }
  }

  function selectAll() {
    setSelectedKeys(systemPermissions.map((p) => p.key));
  }

  function deselectAll() {
    setSelectedKeys([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = updateRoleSchema.safeParse({
      name,
      description,
      permissionKeys: selectedKeys,
    });

    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await updateRoleAction(role.id, {
        name: validation.data.name,
        description: validation.data.description,
        permissionKeys: validation.data.permissionKeys,
      });

      if (!res.success) {
        setError(res.error || "Failed to update role");
        setLoading(false);
        return;
      }

      onClose();
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setLoading(false);
    }
  }

  const isDefaultAdmin = role.name === DEFAULT_ORG_ADMIN_ROLE;

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3 shrink-0">
        <div className="space-y-1.5">
          <Label
            htmlFor="editRoleName"
            className="text-xs font-semibold uppercase tracking-wider text-slate-600"
          >
            Role Name
          </Label>
          <Input
            id="editRoleName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading || isDefaultAdmin}
            className="h-10 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600"
            required
          />
          {isDefaultAdmin && (
            <p className="text-[11px] text-amber-600">
              The name of the default Organization Admin role is system-locked.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="editRoleDesc"
            className="text-xs font-semibold uppercase tracking-wider text-slate-600"
          >
            Description
          </Label>
          <Input
            id="editRoleDesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            className="h-10 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600"
          />
        </div>
      </div>

      {/* Permissions Selector Header */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Permissions
          </Label>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
            {selectedKeys.length} of {systemPermissions.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Select All
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Grouped Permissions Scrollable List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-64 border border-slate-200 rounded-xl p-3 bg-slate-50/40">
        {permissionGroups.map((group) => {
          const groupKeys = group.items.map((i) => i.key);
          const groupSelectedCount = groupKeys.filter((k) => selectedKeys.includes(k)).length;
          const isAllGroupSelected = groupSelectedCount === groupKeys.length;

          return (
            <div key={group.id} className="bg-white rounded-lg border border-slate-200/80 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {group.title}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.items)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  {isAllGroupSelected ? "Deselect Group" : "Select Group"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-slate-100">
                {group.items.map((perm) => {
                  const checked = selectedKeys.includes(perm.key);
                  return (
                    <label
                      key={perm.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                        checked
                          ? "bg-blue-50/60 border border-blue-200/60"
                          : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(perm.key)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
                      />
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {perm.key}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {perm.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <DialogFooter className="pt-3 border-t border-slate-100 gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="h-9 px-4 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
        >
          {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditRoleDialog({
  open,
  onOpenChange,
  role,
  systemPermissions,
}: EditRoleDialogProps) {
  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Edit Role: {role.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Modify role details and manage assigned permissions.
          </DialogDescription>
        </DialogHeader>

        <EditRoleFormContent
          key={role.id}
          role={role}
          systemPermissions={systemPermissions}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
