export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-36 bg-slate-200/80 rounded-lg" />
          <div className="h-3.5 w-60 bg-slate-200/60 rounded" />
        </div>
        <div className="h-9 w-28 bg-slate-200/80 rounded-lg" />
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="h-9 w-64 bg-slate-100 rounded-lg" />
        <div className="h-4 w-16 bg-slate-100 rounded" />
      </div>

      {/* Content Skeleton Cards / Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 bg-slate-50/80 rounded-xl border border-slate-100 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-200/70" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-slate-200/80 rounded" />
                <div className="h-3 w-48 bg-slate-200/50 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-20 bg-slate-200/60 rounded-full" />
              <div className="h-8 w-8 bg-slate-200/60 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
