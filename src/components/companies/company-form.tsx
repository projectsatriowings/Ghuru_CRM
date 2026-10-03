"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCompanyAction,
  updateCompanyAction,
} from "@/lib/actions/company.actions";
import { type CompanyWithRelations } from "@/lib/types/companies";
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
  Building,
  SlidersHorizontal,
  FileText,
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Tag,
  Users,
  UserCheck,
} from "lucide-react";

interface CompanyFormProps {
  mode: "create" | "edit";
  initialData?: CompanyWithRelations | null;
  customFieldDefinitions: CustomFieldDefinition[];
  members: Array<{ id: string; name: string; email: string }>;
}

export function CompanyForm({
  mode,
  initialData,
  customFieldDefinitions,
  members,
}: CompanyFormProps) {
  const router = useRouter();

  // Standard Fields
  const [name, setName] = useState(initialData?.name || "");
  const [website, setWebsite] = useState(initialData?.website || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [industry, setIndustry] = useState(initialData?.industry || "");
  const [companySize, setCompanySize] = useState(
    initialData?.companySize || ""
  );
  const [ownerUserId, setOwnerUserId] = useState<string>(
    initialData?.ownerUserId || "unassigned"
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

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

    // Client-side quick check on name
    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }

    setLoading(true);

    const payload = {
      name: name.trim(),
      website: website.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      industry: industry.trim() || null,
      companySize: companySize.trim() || null,
      ownerUserId: ownerUserId === "unassigned" ? null : ownerUserId,
      notes: notes.trim() || null,
      customFields,
    };

    try {
      if (mode === "create") {
        const res = await createCompanyAction(payload);
        if (!res.success) {
          setError(res.error || "Failed to create company.");
          setLoading(false);
          return;
        }
        router.push(`/companies/${res.data.id}`);
      } else {
        if (!initialData?.id) return;
        const res = await updateCompanyAction(initialData.id, payload);
        if (!res.success) {
          setError(res.error || "Failed to update company.");
          setLoading(false);
          return;
        }
        router.push(`/companies/${initialData.id}`);
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
            href={
              mode === "edit" && initialData?.id
                ? `/companies/${initialData.id}`
                : "/companies"
            }
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === "create"
                ? "Create Company"
                : `Edit Company: ${initialData?.name}`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === "create"
                ? "Add a new company/organization account to your CRM"
                : "Update company details, industry, ownership, and custom fields"}
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
                  ? `/companies/${initialData.id}`
                  : "/companies"
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
            {mode === "create" ? "Create Company" : "Save Changes"}
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

      {/* Section 1: Company Information */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Building className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Company Information
            </h2>
            <p className="text-[11px] text-slate-400">
              Primary details and corporate contact information
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="name"
                className="text-xs font-semibold text-slate-700"
              >
                Company Name <span className="text-red-500 font-bold">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="website"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Globe className="h-3 w-3 text-slate-400" />
                Website URL
              </Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Mail className="h-3 w-3 text-slate-400" />
                Corporate Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="phone"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Phone className="h-3 w-3 text-slate-400" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="industry"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Tag className="h-3 w-3 text-slate-400" />
                Industry
              </Label>
              <Input
                id="industry"
                placeholder="e.g. Software, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="companySize"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Users className="h-3 w-3 text-slate-400" />
                Company Size
              </Label>
              <Input
                id="companySize"
                placeholder="e.g. 50-200, 1000+"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          {/* Ownership */}
          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="owner"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <UserCheck className="h-3 w-3 text-slate-400" />
                  Account Owner
                </Label>
                <Select
                  value={ownerUserId}
                  onValueChange={(val) => setOwnerUserId(val || "unassigned")}
                >
                  <SelectTrigger
                    id="owner"
                    className="h-9 text-xs border-slate-200 bg-white"
                  >
                    <SelectValue placeholder="Select account owner" />
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

          {/* Notes */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <Label
              htmlFor="notes"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            >
              <FileText className="h-3 w-3 text-slate-400" />
              Notes & Description
            </Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Add overview, background, or account intelligence..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Custom Fields (if configured) */}
      {customFieldDefinitions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Custom Fields
              </h2>
              <p className="text-[11px] text-slate-400">
                Organization-specific custom properties for companies
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {customFieldDefinitions.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <CustomFieldRenderer
                    field={field}
                    value={customFields[field.key]}
                    onChange={(val) => handleCustomFieldChange(field.key, val)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
