"use client";

import { useState, useMemo } from "react";
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
import { ShieldPlus, Loader2, AlertCircle } from "lucide-react";

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
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-3.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm gap-2 transition-colors">
          <ShieldPlus className="h-3.5 w-3.5" />
          <span>Create role</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-lg font-bold text-slate-900">
            Create role
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Define role name, description, and assign granular permissions for organization members.
          </DialogDescription>
        </DialogHeader>

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
                htmlFor="roleName"
                className="text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Role Name
              </Label>
              <Input
                id="roleName"
                placeholder="e.g. Sales Manager, Support Specialist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="h-10 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="roleDesc"
                className="text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Description
              </Label>
              <Input
                id="roleDesc"
                placeholder="e.g. Can view users, invite members, and manage pipeline records"
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
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
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
              onClick={() => setOpen(false)}
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
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
