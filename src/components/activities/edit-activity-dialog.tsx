"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateActivityAction } from "@/lib/actions/activity.actions";
import { updateActivitySchema } from "@/lib/validations/activity";
import { formatZodError } from "@/lib/validations/helpers";
import {
  type ActivityType,
  type ActivityStatus,
} from "@/db/schema/activities";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityWithRelations,
} from "@/lib/types/activities";
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
import { Loader2, AlertCircle } from "lucide-react";
import { ActivityIcon } from "./activity-icon";

const EDITABLE_ACTIVITY_TYPES: ActivityType[] = [
  "call",
  "email",
  "meeting",
  "note",
  "task",
  "follow_up",
];

interface EditActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityWithRelations | null;
  leadId?: string;
  members?: Array<{ id: string; name: string; email: string }>;
  onSuccess?: () => void;
}

function EditActivityFormContent({
  activity,
  members = [],
  onClose,
  onSuccess,
}: {
  activity: ActivityWithRelations;
  members?: Array<{ id: string; name: string; email: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<ActivityType>(activity.type);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description || "");
  const [status, setStatus] = useState<ActivityStatus>(activity.status || "completed");
  const [assignedToUserId, setAssignedToUserId] = useState<string>(
    activity.assignedToUserId || "none"
  );
  const [dueDate, setDueDate] = useState<string>(
    activity.dueAt
      ? new Date(activity.dueAt).toISOString().split("T")[0]
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = updateActivitySchema.safeParse({
      type,
      title,
      description,
      status,
      assignedToUserId: assignedToUserId === "none" ? null : assignedToUserId,
      dueAt: dueDate ? new Date(dueDate) : null,
    });

    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await updateActivityAction(
        activity.id,
        validation.data
      );

      if (!res.success) {
        setError(res.error || "Failed to update activity.");
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="editActivityType"
            className="text-xs font-semibold text-slate-700"
          >
            Activity Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={type}
            onValueChange={(val) => setType(val as ActivityType)}
            disabled={loading}
          >
            <SelectTrigger id="editActivityType" className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {EDITABLE_ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  <div className="flex items-center gap-2">
                    <ActivityIcon type={t} className="h-3.5 w-3.5 text-slate-500" />
                    <span>{ACTIVITY_TYPE_LABELS[t]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="editActivityStatus"
            className="text-xs font-semibold text-slate-700"
          >
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as ActivityStatus)}
            disabled={loading}
          >
            <SelectTrigger id="editActivityStatus" className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed" className="text-xs">Completed</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="editActivityTitle"
          className="text-xs font-semibold text-slate-700"
        >
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="editActivityTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="h-9 text-xs bg-white"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="editActivityDescription"
          className="text-xs font-semibold text-slate-700"
        >
          Description <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <textarea
          id="editActivityDescription"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {members.length > 0 && (
          <div className="space-y-1.5">
            <Label
              htmlFor="editActivityAssignee"
              className="text-xs font-semibold text-slate-700"
            >
              Assigned To
            </Label>
            <Select
              value={assignedToUserId}
              onValueChange={(val) => setAssignedToUserId(val ?? "")}
              disabled={loading}
            >
              <SelectTrigger id="editActivityAssignee" className="h-9 text-xs bg-white">
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-slate-500">
                  Unassigned
                </SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label
            htmlFor="editActivityDueDate"
            className="text-xs font-semibold text-slate-700"
          >
            Due Date
          </Label>
          <Input
            id="editActivityDueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={loading}
            className="h-9 text-xs bg-white"
          />
        </div>
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

export function EditActivityDialog({
  open,
  onOpenChange,
  activity,
  members = [],
  onSuccess,
}: EditActivityDialogProps) {
  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900">
            Edit Activity
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update details for this activity record.
          </DialogDescription>
        </DialogHeader>

        <EditActivityFormContent
          activity={activity}
          members={members}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
