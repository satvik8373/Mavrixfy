/**
 * Skeleton loader for search results
 * Provides smooth loading experience
 */
export const SearchSkeleton = () => {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((id) => (
        <div
          key={id}
          className="flex items-center gap-4 p-3 rounded-lg bg-[#282828]/50"
        >
          {/* Index placeholder */}
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 bg-gray-600 rounded"></div>
          </div>

          {/* Image placeholder */}
          <div className="w-14 h-14 rounded-md bg-gray-600 flex-shrink-0"></div>

          {/* Song info placeholder */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-gray-600 rounded w-3/4"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>

          {/* Duration placeholder */}
          <div className="w-12 h-3 bg-gray-600 rounded flex-shrink-0"></div>
        </div>
      ))}
    </div>
  );
};
