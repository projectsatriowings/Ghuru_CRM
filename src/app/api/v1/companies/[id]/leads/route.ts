import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getCompanyLeads,
  setLeadCompany,
} from "@/lib/services/company.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const associateLeadSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
});

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("companies.view");

    const leads = await getCompanyLeads(ctx.organization.id, id);

    return apiSuccess(leads);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = await params;
    const ctx = await requirePermission("leads.update");

    const body = await req.json();
    const validated = associateLeadSchema.parse(body);

    await setLeadCompany(ctx.organization.id, validated.leadId, companyId);

    const leads = await getCompanyLeads(ctx.organization.id, companyId);

    return apiSuccess({
      message: "Lead associated with company successfully",
      leads,
    });
  } catch (error) {
    return apiError(error);
  }
}
