"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFollowUpAction } from "@/lib/actions/follow-up.actions";
import { updateFollowUpSchema } from "@/lib/validations/follow-up";
import { formatZodError } from "@/lib/validations/helpers";
import { FOLLOW_UP_STATUSES, type FollowUpStatus } from "@/db/schema/follow-ups";
import { FOLLOW_UP_STATUS_LABELS, type FollowUpWithRelations } from "@/lib/types/follow-ups";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, Edit2 } from "lucide-react";

interface EditFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: FollowUpWithRelations | null;
  leadId: string;
  members: Array<{ id: string; name: string; email: string }>;
  onSuccess?: () => void;
}

function EditFollowUpFormContent({
  followUp,
  leadId,
  members,
  onClose,
  onSuccess,
}: {
  followUp: FollowUpWithRelations;
  leadId: string;
  members: Array<{ id: string; name: string; email: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(followUp.title);
  const [description, setDescription] = useState(followUp.description || "");
  const [dueDate, setDueDate] = useState(followUp.dueDate);
  const [dueTime, setDueTime] = useState(followUp.dueTime || "");
  const [assignedToUserId, setAssignedToUserId] = useState<string>(
    followUp.assignedToUserId || ""
  );
  const [status, setStatus] = useState<FollowUpStatus>(followUp.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = updateFollowUpSchema.safeParse({
      title,
      description: description.trim() || null,
      dueDate,
      dueTime: dueTime.trim() || null,
      assignedToUserId: assignedToUserId || null,
      status,
    });

    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await updateFollowUpAction(
        followUp.id,
        leadId,
        validation.data
      );

      if (!res.success) {
        setError(res.error || "Failed to update follow-up.");
        setLoading(false);
        return;
      }

      onClose();
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label
          htmlFor="editFollowUpTitle"
          className="text-xs font-semibold text-slate-700"
        >
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="editFollowUpTitle"
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
            htmlFor="editFollowUpDueDate"
            className="text-xs font-semibold text-slate-700"
          >
            Due Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="editFollowUpDueDate"
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
            htmlFor="editFollowUpDueTime"
            className="text-xs font-semibold text-slate-700"
          >
            Due Time <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Input
            id="editFollowUpDueTime"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            disabled={loading}
            className="h-9 text-xs bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="editFollowUpStatus"
            className="text-xs font-semibold text-slate-700"
          >
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as FollowUpStatus)}
            disabled={loading}
          >
            <SelectTrigger id="editFollowUpStatus" className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_STATUSES.map((st) => (
                <SelectItem key={st} value={st} className="text-xs">
                  {FOLLOW_UP_STATUS_LABELS[st]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="editFollowUpAssignee"
            className="text-xs font-semibold text-slate-700"
          >
            Assigned To
          </Label>
          <Select
            value={assignedToUserId || "unassigned"}
            onValueChange={(val) => setAssignedToUserId(val === "unassigned" || !val ? "" : val)}
            disabled={loading}
          >
            <SelectTrigger id="editFollowUpAssignee" className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned" className="text-xs text-slate-500">
                Unassigned
              </SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name} ({m.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="editFollowUpDescription"
          className="text-xs font-semibold text-slate-700"
        >
          Description <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <textarea
          id="editFollowUpDescription"
          rows={3}
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
          onClick={onClose}
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
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditFollowUpDialog({
  open,
  onOpenChange,
  followUp,
  leadId,
  members,
  onSuccess,
}: EditFollowUpDialogProps) {
  if (!followUp) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-blue-600" />
            <span>Edit Follow-up</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update follow-up title, schedule, status, or assignment.
          </DialogDescription>
        </DialogHeader>

        <EditFollowUpFormContent
          key={followUp.id}
          followUp={followUp}
          leadId={leadId}
          members={members}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
