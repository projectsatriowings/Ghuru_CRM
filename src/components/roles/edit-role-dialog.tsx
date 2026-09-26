"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
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

  function togglePermission(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
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
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  const isDefaultAdmin = role.name === DEFAULT_ORG_ADMIN_ROLE;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-1 flex-1">
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="editRoleName">Role Name</Label>
        <Input
          id="editRoleName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading || isDefaultAdmin}
          required
        />
        {isDefaultAdmin && (
          <p className="text-xs text-muted-foreground">
            The name of the default Organization Admin role cannot be changed.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="editRoleDesc">Description</Label>
        <Input
          id="editRoleDesc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label>Permissions ({selectedKeys.length} selected)</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary"
              onClick={selectAll}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={deselectAll}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-md divide-y divide-border max-h-56 overflow-y-auto">
          {systemPermissions.map((perm) => {
            const checked = selectedKeys.includes(perm.key);
            return (
              <label
                key={perm.id}
                className="flex items-start gap-3 p-2.5 hover:bg-accent/40 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePermission(perm.key)}
                  className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {perm.key}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {perm.description}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <DialogFooter className="pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Role
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Role: {role.name}</DialogTitle>
          <DialogDescription>
            Modify role details and assigned permissions.
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
