"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganizationAction } from "@/lib/actions/organization.actions";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { formatZodError } from "@/lib/validations/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ShieldAlert } from "lucide-react";

interface OrgSettingsFormProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  };
  canUpdate: boolean;
}

export function OrgSettingsForm({
  organization,
  canUpdate,
}: OrgSettingsFormProps) {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<"general" | "branding" | "features">("general");
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canUpdate) return;

    setError(null);
    setSuccess(null);

    const validation = updateOrganizationSchema.safeParse({ name, slug });
    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await updateOrganizationAction({
        name: validation.data.name,
        slug: validation.data.slug,
      });

      if (!res.success) {
        setError(res.error || "Failed to update organization");
        setLoading(false);
        return;
      }

      setSuccess("Organization settings saved successfully!");
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Sub-tabs: General, Branding, Features */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("general")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === "general"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("branding")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSubTab === "branding"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>Branding</span>
          <span className="text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-medium">
            Future
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("features")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSubTab === "features"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span>Features</span>
          <span className="text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-medium">
            Future
          </span>
        </button>
      </div>

      {activeSubTab === "general" && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900">
              General Information
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update your workspace identity and unique public slug.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!canUpdate && (
              <div className="flex items-center gap-2.5 p-3.5 text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  You have read-only access. You need the &apos;organization.update&apos; permission to modify these settings.
                </span>
              </div>
            )}

            {error && (
              <div className="p-3.5 text-xs text-red-600 bg-red-50 rounded-xl border border-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3.5 text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                  Organization Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading || !canUpdate}
                  required
                  className="h-11 rounded-lg border-slate-200 bg-white px-3.5 text-sm placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-xs font-semibold text-slate-700">
                  Organization Slug <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  disabled={loading || !canUpdate}
                  required
                  className="h-11 rounded-lg border-slate-200 bg-white px-3.5 font-mono text-xs placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20"
                />
              </div>
            </div>

            {/* Technical Metadata section */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500">
              <div>
                <span className="font-medium text-slate-400 block">Internal Tenant ID</span>
                <span className="font-mono text-[11px] text-slate-700 mt-0.5 block break-all">
                  {organization.id}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-400 block">Created At</span>
                <span className="text-slate-700 mt-0.5 block">
                  {new Date(organization.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {canUpdate && (
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-600/30"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </div>
      )}

      {activeSubTab !== "general" && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center shadow-xs">
          <p className="text-sm font-semibold text-slate-800">
            {activeSubTab === "branding" ? "Custom Branding" : "Modular Feature Toggles"}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            This module architecture is reserved for future milestones (custom logos, colors, and CRM feature toggles).
          </p>
        </div>
      )}
    </div>
  );
}
