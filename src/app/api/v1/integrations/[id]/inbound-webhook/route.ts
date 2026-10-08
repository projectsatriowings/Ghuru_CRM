import { NextRequest } from "next/server";
import {
  processInboundWebhook,
  verifyWebhookChallenge,
} from "@/lib/services/integrations/inbound-webhook.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const query: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      query[key] = val;
    });

    const result = await verifyWebhookChallenge(id, { query });
    if (!result.success) {
      return new Response(result.reason || "Forbidden", { status: 403 });
    }

    // Return plaintext challenge string for Meta WhatsApp webhook handshake
    return new Response(result.challenge || "OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    return apiError(error);
  }
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
