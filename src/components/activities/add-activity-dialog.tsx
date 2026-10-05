"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityAction } from "@/lib/actions/activity.actions";
import { createActivitySchema } from "@/lib/validations/activity";
import { formatZodError } from "@/lib/validations/helpers";
import {
  type ActivityType,
  type CrmEntityType,
  type ActivityStatus,
} from "@/db/schema/activities";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types/activities";
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
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { ActivityIcon } from "./activity-icon";

const CREATABLE_ACTIVITY_TYPES: ActivityType[] = [
  "call",
  "email",
  "meeting",
  "note",
  "task",
  "follow_up",
];

interface AddActivityDialogProps {
  entityType?: CrmEntityType;
  entityId?: string;
  leadId?: string;
  members?: Array<{ id: string; name: string; email: string }>;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddActivityDialog({
  entityType = "lead",
  entityId,
  leadId,
  members = [],
  trigger,
  onSuccess,
}: AddActivityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("call");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("completed");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("none");
  const [dueDate, setDueDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetEntityId = entityId || leadId || "";
  const targetEntityType = entityType || "lead";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = createActivitySchema.safeParse({
      entityType: targetEntityType,
      entityId: targetEntityId,
      type,
      title,
      description,
      status,
      assignedToUserId: assignedToUserId === "none" ? undefined : assignedToUserId,
      dueAt: dueDate ? new Date(dueDate) : undefined,
    });

    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await createActivityAction({
        ...validation.data,
        entityType: targetEntityType,
        entityId: targetEntityId,
      });

      if (!res.success) {
        setError(res.error || "Failed to log activity.");
        setLoading(false);
        return;
      }

      setOpen(false);
      setTitle("");
      setDescription("");
      setType("call");
      setStatus("completed");
      setAssignedToUserId("none");
      setDueDate("");
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

  const entityLabel =
    targetEntityType === "lead"
      ? "Lead"
      : targetEntityType === "contact"
      ? "Contact"
      : targetEntityType === "deal"
      ? "Deal"
      : "Company";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-8 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Activity</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900">
            Add Activity
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Log an interaction or record for this {entityLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

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
                htmlFor="activityType"
                className="text-xs font-semibold text-slate-700"
              >
                Activity Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={type}
                onValueChange={(val) => {
                  const newType = val as ActivityType;
                  setType(newType);
                  if (newType === "task" || newType === "follow_up") {
                    setStatus("pending");
                  }
                }}
                disabled={loading}
              >
                <SelectTrigger id="activityType" className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_ACTIVITY_TYPES.map((t) => (
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
                htmlFor="activityStatus"
                className="text-xs font-semibold text-slate-700"
              >
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as ActivityStatus)}
                disabled={loading}
              >
                <SelectTrigger id="activityStatus" className="h-9 text-xs bg-white">
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
              htmlFor="activityTitle"
              className="text-xs font-semibold text-slate-700"
            >
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="activityTitle"
              placeholder="e.g. Call regarding quotation review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              className="h-9 text-xs bg-white"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="activityDescription"
              className="text-xs font-semibold text-slate-700"
            >
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <textarea
              id="activityDescription"
              rows={3}
              placeholder="e.g. Reviewed requirements, requested follow-up next Tuesday."
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
                  htmlFor="activityAssignee"
                  className="text-xs font-semibold text-slate-700"
                >
                  Assigned To <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Select
                  value={assignedToUserId}
                  onValueChange={(val) => setAssignedToUserId(val ?? "")}
                  disabled={loading}
                >
                  <SelectTrigger id="activityAssignee" className="h-9 text-xs bg-white">
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
                htmlFor="activityDueDate"
                className="text-xs font-semibold text-slate-700"
              >
                Due Date <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="activityDueDate"
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
              Save Activity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
