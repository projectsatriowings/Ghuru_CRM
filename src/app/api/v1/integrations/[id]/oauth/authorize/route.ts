import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { initiateOAuthFlow } from "@/lib/services/integrations/oauth.service";
import { initiateOAuthSchema } from "@/lib/validations/integrations";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.connect");

    const json = await req.json();
    const validated = initiateOAuthSchema.parse(json);

    const result = await initiateOAuthFlow(
      ctx.organization.id,
      id,
      validated.redirectUri
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
