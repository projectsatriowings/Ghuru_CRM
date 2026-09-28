"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationAction } from "@/lib/actions/organization.actions";
import { createOrganizationSchema } from "@/lib/validations/organization";
import { formatZodError } from "@/lib/validations/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManuallyEdited) {
      const generatedSlug = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = createOrganizationSchema.safeParse({ name, slug });
    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const result = await createOrganizationAction({
        name: validation.data.name,
        slug: validation.data.slug,
      });

      if (!result.success) {
        setError(result.error || "Failed to create organization");
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-10 max-w-4xl mx-auto flex flex-col md:flex-row gap-8 lg:gap-12">
      {/* Left Stepper Sidebar */}
      <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-8">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">
          Setup Progress
        </h3>
        <div className="space-y-6">
          {/* Step 1: Active */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-semibold text-xs shadow-sm ring-4 ring-blue-50">
              1
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">
                Organization Details
              </p>
              <p className="text-xs text-blue-600 font-medium mt-1">In progress</p>
            </div>
          </div>

          {/* Step 2: Next */}
          <div className="flex items-center gap-3.5 opacity-60">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-semibold text-xs">
              2
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 leading-none">
                Admin Details
              </p>
              <p className="text-xs text-slate-400 mt-1">Automatic</p>
            </div>
          </div>

          {/* Step 3: Complete */}
          <div className="flex items-center gap-3.5 opacity-60">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-semibold text-xs">
              3
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 leading-none">
                Complete
              </p>
              <p className="text-xs text-slate-400 mt-1">Ready to use</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex-1">
        <div className="space-y-1.5 mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Your Organization
          </h2>
          <p className="text-sm text-slate-500">
            Tell us about your organization. You can always change this later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 text-sm text-red-600 bg-red-50/80 rounded-xl border border-red-200 animate-in fade-in-50">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="orgName" className="text-xs font-semibold text-slate-700">
              Organization Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="orgName"
              placeholder="e.g. Digital Ghuru or Acme Corp"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={loading}
              required
              className="h-11 rounded-lg border-slate-200 bg-white px-3.5 text-sm placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="slug" className="text-xs font-semibold text-slate-700">
                Organization Slug <span className="text-red-500">*</span>
              </Label>
              <span className="text-[11px] text-slate-400">Unique URL key</span>
            </div>
            <Input
              id="slug"
              placeholder="e.g. digital-ghuru"
              value={slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setSlug(e.target.value.toLowerCase());
              }}
              disabled={loading}
              required
              className="h-11 rounded-lg border-slate-200 bg-white px-3.5 text-sm placeholder:text-slate-400 font-mono text-xs focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20"
            />
            <p className="text-xs text-slate-500 pt-0.5">
              This will be used in your URL (must be unique). Only lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className="pt-3">
            <Button
              type="submit"
              className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-600/30"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Next
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
