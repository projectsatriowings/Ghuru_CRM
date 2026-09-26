export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-40 bg-slate-200/80 rounded-lg" />
        <div className="h-4 w-64 bg-slate-200/60 rounded" />
      </div>

      {/* 4 Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between"
          >
            <div className="space-y-2 flex-1 pr-3">
              <div className="h-3 w-16 bg-slate-200/60 rounded" />
              <div className="h-6 w-24 bg-slate-200/80 rounded" />
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 shrink-0" />
          </div>
        ))}
      </div>

      {/* 2 Main Panels Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4"
          >
            <div className="h-5 w-48 bg-slate-200/80 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((j) => (
                <div
                  key={j}
                  className="h-10 bg-slate-100/70 rounded-lg flex items-center justify-between px-3"
                >
                  <div className="h-3.5 w-24 bg-slate-200/70 rounded" />
                  <div className="h-4 w-20 bg-slate-200/70 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
