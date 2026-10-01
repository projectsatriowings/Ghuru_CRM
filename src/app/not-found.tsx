import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SearchX, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-slate-600 mb-2">
          <SearchX className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Page Not Found
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            The page or resource you are looking for doesn&apos;t exist or may have been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "default" }), "gap-2 inline-flex")}
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
