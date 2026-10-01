import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardNotFound() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-600 mb-1">
          <FileQuestion className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Resource Not Found
          </h2>
          <p className="text-sm text-slate-500">
            The lead or record you requested does not exist or may have been deleted.
          </p>
        </div>

        <div className="pt-2 flex justify-center gap-3">
          <Link
            href="/leads"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Leads
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "default" }), "gap-2")}
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
