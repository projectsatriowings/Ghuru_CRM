"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMemberRoleAction } from "@/lib/actions/user.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, Shield } from "lucide-react";

interface RoleOption {
  id: string;
  name: string;
}

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    name: string;
    email: string;
    roleId: string;
  } | null;
  roles: RoleOption[];
}

export function EditRoleDialog({
  open,
  onOpenChange,
  member,
  roles,
}: EditRoleDialogProps) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = useState(
    member?.roleId || roles[0]?.id || ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync selected role when member changes
  if (member && selectedRoleId !== member.roleId && !loading && !error) {
    setSelectedRoleId(member.roleId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;

    setError(null);
    setLoading(true);

    try {
      const res = await updateMemberRoleAction({
        memberId: member.id,
        roleId: selectedRoleId,
      });

      if (!res.success) {
        setError(res.error || "Failed to update member role");
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setLoading(false);
    }
  }

  if (!member) return null;

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-lg font-bold text-slate-900">
            Change member role
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Select a new access role and permission level for this member.
          </DialogDescription>
        </DialogHeader>

        {/* Member Profile Preview Card */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <Avatar className="h-10 w-10 ring-1 ring-slate-200">
            <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold text-xs">
              {initials || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-900 text-sm truncate">
              {member.name}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {member.email}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="editRoleSelect"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5"
            >
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              <span>Assigned Access Role</span>
            </Label>
            <Select
              value={selectedRoleId}
              onValueChange={(val: string | null) =>
                setSelectedRoleId(val || "")
              }
            >
              <SelectTrigger
                id="editRoleSelect"
                className="w-full h-10 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600"
              >
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-slate-200">
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
              Save role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
