import { AuthSidePanel } from "@/components/auth/auth-side-panel";
import { Logo } from "@/components/brand/logo";

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F7F9FC]">
      {/* Left 40% Static Brand Panel */}
      <AuthSidePanel currentStep={1} className="w-full lg:w-[40%] xl:w-[38%] min-h-screen" />

      {/* Right 60% Form Content Skeleton Area */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-20 overflow-y-auto">
        <div className="w-full max-w-lg my-auto animate-pulse space-y-6">
          <div className="lg:hidden mb-8">
            <Logo variant="light" size="md" />
          </div>

          <div className="space-y-2 mb-8">
            <div className="h-9 w-64 bg-slate-200/80 rounded-lg" />
            <div className="h-4 w-80 bg-slate-200/60 rounded" />
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200/60 rounded" />
              <div className="h-11 w-full bg-white border border-slate-200/80 rounded-lg" />
            </div>

            <div className="space-y-2">
              <div className="h-4 w-28 bg-slate-200/60 rounded" />
              <div className="h-11 w-full bg-white border border-slate-200/80 rounded-lg" />
              <div className="h-3 w-56 bg-slate-200/40 rounded" />
            </div>

            <div className="pt-3">
              <div className="h-11 w-full bg-blue-600/50 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
