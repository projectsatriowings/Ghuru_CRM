import { NextRequest, NextResponse } from "next/server";
import { handleOAuthCallback } from "@/lib/services/integrations/oauth.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const acceptsHtml = req.headers.get("accept")?.includes("text/html");

  if (errorParam) {
    if (acceptsHtml) {
      const redirectUrl = new URL("/settings/integrations", req.url);
      redirectUrl.searchParams.set("error", errorDescription || errorParam);
      return NextResponse.redirect(redirectUrl);
    }
    return apiError(
      new ValidationError(`OAuth provider error: ${errorDescription || errorParam}`)
    );
  }

  if (!state || !code) {
    if (acceptsHtml) {
      const redirectUrl = new URL("/settings/integrations", req.url);
      redirectUrl.searchParams.set(
        "error",
        "Missing state or code in OAuth callback."
      );
      return NextResponse.redirect(redirectUrl);
    }
    return apiError(
      new ValidationError("Missing required state or code query parameter.")
    );
  }

  try {
    const result = await handleOAuthCallback({
      state,
      code,
    });

    if (acceptsHtml) {
      const redirectUrl = new URL("/settings/integrations", req.url);
      redirectUrl.searchParams.set("success", "oauth_connected");
      redirectUrl.searchParams.set("integrationId", result.integrationId);
      return NextResponse.redirect(redirectUrl);
    }

    return apiSuccess(result);
  } catch (err: unknown) {
    if (acceptsHtml) {
      const redirectUrl = new URL("/settings/integrations", req.url);
      const errMsg =
        err instanceof Error ? err.message : "OAuth connection failed.";
      redirectUrl.searchParams.set("error", errMsg);
      return NextResponse.redirect(redirectUrl);
    }
    return apiError(err);
  }
}
