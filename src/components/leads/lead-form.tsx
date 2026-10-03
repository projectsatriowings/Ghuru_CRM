"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createLeadAction,
  updateLeadAction,
} from "@/lib/actions/lead.actions";
import {
  type LeadWithRelations,
  type LeadSource,
  type LeadStatus,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from "@/lib/types/leads";
import { type PipelineWithStages } from "@/lib/types/pipelines";
import { type CustomFieldDefinition } from "@/lib/types/custom-fields";
import { CustomFieldRenderer } from "@/components/custom-fields/custom-field-renderer";
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
import {
  Loader2,
  AlertCircle,
  User,
  SlidersHorizontal,
  FileText,
  Briefcase,
  GitBranch,
  ArrowLeft,
} from "lucide-react";

interface LeadFormProps {
  mode: "create" | "edit";
  initialData?: LeadWithRelations | null;
  pipelines?: PipelineWithStages[];
  customFieldDefinitions: CustomFieldDefinition[];
  members: Array<{ id: string; name: string; email: string }>;
}

export function LeadForm({
  mode,
  initialData,
  pipelines = [],
  customFieldDefinitions,
  members,
}: LeadFormProps) {
  const router = useRouter();

  // Standard Fields
  const [firstName, setFirstName] = useState(initialData?.firstName || "");
  const [lastName, setLastName] = useState(initialData?.lastName || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [source, setSource] = useState<LeadSource>(
    initialData?.source || "other"
  );
  const [status, setStatus] = useState<LeadStatus>(
    initialData?.status || "new"
  );
  const [assignedToUserId, setAssignedToUserId] = useState<string>(
    initialData?.assignedToUserId || "unassigned"
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Pipeline & Stage Fields
  const [pipelineId, setPipelineId] = useState<string>(
    initialData?.pipelineId || "none"
  );
  const [stageId, setStageId] = useState<string>(
    initialData?.stageId || "none"
  );

  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const availableStages = selectedPipeline?.stages
    ? [...selectedPipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  const handlePipelineChange = (newPipelineId: string | null) => {
    const val = newPipelineId || "none";
    setPipelineId(val);
    if (val === "none") {
      setStageId("none");
    } else {
      const selected = pipelines.find((p) => p.id === val);
      const isStageValid = selected?.stages?.some((s) => s.id === stageId);
      if (!isStageValid) {
        setStageId("none");
      }
    }
  };

  // Custom Fields Map (fieldKey -> value)
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(() => {
    if (initialData?.customFields) {
      return { ...initialData.customFields };
    }
    const initialMap: Record<string, unknown> = {};
    for (const def of customFieldDefinitions) {
      if (def.fieldType === "boolean") {
        initialMap[def.key] = false;
      } else if (def.fieldType === "multiselect") {
        initialMap[def.key] = [];
      } else {
        initialMap[def.key] = null;
      }
    }
    return initialMap;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCustomFieldChange = (key: string, value: unknown) => {
    setCustomFields((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);

    // Client-side quick check on first name
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    setLoading(true);

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      source,
      status,
      assignedToUserId:
        assignedToUserId === "unassigned" ? null : assignedToUserId,
      pipelineId: pipelineId && pipelineId !== "none" ? pipelineId : null,
      stageId:
        pipelineId && pipelineId !== "none" && stageId && stageId !== "none"
          ? stageId
          : null,
      notes: notes.trim() || null,
      customFields,
    };

    try {
      if (mode === "create") {
        const res = await createLeadAction(payload);
        if (!res.success) {
          setError(res.error || "Failed to create lead.");
          setLoading(false);
          return;
        }
        router.push(`/leads/${res.data.id}`);
      } else {
        if (!initialData?.id) return;
        const res = await updateLeadAction(initialData.id, payload);
        if (!res.success) {
          setError(res.error || "Failed to update lead.");
          setLoading(false);
          return;
        }
        router.push(`/leads/${initialData.id}`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl pb-16">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href={mode === "edit" && initialData?.id ? `/leads/${initialData.id}` : "/leads"}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === "create" ? "Create Lead" : `Edit Lead: ${initialData?.firstName} ${initialData?.lastName || ""}`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === "create"
                ? "Add a new prospective customer and capture their initial details"
                : "Update prospect contact details, status, ownership, and custom fields"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(
                mode === "edit" && initialData?.id
                  ? `/leads/${initialData.id}`
                  : "/leads"
              )
            }
            disabled={loading}
            className="h-9 px-4 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="h-9 px-5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {mode === "create" ? "Create Lead" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Standard / Basic Information */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <User className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Basic Information
            </h2>
            <p className="text-[11px] text-slate-400">
              Primary contact information for the prospect
            </p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-xs font-semibold text-slate-700">
              First name <span className="text-red-500 font-bold">*</span>
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
              placeholder="e.g. Rahul"
              required
              className="h-9 text-xs bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastName" className="text-xs font-semibold text-slate-700">
              Last name
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={loading}
              placeholder="e.g. Kumar"
              className="h-9 text-xs bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="e.g. rahul@example.com"
              className="h-9 text-xs bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
              Phone number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              placeholder="e.g. +91 98765 43210"
              className="h-9 text-xs bg-white"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Lead Details */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Briefcase className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Lead Details
            </h2>
            <p className="text-[11px] text-slate-400">
              Status, source attribution, and team assignment
            </p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="source" className="text-xs font-semibold text-slate-700">
              Lead source
            </Label>
            <Select
              value={source}
              onValueChange={(val) => {
                if (val) setSource(val as LeadSource);
              }}
              disabled={loading}
            >
              <SelectTrigger id="source" className="h-9 text-xs bg-white">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((src) => (
                  <SelectItem key={src} value={src} className="text-xs">
                    {LEAD_SOURCE_LABELS[src]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-700">
              Lead status
            </Label>
            <Select
              value={status}
              onValueChange={(val) => {
                if (val) setStatus(val as LeadStatus);
              }}
              disabled={loading}
            >
              <SelectTrigger id="status" className="h-9 text-xs bg-white">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((st) => (
                  <SelectItem key={st} value={st} className="text-xs">
                    {LEAD_STATUS_LABELS[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assignedTo" className="text-xs font-semibold text-slate-700">
              Assigned to
            </Label>
            <Select
              value={assignedToUserId}
              onValueChange={(val) => {
                if (val) setAssignedToUserId(val);
              }}
              disabled={loading}
            >
              <SelectTrigger id="assignedTo" className="h-9 text-xs bg-white">
                <SelectValue placeholder="Assign to member" />
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
      </div>

      {/* Section: Pipeline & Stage */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <GitBranch className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pipeline & Stage
            </h2>
            <p className="text-[11px] text-slate-400">
              Assign to a pipeline and track stage progression (optional)
            </p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pipeline" className="text-xs font-semibold text-slate-700">
              Pipeline
            </Label>
            <Select
              value={pipelineId}
              onValueChange={handlePipelineChange}
              disabled={loading}
            >
              <SelectTrigger id="pipeline" className="h-9 text-xs bg-white">
                <SelectValue placeholder="Select pipeline (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-slate-500">
                  None (No pipeline)
                </SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} {p.isDefault ? "(Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stage" className="text-xs font-semibold text-slate-700">
              Stage
            </Label>
            <Select
              value={stageId}
              onValueChange={(val) => {
                if (val) setStageId(val);
              }}
              disabled={loading || pipelineId === "none" || availableStages.length === 0}
            >
              <SelectTrigger id="stage" className="h-9 text-xs bg-white">
                <SelectValue
                  placeholder={
                    pipelineId === "none"
                      ? "Select a pipeline first"
                      : availableStages.length === 0
                      ? "No stages in this pipeline"
                      : "Select stage (optional)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-slate-500">
                  None (No stage)
                </SelectItem>
                {availableStages.map((st) => (
                  <SelectItem key={st.id} value={st.id} className="text-xs">
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section 3: Notes */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Notes
            </h2>
            <p className="text-[11px] text-slate-400">
              General context, background, or customer requirements
            </p>
          </div>
        </div>

        <div className="p-6">
          <textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            placeholder="Write general notes or observations about this lead..."
            className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Section 4: Additional Information (Custom Fields) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Additional Information
              </h2>
              <p className="text-[11px] text-slate-400">
                Organization-configured custom fields for leads
              </p>
            </div>
          </div>

          <Link
            href="/settings/custom-fields"
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Manage fields →
          </Link>
        </div>

        <div className="p-6">
          {customFieldDefinitions.length === 0 ? (
            <div className="p-6 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                No custom fields configured for Leads
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Customize your lead profile with fields like Course Interested, Budget, Location, or Qualification in Settings.
              </p>
              <Link
                href="/settings/custom-fields"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Configure Custom Fields
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customFieldDefinitions.map((field) => (
                <div
                  key={field.id}
                  className={
                    field.fieldType === "textarea" ? "sm:col-span-2" : ""
                  }
                >
                  <CustomFieldRenderer
                    field={field}
                    value={customFields[field.key]}
                    onChange={(val) => handleCustomFieldChange(field.key, val)}
                    disabled={loading}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Submit Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              mode === "edit" && initialData?.id
                ? `/leads/${initialData.id}`
                : "/leads"
            )
          }
          disabled={loading}
          className="h-9 px-4 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="h-9 px-5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
        >
          {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {mode === "create" ? "Create Lead" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
