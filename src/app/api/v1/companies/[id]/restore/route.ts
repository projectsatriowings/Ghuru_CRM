import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { restoreCompany } from "@/lib/services/company.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("companies.update");

    const restored = await restoreCompany(ctx.organization.id, id);

    return apiSuccess({
      message: "Company restored successfully",
      company: restored,
    });
  } catch (error) {
    return apiError(error);
  }
}
