"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoleAction } from "@/lib/actions/role.actions";
import { createRoleSchema } from "@/lib/validations/role";
import { formatZodError } from "@/lib/validations/helpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldPlus, Loader2 } from "lucide-react";

interface PermissionItem {
  id: string;
  key: string;
  description: string;
}

interface CreateRoleDialogProps {
  systemPermissions: PermissionItem[];
}

export function CreateRoleDialog({ systemPermissions }: CreateRoleDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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

    const validation = createRoleSchema.safeParse({
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
      const res = await createRoleAction({
        name: validation.data.name,
        description: validation.data.description,
        permissionKeys: validation.data.permissionKeys,
      });

      if (!res.success) {
        setError(res.error || "Failed to create role");
        setLoading(false);
        return;
      }

      setOpen(false);
      setName("");
      setDescription("");
      setSelectedKeys([]);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <ShieldPlus className="h-4 w-4" />
          <span>Create Role</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
          <DialogDescription>
            Define a role and assign specific permissions for your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-1 flex-1">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="roleName">Role Name</Label>
            <Input
              id="roleName"
              placeholder="e.g. Sales Manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleDesc">Description</Label>
            <Input
              id="roleDesc"
              placeholder="e.g. Can view users and reports"
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
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
