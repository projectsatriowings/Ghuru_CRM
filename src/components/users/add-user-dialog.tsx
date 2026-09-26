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
import { UserPlus, Loader2, AlertCircle } from "lucide-react";

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
          <UserPlus className="h-3.5 w-3.5" />
          <span>Add Member</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-lg font-bold text-slate-900">
            Add New Member
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Invite a new member to join this organization and assign their permission role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="memberName"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Full Name
            </Label>
            <Input
              id="memberName"
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="h-10 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="memberEmail"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Work Email Address
            </Label>
            <Input
              id="memberEmail"
              type="email"
              placeholder="alex@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-10 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="roleSelect"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Assigned Role
            </Label>
            <Select
              value={roleId}
              onValueChange={(val: string | null) => setRoleId(val || "")}
            >
              <SelectTrigger
                id="roleSelect"
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
              Add Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
