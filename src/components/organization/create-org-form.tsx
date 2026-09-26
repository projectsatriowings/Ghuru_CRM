"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationAction } from "@/lib/actions/organization.actions";
import { createOrganizationSchema } from "@/lib/validations/organization";
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
import { Loader2, Building2 } from "lucide-react";

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

      // Successfully created organization, redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-md border-border">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl">
            <Building2 className="h-6 w-6" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Create Your Organization
        </CardTitle>
        <CardDescription>
          Set up a workspace for your company or team. You will automatically become the Organization Admin.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              placeholder="e.g. Acme Corp or Digital Enterprise"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="slug">Organization Slug (URL identifier)</Label>
              <span className="text-xs text-muted-foreground">Unique identifier</span>
            </div>
            <Input
              id="slug"
              placeholder="e.g. acme-corp"
              value={slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setSlug(e.target.value.toLowerCase());
              }}
              disabled={loading}
              required
            />
            <p className="text-xs text-muted-foreground">
              Only lowercase letters, numbers, and hyphens.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Organization & Go to Dashboard
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
