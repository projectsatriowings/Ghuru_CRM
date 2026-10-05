import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getDealFollowUps,
  createFollowUp,
} from "@/lib/services/follow-up.service";
import { createFollowUpSchema } from "@/lib/validations/follow-up";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: dealId } = await params;
    const ctx = await requirePermission("follow_ups.view");

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const followUpsList = await getDealFollowUps(
      ctx.organization.id,
      dealId,
      { includeArchived }
    );

    return apiSuccess(followUpsList);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: dealId } = await params;
    const ctx = await requirePermission("follow_ups.create");

    const body = await req.json();
    const validated = createFollowUpSchema.parse({
      ...body,
      dealId,
    });

    const followUp = await createFollowUp(
      ctx.organization.id,
      ctx.user.id,
      dealId,
      validated
    );

    return apiSuccess(followUp, 201);
  } catch (error) {
    return apiError(error);
  }
}
