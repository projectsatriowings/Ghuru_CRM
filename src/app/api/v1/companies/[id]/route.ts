import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getCompanyById,
  updateCompany,
  archiveCompany,
} from "@/lib/services/company.service";
import { updateCompanySchema } from "@/lib/validations/company";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("companies.view");

    const company = await getCompanyById(ctx.organization.id, id);

    return apiSuccess(company);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("companies.update");

    const body = await req.json();
    const validated = updateCompanySchema.parse(body);

    const updated = await updateCompany(ctx.organization.id, id, validated);

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("companies.delete");

    const archived = await archiveCompany(ctx.organization.id, id);

    return apiSuccess({
      message: "Company archived successfully",
      company: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
