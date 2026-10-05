"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createDealAction,
  updateDealAction,
} from "@/lib/actions/deal.actions";
import { type DealWithRelations, type DealStatus } from "@/lib/types/deals";
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
  Briefcase,
  DollarSign,
  Building,
  Contact,
  UserPlus,
  SlidersHorizontal,
  ArrowLeft,
  Percent,
} from "lucide-react";
import {
  EntityCombobox,
  type ComboboxOption,
} from "@/components/common/entity-combobox";

export interface PipelineStageItem {
  id: string;
  name: string;
  displayOrder: number;
}

export interface PipelineItem {
  id: string;
  name: string;
  isDefault?: boolean;
  stages: PipelineStageItem[];
}

interface DealFormProps {
  mode: "create" | "edit";
  initialData?: DealWithRelations | null;
  pipelines: PipelineItem[];
  customFieldDefinitions: CustomFieldDefinition[];
  members: Array<{ id: string; name: string; email: string }>;
  initialLeads?: Array<{ id: string; name: string }>;
  initialContacts?: Array<{ id: string; name: string }>;
  initialCompanies?: Array<{ id: string; name: string }>;
}

export function DealForm({
  mode,
  initialData,
  pipelines,
  customFieldDefinitions,
  members,
  initialLeads = [],
  initialContacts = [],
  initialCompanies = [],
}: DealFormProps) {
  const router = useRouter();

  // Basic Info
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");

  // Pipeline & Stage
  const defaultPipeline =
    pipelines.find((p) => p.isDefault) || pipelines[0] || null;
  const [pipelineId, setPipelineId] = useState<string>(
    initialData?.pipelineId || defaultPipeline?.id || ""
  );

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId),
    [pipelines, pipelineId]
  );

  const availableStages = useMemo(
    () => (selectedPipeline ? selectedPipeline.stages : []),
    [selectedPipeline]
  );

  const [pipelineStageId, setPipelineStageId] = useState<string>(() => {
    if (initialData?.pipelineStageId) return initialData.pipelineStageId;
    return availableStages[0]?.id || "";
  });

  const handlePipelineChange = (newPipelineId: string) => {
    setPipelineId(newPipelineId);
    const pipe = pipelines.find((p) => p.id === newPipelineId);
    if (pipe && pipe.stages.length > 0) {
      setPipelineStageId(pipe.stages[0].id);
    } else {
      setPipelineStageId("");
    }
  };

  // Commercial Info
  const [value, setValue] = useState<string>(
    initialData?.value !== null && initialData?.value !== undefined
      ? String(initialData.value)
      : ""
  );
  const [currency, setCurrency] = useState<string>(
    initialData?.currency || "USD"
  );
  const [probability, setProbability] = useState<string>(
    initialData?.probability !== null && initialData?.probability !== undefined
      ? String(initialData.probability)
      : ""
  );
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>(() => {
    if (!initialData?.expectedCloseDate) return "";
    const d = new Date(initialData.expectedCloseDate);
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  });

  // Status
  const [status, setStatus] = useState<DealStatus>(
    initialData?.status || "open"
  );

  // Ownership
  const [ownerUserId, setOwnerUserId] = useState<string>(
    initialData?.ownerUserId || "unassigned"
  );

  // Relationships
  const [leadId, setLeadId] = useState<string | null>(
    initialData?.leadId || null
  );
  const [contactId, setContactId] = useState<string | null>(
    initialData?.contactId || null
  );
  const [companyId, setCompanyId] = useState<string | null>(
    initialData?.companyId || null
  );

  // Custom Fields
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, unknown>
  >(initialData?.customFields || {});

  // Form State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options for Lead, Contact, Company comboboxes
  const initialLeadOptions: ComboboxOption[] = [
    ...(initialData?.lead
      ? [
          {
            id: initialData.lead.id,
            name: `${initialData.lead.firstName} ${initialData.lead.lastName || ""}`.trim(),
            subtext: initialData.lead.email || undefined,
          },
        ]
      : []),
    ...initialLeads
      .filter((l) => l.id !== initialData?.leadId)
      .map((l) => ({ id: l.id, name: l.name })),
  ];

  const fetchLeadOptions = async (query: string): Promise<ComboboxOption[]> => {
    try {
      const res = await fetch(
        `/api/v1/leads?search=${encodeURIComponent(query)}&pageSize=20&archived=false`
      );
      const json = await res.json();
      if (json.success && json.data) {
        return json.data.map(
          (l: { id: string; firstName: string; lastName?: string; email?: string }) => ({
            id: l.id,
            name: `${l.firstName} ${l.lastName || ""}`.trim(),
            subtext: l.email || undefined,
          })
        );
      }
      return [];
    } catch {
      return [];
    }
  };

  const initialContactOptions: ComboboxOption[] = [
    ...(initialData?.contact
      ? [
          {
            id: initialData.contact.id,
            name: `${initialData.contact.firstName} ${initialData.contact.lastName || ""}`.trim(),
            subtext: initialData.contact.email || undefined,
          },
        ]
      : []),
    ...initialContacts
      .filter((c) => c.id !== initialData?.contactId)
      .map((c) => ({ id: c.id, name: c.name })),
  ];

  const fetchContactOptions = async (query: string): Promise<ComboboxOption[]> => {
    try {
      const res = await fetch(
        `/api/v1/contacts?search=${encodeURIComponent(query)}&pageSize=20&archived=false`
      );
      const json = await res.json();
      if (json.success && json.data) {
        return json.data.map(
          (c: { id: string; firstName: string; lastName?: string; email?: string }) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName || ""}`.trim(),
            subtext: c.email || undefined,
          })
        );
      }
      return [];
    } catch {
      return [];
    }
  };

  const initialCompanyOptions: ComboboxOption[] = [
    ...(initialData?.company
      ? [{ id: initialData.company.id, name: initialData.company.name }]
      : []),
    ...initialCompanies
      .filter((c) => c.id !== initialData?.companyId)
      .map((c) => ({ id: c.id, name: c.name })),
  ];

  const fetchCompanyOptions = async (query: string): Promise<ComboboxOption[]> => {
    try {
      const res = await fetch(
        `/api/v1/companies?search=${encodeURIComponent(query)}&pageSize=20&archived=false`
      );
      const json = await res.json();
      if (json.success && json.data) {
        return json.data.map((c: { id: string; name: string; industry?: string }) => ({
          id: c.id,
          name: c.name,
          subtext: c.industry || undefined,
        }));
      }
      return [];
    } catch {
      return [];
    }
  };

  const handleCustomFieldChange = (key: string, val: unknown) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Deal name is required.");
      return;
    }

    if (!pipelineId) {
      setError("Pipeline is required.");
      return;
    }

    if (!pipelineStageId) {
      setError("Pipeline stage is required.");
      return;
    }

    // Check required custom fields
    for (const field of customFieldDefinitions) {
      if (field.required) {
        const val = customFieldValues[field.key];
        if (val === undefined || val === null || val === "") {
          setError(`Custom field "${field.label}" is required.`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        pipelineId,
        pipelineStageId,
        value: value.trim() ? Number(value.trim()) : null,
        currency: currency.trim() || "USD",
        probability: probability.trim() ? Number(probability.trim()) : null,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        status,
        ownerUserId: ownerUserId !== "unassigned" ? ownerUserId : null,
        leadId: leadId || null,
        contactId: contactId || null,
        companyId: companyId || null,
        customFields: customFieldValues,
      };

      if (mode === "create") {
        const res = await createDealAction(payload);
        if (!res.success) {
          setError(res.error || "Failed to create deal.");
          setLoading(false);
          return;
        }
        router.push(`/deals/${res.data.id}`);
      } else {
        if (!initialData) return;
        const res = await updateDealAction(initialData.id, payload);
        if (!res.success) {
          setError(res.error || "Failed to update deal.");
          setLoading(false);
          return;
        }
        router.push(`/deals/${initialData.id}`);
      }
    } catch {
      setError("An unexpected error occurred while saving the deal.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href={mode === "edit" && initialData ? `/deals/${initialData.id}` : "/deals"}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {mode === "create" ? "Create New Deal" : `Edit Deal: ${initialData?.name}`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === "create"
                ? "Add a new commercial opportunity to your sales pipeline."
                : "Update deal details, stage, status, or related entities."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(
                mode === "edit" && initialData ? `/deals/${initialData.id}` : "/deals"
              )
            }
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-24 gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "create" ? "Create Deal" : "Save Changes"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-semibold">Unable to save deal</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Briefcase className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Deal Information</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal_name" className="text-xs font-semibold text-slate-700">
              Deal Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="deal_name"
              placeholder="e.g. Enterprise License Expansion - Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="text-xs h-9 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal_desc" className="text-xs font-semibold text-slate-700">
              Description / Overview
            </Label>
            <textarea
              id="deal_desc"
              rows={3}
              placeholder="Add key notes, scope of discussion, or strategic context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Pipeline & Stage */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-900">Pipeline & Stage</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pipeline_select" className="text-xs font-semibold text-slate-700">
              Pipeline <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={pipelineId}
              onValueChange={(val) => {
                if (val) handlePipelineChange(val);
              }}
            >
              <SelectTrigger id="pipeline_select" className="text-xs h-9 bg-white">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} {p.isDefault && "(Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stage_select" className="text-xs font-semibold text-slate-700">
              Pipeline Stage <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={pipelineStageId}
              onValueChange={(val) => {
                if (val) setPipelineStageId(val);
              }}
              disabled={availableStages.length === 0}
            >
              <SelectTrigger id="stage_select" className="text-xs h-9 bg-white">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {availableStages.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section 3: Commercial & Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">Commercial & Status</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal_value" className="text-xs font-semibold text-slate-700">
              Deal Value
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-medium">
                {currency}
              </span>
              <Input
                id="deal_value"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-xs h-9 pl-12 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal_currency" className="text-xs font-semibold text-slate-700">
              Currency
            </Label>
            <Select
              value={currency}
              onValueChange={(val) => {
                if (val) setCurrency(val);
              }}
            >
              <SelectTrigger id="deal_currency" className="text-xs h-9 bg-white">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD" className="text-xs">USD ($)</SelectItem>
                <SelectItem value="EUR" className="text-xs">EUR (€)</SelectItem>
                <SelectItem value="GBP" className="text-xs">GBP (£)</SelectItem>
                <SelectItem value="CAD" className="text-xs">CAD (C$)</SelectItem>
                <SelectItem value="AUD" className="text-xs">AUD (A$)</SelectItem>
                <SelectItem value="INR" className="text-xs">INR (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal_prob" className="text-xs font-semibold text-slate-700">
              Probability (%)
            </Label>
            <div className="relative">
              <Input
                id="deal_prob"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0 - 100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                className="text-xs h-9 pr-7 bg-white"
              />
              <Percent className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal_status" className="text-xs font-semibold text-slate-700">
              Deal Status <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={status}
              onValueChange={(val) => {
                if (val) setStatus(val as DealStatus);
              }}
            >
              <SelectTrigger id="deal_status" className="text-xs h-9 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open" className="text-xs text-blue-700 font-medium">
                  Open
                </SelectItem>
                <SelectItem value="won" className="text-xs text-emerald-700 font-medium">
                  Won
                </SelectItem>
                <SelectItem value="lost" className="text-xs text-rose-700 font-medium">
                  Lost
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="deal_close_date" className="text-xs font-semibold text-slate-700">
              Expected Close Date
            </Label>
            <Input
              id="deal_close_date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              className="text-xs h-9 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="owner_select" className="text-xs font-semibold text-slate-700">
              Deal Owner
            </Label>
            <Select
              value={ownerUserId}
              onValueChange={(val) => {
                if (val) setOwnerUserId(val);
              }}
            >
              <SelectTrigger id="owner_select" className="text-xs h-9 bg-white">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned" className="text-xs text-slate-500">
                  Unassigned
                </SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section 4: Associated Relationships */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Building className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-900">Associated Records</h2>
        </div>
        <p className="text-xs text-slate-500">
          Optionally associate this deal with a company, primary contact, or lead source.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-slate-400" />
              Company
            </Label>
            <EntityCombobox
              value={companyId}
              onChange={(val) => setCompanyId(val)}
              placeholder="Select company..."
              searchPlaceholder="Search companies..."
              initialOptions={initialCompanyOptions}
              fetchOptions={fetchCompanyOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Contact className="h-3.5 w-3.5 text-slate-400" />
              Contact
            </Label>
            <EntityCombobox
              value={contactId}
              onChange={(val) => setContactId(val)}
              placeholder="Select contact..."
              searchPlaceholder="Search contacts..."
              initialOptions={initialContactOptions}
              fetchOptions={fetchContactOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-slate-400" />
              Source Lead
            </Label>
            <EntityCombobox
              value={leadId}
              onChange={(val) => setLeadId(val)}
              placeholder="Select lead..."
              searchPlaceholder="Search leads..."
              initialOptions={initialLeadOptions}
              fetchOptions={fetchLeadOptions}
            />
          </div>
        </div>
      </div>

      {/* Section 5: Custom Fields */}
      {customFieldDefinitions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <SlidersHorizontal className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-slate-900">Custom Fields</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customFieldDefinitions.map((field) => (
              <CustomFieldRenderer
                key={field.id}
                field={field}
                value={customFieldValues[field.key]}
                onChange={(val) => handleCustomFieldChange(field.key, val)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(
              mode === "edit" && initialData ? `/deals/${initialData.id}` : "/deals"
            )
          }
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-28 gap-1.5"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {mode === "create" ? "Create Deal" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
