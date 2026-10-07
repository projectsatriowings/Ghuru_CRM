import { NextRequest } from "next/server";
import { processInboundWebhook } from "@/lib/services/integrations/inbound-webhook.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const rawBody = await req.text();

    // Extract query parameters
    const query: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      query[key] = val;
    });

    const result = await processInboundWebhook(id, {
      rawBody,
      headers: req.headers,
      query,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
