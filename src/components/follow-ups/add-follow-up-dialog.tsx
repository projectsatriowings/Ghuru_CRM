"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFollowUpAction } from "@/lib/actions/follow-up.actions";
import { createFollowUpSchema } from "@/lib/validations/follow-up";
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
import { CalendarClock, Plus, Loader2, AlertCircle } from "lucide-react";

interface AddFollowUpDialogProps {
  leadId: string;
  currentUserId?: string;
  members: Array<{ id: string; name: string; email: string }>;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddFollowUpDialog({
  leadId,
  currentUserId,
  members,
  trigger,
  onSuccess,
}: AddFollowUpDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState<string>(
    currentUserId || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = createFollowUpSchema.safeParse({
      title,
      description: description.trim() || undefined,
      dueDate,
      dueTime: dueTime.trim() || undefined,
      assignedToUserId: assignedToUserId || undefined,
      status: "pending",
    });

    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await createFollowUpAction(leadId, validation.data);

      if (!res.success) {
        setError(res.error || "Failed to create follow-up.");
        setLoading(false);
        return;
      }

      setOpen(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
      setLoading(false);

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-8 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Follow-up</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-600" />
            <span>Schedule Follow-up / Next Action</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Define what needs to happen next for this lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="followUpTitle"
              className="text-xs font-semibold text-slate-700"
            >
              Action Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="followUpTitle"
              placeholder="e.g. Follow up with lead"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              className="h-9 text-xs bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="followUpDueDate"
                className="text-xs font-semibold text-slate-700"
              >
                Due Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="followUpDueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading}
                className="h-9 text-xs bg-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="followUpDueTime"
                className="text-xs font-semibold text-slate-700"
              >
                Due Time <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="followUpDueTime"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={loading}
                className="h-9 text-xs bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="followUpAssignee"
              className="text-xs font-semibold text-slate-700"
            >
              Assigned To
            </Label>
            <Select
              value={assignedToUserId}
              onValueChange={(val) => setAssignedToUserId(val || "")}
              disabled={loading}
            >
              <SelectTrigger id="followUpAssignee" className="h-9 text-xs bg-white">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name} ({m.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="followUpDescription"
              className="text-xs font-semibold text-slate-700"
            >
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <textarea
              id="followUpDescription"
              rows={3}
              placeholder="e.g. Discuss course details and confirm weekend batch."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
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
              className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
            >
              {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save Follow-up
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
