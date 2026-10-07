import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getProviders,
  registerProvider,
} from "@/lib/services/integrations/provider-registry.service";
import { createIntegrationProviderSchema } from "@/lib/validations/integrations";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("integrations.view");

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;

    const providers = await getProviders({ category, status });

    return apiSuccess(providers);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("integrations.connect");

    const body = await req.json();
    const validated = createIntegrationProviderSchema.parse(body);

    const provider = await registerProvider(validated);

    return apiSuccess(provider, 201);
  } catch (error) {
    return apiError(error);
  }
}
