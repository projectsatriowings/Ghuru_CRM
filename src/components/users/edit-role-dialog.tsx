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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

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
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Member Role</DialogTitle>
          <DialogDescription>
            Update the role and permissions for {member.name} ({member.email}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="editRoleSelect">Role</Label>
            <Select value={selectedRoleId} onValueChange={(val: string | null) => setSelectedRoleId(val || "")}>
              <SelectTrigger id="editRoleSelect" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
}
