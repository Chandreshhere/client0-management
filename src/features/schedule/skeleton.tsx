import { Skeleton } from "@/components/ui/misc";

/** Suspense fallback while search params resolve. */
export function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading schedule">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-80 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-[720px] rounded-full" />
      <Skeleton className="h-[480px] w-full rounded-card" />
    </div>
  );
}
