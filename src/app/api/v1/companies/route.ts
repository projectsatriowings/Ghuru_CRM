import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getCompanies, createCompany } from "@/lib/services/company.service";
import {
  createCompanySchema,
  companyQuerySchema,
} from "@/lib/validations/company";
import {
  apiSuccess,
  apiPaginatedSuccess,
  apiError,
} from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("companies.view");

    const { searchParams } = new URL(req.url);
    const query = companyQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
      archived: searchParams.get("archived") || "false",
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 25,
      sort: searchParams.get("sort") || "createdAt",
      sortDirection: searchParams.get("sortDirection") || "desc",
    });

    const result = await getCompanies(ctx.organization.id, query);

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("companies.create");

    const body = await req.json();
    const validated = createCompanySchema.parse(body);

    const company = await createCompany(ctx.organization.id, validated);

    return apiSuccess(company, 201);
  } catch (error) {
    return apiError(error);
  }
}
