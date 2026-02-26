"use client";

interface InsightPanelProps {
  checking: boolean;
  hasChanges: boolean;
  onCheck: () => void;
  summary: string;
  error?: string | null;
}

export default function InsightPanel({
  checking,
  hasChanges,
  onCheck,
  summary,
  error,
}: InsightPanelProps) {
  return (
    <div className="w-56 border-l border-zinc-800/50 flex flex-col bg-zinc-950 min-h-0">
      <div className="p-4 border-b border-zinc-800/50 flex-shrink-0">
        <button
          onClick={onCheck}
          disabled={!hasChanges || checking}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all btn-glow-emerald"
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              Claude is reviewing...
            </span>
          ) : hasChanges ? (
            "Check My Changes"
          ) : (
            "No Changes Yet"
          )}
        </button>
        {hasChanges && !checking && (
          <p className="text-xs text-zinc-500 mt-2 text-center">Graph differs from last confirmed state</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {checking && !summary && (
          <div className="flex flex-col gap-2">
            <div className="h-3 rounded skeleton-shimmer w-3/4" />
            <div className="h-3 rounded skeleton-shimmer w-1/2" />
            <div className="h-3 rounded skeleton-shimmer w-2/3" />
            <div className="h-3 rounded skeleton-shimmer w-3/4 mt-2" />
            <div className="h-3 rounded skeleton-shimmer w-1/2" />
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Summary</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">{summary}</p>
            {checking && (
              <p className="text-[10px] text-zinc-600 flex items-center gap-1.5 mt-1">
                <svg className="w-3 h-3 spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                Still reviewing...
              </p>
            )}
          </div>
        )}

        {!checking && !summary && !error && (
          <p className="text-zinc-600 text-xs text-center mt-8 leading-relaxed">
            Drag steps around, add connections,<br />
            delete things recklessly.<br />
            <span className="text-zinc-500 mt-1 block">Then hit the button. We&apos;ll tell you what you broke.</span>
          </p>
        )}

        {!checking && !summary && error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
