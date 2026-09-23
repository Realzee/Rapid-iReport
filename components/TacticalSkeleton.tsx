import React from 'react';

interface TacticalSkeletonProps {
  title?: string;
  subtitle?: string;
  cardsCount?: number;
  rowsCount?: number;
}

export const TacticalSkeleton: React.FC<TacticalSkeletonProps> = ({
  title = 'RAPID COMMAND SYSTEM',
  subtitle = 'Synchronizing real-time telemetry and dispatch feed...',
  cardsCount = 4,
  rowsCount = 6,
}) => {
  return (
    <div className="w-full min-h-[70vh] p-4 sm:p-6 lg:p-8 animate-pulse text-gray-900 dark:text-gray-100">
      {/* Top Banner Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0">
            <span className="w-4 h-4 rounded-full bg-blue-500 animate-ping" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-48 bg-gray-300 dark:bg-gray-700 rounded-lg" />
              <span className="h-5 w-24 bg-blue-500/20 rounded-full" />
            </div>
            <div className="h-3.5 w-64 sm:w-96 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-10 w-32 bg-gray-300 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="w-5 h-5 bg-gray-200 dark:bg-gray-800 rounded-full" />
            </div>
            <div className="flex items-baseline justify-between">
              <div className="h-8 w-14 bg-gray-300 dark:bg-gray-700 rounded-lg" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-800 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Control Tabs / Filter Bar Skeleton */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="h-9 w-24 bg-gray-300 dark:bg-gray-700 rounded-xl" />
          <div className="h-9 w-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
        <div className="h-9 w-full sm:w-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>

      {/* Table / List View Skeleton */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
          {Array.from({ length: rowsCount }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="space-y-1.5 flex-1 max-w-md">
                  <div className="h-4 w-3/4 bg-gray-300 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-800 rounded" />
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-800 rounded-full" />
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-800 rounded-full" />
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TacticalSkeleton;
