import { Logo } from "@/components/brand/logo";

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col justify-between p-4 sm:p-8 animate-pulse">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto py-4 flex items-center justify-between">
        <Logo variant="light" size="md" />
        <div className="h-4 w-16 bg-slate-200/80 rounded" />
      </header>

      {/* Main Stepper Card Skeleton */}
      <main className="w-full my-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-10 max-w-4xl mx-auto flex flex-col md:flex-row gap-8 lg:gap-12">
          {/* Left Stepper Sidebar */}
          <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-8 space-y-6">
            <div className="h-4 w-28 bg-slate-200/60 rounded" />
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-slate-200/70 rounded" />
                  <div className="h-3 w-16 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-28 bg-slate-200/50 rounded" />
                  <div className="h-3 w-16 bg-slate-100 rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Skeleton */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="h-7 w-48 bg-slate-200/80 rounded-lg" />
              <div className="h-4 w-72 bg-slate-200/60 rounded" />
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="h-4 w-28 bg-slate-200/60 rounded" />
                <div className="h-11 bg-slate-100 rounded-lg" />
              </div>

              <div className="space-y-2">
                <div className="h-4 w-28 bg-slate-200/60 rounded" />
                <div className="h-11 bg-slate-100 rounded-lg" />
              </div>

              <div className="pt-4">
                <div className="h-11 w-full bg-blue-600/40 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-4 text-xs text-slate-400">
        Ghuru CRM &bull; Smarter Business. Stronger Growth.
      </footer>
    </div>
  );
}
