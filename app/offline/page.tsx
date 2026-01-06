'use client';

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
          <WifiOff className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
        </div>

        {/* Title */}
        <h1 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">
          You're Offline
        </h1>

        {/* Description */}
        <p className="mb-8 text-slate-600 dark:text-slate-400">
          Please check your internet connection and try again.
        </p>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>

        {/* Info */}
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-500">
          Some features may not be available while offline.
        </p>
      </div>
    </div>
  );
}
