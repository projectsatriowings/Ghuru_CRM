import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { restoreContact } from "@/lib/services/contact.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("contacts.update");

    const restored = await restoreContact(ctx.organization.id, id);

    return apiSuccess({
      message: "Contact restored successfully",
      contact: restored,
    });
  } catch (error) {
    return apiError(error);
  }
}
