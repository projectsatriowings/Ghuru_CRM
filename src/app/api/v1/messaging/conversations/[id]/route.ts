import { requirePermission } from "@/lib/context/organization-context";
import { getConversationById } from "@/lib/services/messaging/messaging.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const ctx = await requirePermission("messaging.view");
    const { id } = await params;

    const conversation = await getConversationById(ctx.organization.id, id);
    return apiSuccess(conversation);
  } catch (error) {
    return apiError(error);
  }
}
