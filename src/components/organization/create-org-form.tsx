"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationAction } from "@/lib/actions/organization.actions";
import { createOrganizationSchema } from "@/lib/validations/organization";
import { formatZodError } from "@/lib/validations/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-generate clean slug from organization name
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;
    setName(newName);

    if (!slugManuallyEdited) {
      const generated = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugManuallyEdited(true);
    setSlug(
      e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // Prevent duplicate clicks

    setError(null);

    const validation = createOrganizationSchema.safeParse({ name, slug });
    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      // 15-second client-side timeout safeguard to prevent infinite loading state
      const timeoutPromise = new Promise<{ timeout: true }>((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timed out. Please try again.")),
          15000
        )
      );

      const actionPromise = createOrganizationAction({
        name: validation.data.name,
        slug: validation.data.slug,
      });

      const result = await Promise.race([actionPromise, timeoutPromise]);

      if ("timeout" in result) {
        throw new Error("Request timed out. Please try again.");
      }

      if (!result.success) {
        setError(result.error || "Workspace couldn't be created. Please try again.");
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Workspace couldn't be created. Please try again.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {/* Mobile-only compact logo */}
      <div className="lg:hidden mb-8">
        <Logo variant="light" size="md" />
      </div>

      {/* Heading & Subtitle */}
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl sm:text-[38px] font-bold tracking-tight text-slate-900 leading-tight">
          Create your workspace
        </h1>
        <p className="text-sm sm:text-base text-slate-500 leading-normal">
          Set up your organization to get started with Ghuru CRM.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 text-xs sm:text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Organization Name Field */}
        <div className="space-y-2">
          <Label
            htmlFor="orgName"
            className="text-xs sm:text-sm font-medium text-slate-800"
          >
            Organization name
          </Label>
          <Input
            id="orgName"
            placeholder="Digital Ghuru"
            value={name}
            onChange={handleNameChange}
            disabled={loading}
            required
            className="h-11 rounded-lg border-slate-200 bg-white px-3.5 text-sm placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600 shadow-2xs"
          />
        </div>

        {/* Workspace URL Field */}
        <div className="space-y-2">
          <Label
            htmlFor="orgSlug"
            className="text-xs sm:text-sm font-medium text-slate-800"
          >
            Workspace URL
          </Label>
          <div className="relative">
            <Input
              id="orgSlug"
              placeholder="digital-ghuru"
              value={slug}
              onChange={handleSlugChange}
              disabled={loading}
              required
              className="h-11 rounded-lg border-slate-200 bg-white px-3.5 font-mono text-sm placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600 shadow-2xs"
            />
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            This will be used as your unique workspace identifier.
          </p>
        </div>

        {/* Submit CTA Button */}
        <div className="pt-3">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating workspace...</span>
              </span>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
