"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DealWithRelations, type DealStatus } from "@/lib/types/deals";
import { type PipelineWithStages } from "@/lib/types/pipelines";
import { type ActivityWithRelations } from "@/lib/types/activities";
import { type FollowUpWithRelations } from "@/lib/types/follow-ups";
import { type EntityHealthResult } from "@/lib/types/intelligence";
import { DealStatusBadge } from "./deal-status-badge";
import { ArchiveDealDialog } from "./archive-deal-dialog";
import { EntityHealthCard } from "@/components/intelligence/entity-health-card";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { FollowUpSection } from "@/components/follow-ups/follow-up-section";
import { CustomFieldValueDisplay } from "@/components/custom-fields/custom-field-renderer";
import { updateDealAction } from "@/lib/actions/deal.actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Edit2,
  Archive,
  RotateCcw,
  User,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Percent,
  SlidersHorizontal,
  ExternalLink,
  GitBranch,
  Loader2,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";

interface DealDetailViewProps {
  deal: DealWithRelations;
  health?: EntityHealthResult | null;
  pipelines?: PipelineWithStages[];
  activities?: ActivityWithRelations[];
  followUps?: FollowUpWithRelations[];
  members?: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
  canUpdate: boolean;
  canDelete: boolean;
  canViewActivities?: boolean;
  canCreateActivity?: boolean;
  canUpdateActivity?: boolean;
  canDeleteActivity?: boolean;
  canViewFollowUps?: boolean;
  canCreateFollowUp?: boolean;
  canUpdateFollowUp?: boolean;
  canDeleteFollowUp?: boolean;
}

export function DealDetailView({
  deal,
  health = null,
  pipelines = [],
  activities = [],
  followUps = [],
  members = [],
  currentUserId,
  canUpdate,
  canDelete,
  canViewActivities = true,
  canCreateActivity = true,
  canUpdateActivity = true,
  canDeleteActivity = true,
  canViewFollowUps = true,
  canCreateFollowUp = true,
  canUpdateFollowUp = true,
  canDeleteFollowUp = true,
}: DealDetailViewProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">("archive");
  const [updatingStage, setUpdatingStage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);

  const isArchived = Boolean(deal.archivedAt);

  // Active pipeline stages
  const currentPipeline = deal.pipelineId
    ? pipelines.find((p) => p.id === deal.pipelineId)
    : null;

  const stages = currentPipeline?.stages
    ? [...currentPipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  const handleStageChange = async (newStageId: string | null) => {
    if (!newStageId || newStageId === deal.pipelineStageId || updatingStage) return;

    setUpdatingStage(true);
    setStageMessage(null);
    setStageError(null);

    try {
      const res = await updateDealAction(deal.id, {
        pipelineStageId: newStageId,
      });

      if (!res.success) {
        setStageError(res.error || "Failed to update stage.");
      } else {
        setStageMessage("Stage updated");
        setTimeout(() => setStageMessage(null), 3000);
        router.refresh();
      }
    } catch {
      setStageError("An unexpected error occurred while updating stage.");
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleStatusChange = async (newStatus: DealStatus) => {
    if (newStatus === deal.status || updatingStatus) return;

    setUpdatingStatus(true);
    try {
      const res = await updateDealAction(deal.id, {
        status: newStatus,
      });

      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Failed to update status.");
      }
    } catch {
      alert("An unexpected error occurred while updating status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatCurrency = (val: string | number | null, curr: string | null) => {
    if (val === null || val === undefined) return "—";
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return "—";
    return `${curr || "USD"} ${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/deals"
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {deal.name}
              </h1>
              <DealStatusBadge status={deal.status} />
              {isArchived && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Archived
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deal ID: <span className="font-mono text-slate-600">{deal.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick status transitions for active deals */}
          {canUpdate && !isArchived && (
            <div className="flex items-center gap-1.5 mr-1">
              {deal.status !== "won" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updatingStatus}
                  onClick={() => handleStatusChange("won")}
                  className="h-8 px-2.5 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-lg gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Won</span>
                </Button>
              )}
              {deal.status !== "lost" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updatingStatus}
                  onClick={() => handleStatusChange("lost")}
                  className="h-8 px-2.5 text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 rounded-lg gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Mark Lost</span>
                </Button>
              )}
              {deal.status !== "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updatingStatus}
                  onClick={() => handleStatusChange("open")}
                  className="h-8 px-2.5 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50 rounded-lg gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reopen</span>
                </Button>
              )}
            </div>
          )}

          {canUpdate && (
            <Link href={`/deals/${deal.id}/edit`}>
              <Button
                variant="outline"
                className="h-9 px-3.5 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Deal
              </Button>
            </Link>
          )}

          {isArchived ? (
            <Button
              variant="outline"
              onClick={() => {
                setDialogMode("restore");
                setIsDialogOpen(true);
              }}
              className="h-9 px-3.5 text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Deal
            </Button>
          ) : (
            canDelete && (
              <Button
                variant="outline"
                onClick={() => {
                  setDialogMode("archive");
                  setIsDialogOpen(true);
                }}
                className="h-9 px-3.5 text-xs font-medium text-amber-700 border-amber-200 hover:bg-amber-50 rounded-lg gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive Deal
              </Button>
            )
          )}
        </div>
      </div>

      {/* Main Grid: Left Column (Next Action, Activities, Details) & Right Column (Overview, Pipeline, Relationships) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next Action & Follow-up Section */}
          {canViewFollowUps && (
            <FollowUpSection
              dealId={deal.id}
              followUps={followUps}
              canCreate={canCreateFollowUp}
              canUpdate={canUpdateFollowUp}
              canDelete={canDeleteFollowUp}
              members={members}
              currentUserId={currentUserId}
              onRefresh={() => router.refresh()}
            />
          )}

          {/* Activity Timeline */}
          {canViewActivities && (
            <ActivityTimeline
              entityType="deal"
              entityId={deal.id}
              activities={activities}
              followUps={followUps}
              members={members}
              currentUserId={currentUserId}
              canCreate={canCreateActivity}
              canUpdate={canUpdateActivity}
              canDelete={canDeleteActivity}
              onRefresh={() => router.refresh()}
            />
          )}

          {/* Commercial Information */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Commercial Information
              </h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Deal Value
                </span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                  {formatCurrency(deal.value, deal.currency)}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Win Probability
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Percent className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-800">
                    {deal.probability !== null && deal.probability !== undefined
                      ? `${deal.probability}%`
                      : "Not set"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Expected Close Date
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-800">
                    {deal.expectedCloseDate
                      ? new Date(deal.expectedCloseDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Not specified"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Pipeline & Stage
                </span>
                <span className="text-xs font-medium text-slate-800 mt-0.5 block">
                  {deal.pipeline?.name} → {deal.stage?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Description & Scope
              </h2>
            </div>
            <div className="p-5">
              {deal.description ? (
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {deal.description}
                </p>
              ) : (
                <span className="text-xs text-slate-400 italic">
                  No description provided for this deal.
                </span>
              )}
            </div>
          </div>

          {/* Additional Information (Custom Fields) */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-purple-600" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Custom Fields
                </h2>
              </div>
              <Link
                href="/settings/custom-fields"
                className="text-[11px] font-medium text-blue-600 hover:underline"
              >
                Configure fields
              </Link>
            </div>
            <div className="p-5">
              {!deal.customFieldValues || deal.customFieldValues.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-400">
                    No custom fields configured for Deals in this organization.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {deal.customFieldValues.map((entry) => (
                    <div
                      key={entry.field.id}
                      className={
                        entry.field.fieldType === "textarea" ? "sm:col-span-2" : ""
                      }
                    >
                      <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1">
                        {entry.field.label}
                      </span>
                      <CustomFieldValueDisplay
                        field={entry.field}
                        value={entry.value}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar Summary) */}
        <div className="space-y-6">
          {health && (
            <EntityHealthCard health={health} />
          )}

          {/* Pipeline & Stage Quick Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pipeline & Stage
                </h3>
              </div>
              {canUpdate && (
                <Link
                  href={`/deals/${deal.id}/edit`}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Edit</span>
                </Link>
              )}
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1">
                Pipeline
              </span>
              <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {deal.pipeline?.name || "Unassigned"}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
                Current Stage
              </span>
              {canUpdate && stages.length > 0 && !isArchived ? (
                <div className="space-y-1.5">
                  <Select
                    value={deal.pipelineStageId}
                    onValueChange={handleStageChange}
                    disabled={updatingStage}
                  >
                    <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id} className="text-xs">
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {updatingStage && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      <span>Updating stage...</span>
                    </div>
                  )}
                  {stageMessage && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 pt-1 font-medium">
                      <Check className="h-3 w-3" />
                      <span>{stageMessage}</span>
                    </div>
                  )}
                  {stageError && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 pt-1 font-medium">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{stageError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {deal.stage?.name || "Unassigned"}
                </div>
              )}
            </div>
          </div>

          {/* Relationships Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Associated Entities</span>
              {canUpdate && (
                <Link
                  href={`/deals/${deal.id}/edit`}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 normal-case"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Change</span>
                </Link>
              )}
            </h3>

            {/* Lead */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Lead
              </span>
              {deal.lead ? (
                <Link
                  href={`/leads/${deal.lead.id}`}
                  className="group flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-200/70 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-900 group-hover:text-blue-600 truncate">
                      {deal.lead.firstName} {deal.lead.lastName || ""}
                    </span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                </Link>
              ) : (
                <span className="text-xs text-slate-400 italic">None linked</span>
              )}
            </div>

            {/* Contact */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Contact
              </span>
              {deal.contact ? (
                <Link
                  href={`/contacts/${deal.contact.id}`}
                  className="group flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-purple-50/50 border border-slate-200/70 hover:border-purple-200 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <User className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-900 group-hover:text-purple-600 truncate">
                      {deal.contact.firstName} {deal.contact.lastName || ""}
                    </span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-purple-600 shrink-0" />
                </Link>
              ) : (
                <span className="text-xs text-slate-400 italic">None linked</span>
              )}
            </div>

            {/* Company */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Company
              </span>
              {deal.company ? (
                <Link
                  href={`/companies/${deal.company.id}`}
                  className="group flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/70 hover:border-indigo-200 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-900 group-hover:text-indigo-600 truncate">
                      {deal.company.name}
                    </span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                </Link>
              ) : (
                <span className="text-xs text-slate-400 italic">None linked</span>
              )}
            </div>
          </div>

          {/* Deal Overview Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100">
              Deal Overview
            </h3>

            {/* Status */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
                Current Status
              </span>
              <DealStatusBadge status={deal.status} />
            </div>

            {/* Deal Owner */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
                Deal Owner
              </span>
              {deal.ownerUser ? (
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {deal.ownerUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {deal.ownerUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {deal.ownerUser.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-400 italic border border-dashed border-slate-200">
                  Unassigned
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Created
                </span>
                <span className="font-medium text-slate-700 font-mono text-[11px]">
                  {new Date(deal.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Updated
                </span>
                <span className="font-medium text-slate-700 font-mono text-[11px]">
                  {new Date(deal.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {isArchived && deal.archivedAt && (
                <div className="flex items-center justify-between text-xs pt-1 text-amber-700">
                  <span className="flex items-center gap-1.5">
                    <Archive className="h-3.5 w-3.5" /> Archived
                  </span>
                  <span className="font-medium font-mono text-[11px]">
                    {new Date(deal.archivedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Archive / Restore Dialog */}
      <ArchiveDealDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        deal={deal}
        mode={dialogMode}
        onSuccess={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
