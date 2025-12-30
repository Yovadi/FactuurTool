export function SkeletonCard() {
  return (
    <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-dark-700 rounded-lg w-12 h-12" />
      </div>
      <div>
        <div className="h-4 bg-dark-700 rounded w-24 mb-3" />
        <div className="h-8 bg-dark-700 rounded w-16 mb-2" />
        <div className="h-3 bg-dark-700 rounded w-32" />
      </div>
    </div>
  );
}

export function SkeletonNotification() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800 border border-dark-700 animate-pulse">
      <div className="w-5 h-5 bg-dark-700 rounded mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-dark-700 rounded w-3/4" />
        <div className="h-3 bg-dark-700 rounded w-full" />
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden animate-pulse">
      <div className="bg-dark-800 border-b border-dark-700 p-4">
        <div className="h-4 bg-dark-700 rounded w-32" />
      </div>
      <div className="divide-y divide-dark-700">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 flex gap-4">
            <div className="h-4 bg-dark-700 rounded w-1/4" />
            <div className="h-4 bg-dark-700 rounded w-1/3" />
            <div className="h-4 bg-dark-700 rounded w-1/5" />
            <div className="h-4 bg-dark-700 rounded w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="mb-8 animate-pulse">
        <div className="h-8 bg-dark-800 rounded w-48 mb-2" />
        <div className="h-4 bg-dark-800 rounded w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-dark-700 rounded-lg w-8 h-8" />
            <div className="h-5 bg-dark-700 rounded w-40" />
          </div>
          <div className="space-y-3">
            <SkeletonNotification />
            <SkeletonNotification />
            <SkeletonNotification />
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-dark-700 rounded-lg w-8 h-8" />
            <div className="h-5 bg-dark-700 rounded w-40" />
          </div>
          <div className="space-y-3">
            <SkeletonNotification />
            <SkeletonNotification />
          </div>
        </div>
      </div>
    </div>
  );
}
