"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  requireAuth,
  requirePermission,
} from "@/lib/context/organization-context";
import {
  createOrganization,
  updateOrganization,
  getUserOrganizations,
} from "@/lib/services/organization.service";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "@/lib/validations/organization";

export async function createOrganizationAction(input: CreateOrganizationInput) {
  const t0 = performance.now();
  console.log("[OrgCreate] request started");

  try {
    const tAuth0 = performance.now();
    const { user } = await requireAuth();
    const tAuth = (performance.now() - tAuth0).toFixed(1);

    const tVal0 = performance.now();
    const validated = createOrganizationSchema.parse(input);
    const tVal = (performance.now() - tVal0).toFixed(1);

    const tService0 = performance.now();
    const result = await createOrganization({
      name: validated.name,
      slug: validated.slug,
      userId: user.id,
    });
    const tService = (performance.now() - tService0).toFixed(1);

    const tCookie0 = performance.now();
    const cookieStore = await cookies();
    cookieStore.set("ghuru_active_org", result.organization.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    const tCookie = (performance.now() - tCookie0).toFixed(1);

    // Revalidate dashboard target without invalidating root layout and forcing /onboarding re-render
    const tReval0 = performance.now();
    revalidatePath("/dashboard");
    const tReval = (performance.now() - tReval0).toFixed(1);

    const tTotal = (performance.now() - t0).toFixed(1);
    console.log(
      `[OrgCreate] auth: ${tAuth}ms | validation: ${tVal}ms | service: ${tService}ms | cookie: ${tCookie}ms | reval: ${tReval}ms | total action: ${tTotal}ms`
    );

    return {
      success: true,
      organization: result.organization,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Workspace couldn't be created. Please try again.";
    console.error("[OrgCreate] error:", message);
    return {
      success: false,
      error: message,
    };
  }
}

export async function switchOrganizationAction(targetOrgId: string) {
  try {
    const { user } = await requireAuth();
    const userOrgs = await getUserOrganizations(user.id);

    const isMember = userOrgs.some((o) => o.organizationId === targetOrgId);
    if (!isMember) {
      return {
        success: false,
        error: "You are not a member of this organization",
      };
    }

    const cookieStore = await cookies();
    cookieStore.set("ghuru_active_org", targetOrgId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to switch organization";
    return {
      success: false,
      error: message,
    };
  }
}

export async function updateOrganizationAction(input: UpdateOrganizationInput) {
  try {
    const ctx = await requirePermission("organization.update");
    const validated = updateOrganizationSchema.parse(input);

    const updated = await updateOrganization(ctx.organization.id, validated);

    revalidatePath("/settings/organization");
    revalidatePath("/dashboard");
    return {
      success: true,
      organization: updated,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update organization";
    return {
      success: false,
      error: message,
    };
  }
}
