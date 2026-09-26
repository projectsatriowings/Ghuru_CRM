"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction } from "@/lib/actions/user.actions";
import { addMemberSchema } from "@/lib/validations/user";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";

interface RoleOption {
  id: string;
  name: string;
}

interface AddUserDialogProps {
  roles: RoleOption[];
}

export function AddUserDialog({ roles }: AddUserDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id || "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = addMemberSchema.safeParse({ name, email, roleId });
    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await addMemberAction({
        name: validation.data.name,
        email: validation.data.email,
        roleId: validation.data.roleId,
      });

      if (!res.success) {
        setError(res.error || "Failed to add member");
        setLoading(false);
        return;
      }

      setOpen(false);
      setName("");
      setEmail("");
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
          <UserPlus className="h-4 w-4" />
          <span>Add Member</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Add a user to this organization and assign them a role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="memberName">Full Name</Label>
            <Input
              id="memberName"
              placeholder="e.g. Alex Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memberEmail">Email Address</Label>
            <Input
              id="memberEmail"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleSelect">Assigned Role</Label>
            <Select value={roleId} onValueChange={(val: string | null) => setRoleId(val || "")}>
              <SelectTrigger id="roleSelect" className="w-full">
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
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
