"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganizationAction } from "@/lib/actions/organization.actions";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { formatZodError } from "@/lib/validations/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className="max-w-2xl border-border">
      <CardHeader>
        <CardTitle className="text-xl">Organization Details</CardTitle>
        <CardDescription>
          View and configure your organization profile and slug identifier.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {!canUpdate && (
            <div className="flex items-center gap-2 p-3 text-sm text-amber-700 bg-amber-50 rounded-md border border-amber-200">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>You have read-only access. You need the &apos;organization.update&apos; permission to modify these settings.</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="orgId">Organization ID</Label>
            <Input
              id="orgId"
              value={organization.id}
              disabled
              className="bg-muted font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Unique internal tenant identifier.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || !canUpdate}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Organization Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={loading || !canUpdate}
              required
            />
            <p className="text-xs text-muted-foreground">
              Used in vanity URLs and tenant identification. Must be unique across all tenants.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="createdAt">Created Date</Label>
            <Input
              id="createdAt"
              value={new Date(organization.createdAt).toLocaleString()}
              disabled
              className="bg-muted text-xs"
            />
          </div>
        </CardContent>

        {canUpdate && (
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
