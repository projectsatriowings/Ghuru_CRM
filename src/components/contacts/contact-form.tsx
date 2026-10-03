"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createContactAction,
  updateContactAction,
} from "@/lib/actions/contact.actions";
import { type ContactWithRelations } from "@/lib/types/contacts";
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
  ArrowLeft,
  Mail,
  Phone,
  UserCheck,
} from "lucide-react";

interface ContactFormProps {
  mode: "create" | "edit";
  initialData?: ContactWithRelations | null;
  customFieldDefinitions: CustomFieldDefinition[];
  members: Array<{ id: string; name: string; email: string }>;
}

export function ContactForm({
  mode,
  initialData,
  customFieldDefinitions,
  members,
}: ContactFormProps) {
  const router = useRouter();

  // Standard Fields
  const [firstName, setFirstName] = useState(initialData?.firstName || "");
  const [lastName, setLastName] = useState(initialData?.lastName || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
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
      ownerUserId: ownerUserId === "unassigned" ? null : ownerUserId,
      notes: notes.trim() || null,
      customFields,
    };

    try {
      if (mode === "create") {
        const res = await createContactAction(payload);
        if (!res.success) {
          setError(res.error || "Failed to create contact.");
          setLoading(false);
          return;
        }
        router.push(`/contacts/${res.data.id}`);
      } else {
        if (!initialData?.id) return;
        const res = await updateContactAction(initialData.id, payload);
        if (!res.success) {
          setError(res.error || "Failed to update contact.");
          setLoading(false);
          return;
        }
        router.push(`/contacts/${initialData.id}`);
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
                ? `/contacts/${initialData.id}`
                : "/contacts"
            }
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === "create"
                ? "Create Contact"
                : `Edit Contact: ${initialData?.firstName} ${
                    initialData?.lastName || ""
                  }`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === "create"
                ? "Add a new contact to your organization"
                : "Update contact information, owner assignment, and custom fields"}
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
                  ? `/contacts/${initialData.id}`
                  : "/contacts"
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
            {mode === "create" ? "Create Contact" : "Save Changes"}
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

      {/* Section 1: Contact Information */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <User className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Contact Information
            </h2>
            <p className="text-[11px] text-slate-400">
              Personal and contact details
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="firstName"
                className="text-xs font-semibold text-slate-700"
              >
                First Name <span className="text-red-500 font-bold">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="e.g. Rahul"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="lastName"
                className="text-xs font-semibold text-slate-700"
              >
                Last Name
              </Label>
              <Input
                id="lastName"
                placeholder="e.g. Sharma"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Mail className="h-3 w-3 text-slate-400" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="rahul@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
              />
            </div>

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="owner"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <UserCheck className="h-3 w-3 text-slate-400" />
                Owner
              </Label>
              <Select
                value={ownerUserId}
                onValueChange={(val) => setOwnerUserId(val || "unassigned")}
              >
                <SelectTrigger
                  id="owner"
                  className="h-9 text-xs border-slate-200 bg-white"
                >
                  <SelectValue placeholder="Select contact owner" />
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
              htmlFor="notes"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            >
              <FileText className="h-3 w-3 text-slate-400" />
              Notes
            </Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Add any additional context or background about this contact..."
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
                Organization-specific custom properties for contacts
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
