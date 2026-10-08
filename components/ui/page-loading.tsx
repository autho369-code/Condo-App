// Shown the moment a link is clicked, while the server builds the page
// (app/**/loading.tsx). Without it the old page stayed on screen until the
// new one was fully rendered, so clicks looked frozen for seconds.
export function PageLoading() {
  return (
    <div className="animate-pulse space-y-5 p-4 sm:p-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="h-6 w-48 rounded-md bg-gray-200" />
        <div className="h-4 w-72 max-w-full rounded-md bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-gray-200 bg-white" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div className="h-4 w-1/3 rounded bg-gray-100" />
            <div className="h-4 w-1/5 rounded bg-gray-100" />
            <div className="ml-auto h-4 w-16 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
