"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShieldAlert, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  const isForbidden =
    error.message?.includes("Forbidden") ||
    error.message?.includes("permission") ||
    error.name === "ForbiddenError";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 text-red-600 mb-2">
          {isForbidden ? (
            <ShieldAlert className="w-7 h-7" />
          ) : (
            <AlertTriangle className="w-7 h-7" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isForbidden ? "Access Denied" : "Something went wrong"}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {isForbidden
              ? "You do not have the required permissions to view this section. If you believe this is an error, contact your organization administrator."
              : "An unexpected error occurred while loading this view. You can try refreshing the page or navigating back to your dashboard."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => reset()}
            className="w-full sm:w-auto gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto gap-2")}
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
