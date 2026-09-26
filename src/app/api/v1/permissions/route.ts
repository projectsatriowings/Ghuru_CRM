import { requireAuth } from "@/lib/context/organization-context";
import { getAllSystemPermissions } from "@/lib/services/role.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    await requireAuth();
    const perms = await getAllSystemPermissions();
    return apiSuccess(perms);
  } catch (error) {
    return apiError(error);
  }
}
