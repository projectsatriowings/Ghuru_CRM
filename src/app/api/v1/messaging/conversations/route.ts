import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getConversations,
  findOrCreateConversation,
} from "@/lib/services/messaging/messaging.service";
import {
  conversationsQuerySchema,
  createConversationSchema,
} from "@/lib/validations/messaging";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("messaging.view");

    const searchParams = req.nextUrl.searchParams;
    const query = conversationsQuerySchema.parse({
      channel: searchParams.get("channel") || undefined,
      status: searchParams.get("status") || undefined,
      contactId: searchParams.get("contactId") || undefined,
      leadId: searchParams.get("leadId") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 20,
    });

    const result = await getConversations(ctx.organization.id, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("messaging.send");

    const body = await req.json();
    const validated = createConversationSchema.parse(body);

    const conversation = await findOrCreateConversation(
      ctx.organization.id,
      validated.integrationId,
      validated.channel,
      validated.participantId,
      {
        participantName: validated.participantName,
        contactId: validated.contactId,
        leadId: validated.leadId,
        metadata: validated.metadata,
      }
    );

    return apiSuccess(conversation, 201);
  } catch (error) {
    return apiError(error);
  }
}
