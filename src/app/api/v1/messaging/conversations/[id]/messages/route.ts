import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getMessages,
  sendMessage,
} from "@/lib/services/messaging/messaging.service";
import {
  messagesQuerySchema,
  sendMessageSchema,
} from "@/lib/validations/messaging";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const ctx = await requirePermission("messaging.view");
    const { id } = await params;

    const searchParams = req.nextUrl.searchParams;
    const query = messagesQuerySchema.parse({
      status: searchParams.get("status") || undefined,
      type: searchParams.get("type") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 50,
    });

    const result = await getMessages(ctx.organization.id, id, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const ctx = await requirePermission("messaging.send");
    const { id } = await params;

    const body = await req.json();
    const validated = sendMessageSchema.parse(body);

    const result = await sendMessage(
      ctx.organization.id,
      id,
      validated,
      ctx.user.id
    );

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
