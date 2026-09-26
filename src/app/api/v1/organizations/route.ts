import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/context/organization-context";
import {
  createOrganization,
  getUserOrganizations,
} from "@/lib/services/organization.service";
import { createOrganizationSchema } from "@/lib/validations/organization";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const { user } = await requireAuth();
    const orgs = await getUserOrganizations(user.id);
    return apiSuccess(orgs);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const body = await req.json();
    const validated = createOrganizationSchema.parse(body);

    const result = await createOrganization({
      name: validated.name,
      slug: validated.slug,
      userId: user.id,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
