export default function SkeletonCard() {
  return (
    <div className="bg-[#0F0F0F] rounded-2xl border border-[#262626] overflow-hidden">
      <div className="h-36 shimmer" />
      <div className="p-3 space-y-3">
        <div className="h-4 shimmer rounded-lg w-3/4" />
        <div className="space-y-1.5">
          <div className="h-3 shimmer rounded-lg w-full" />
          <div className="h-3 shimmer rounded-lg w-4/5" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="h-5 shimmer rounded-lg w-1/4" />
          <div className="h-8 shimmer rounded-xl w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 shimmer rounded-lg ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonOrderCard() {
  return (
    <div className="bg-[#0F0F0F] rounded-2xl border border-[#262626] p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-1.5 flex-1">
          <div className="h-4 shimmer rounded-lg w-2/3" />
          <div className="h-3 shimmer rounded-lg w-1/3" />
        </div>
        <div className="h-6 shimmer rounded-full w-20 ml-4" />
      </div>
      <div className="h-px bg-[#262626]" />
      <SkeletonText lines={2} />
    </div>
  );
}
