"use client";

interface InsightPanelProps {
  checking: boolean;
  hasChanges: boolean;
  onCheck: () => void;
  summary: string;
}

export default function InsightPanel({
  checking,
  hasChanges,
  onCheck,
  summary,
}: InsightPanelProps) {
  return (
    <div className="w-56 border-l border-zinc-800 flex flex-col bg-zinc-950 min-h-0">
      <div className="p-4 border-b border-zinc-800 flex-shrink-0">
        <button
          onClick={onCheck}
          disabled={!hasChanges || checking}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {checking ? "Checking..." : hasChanges ? "Check My Changes" : "No Changes Yet"}
        </button>
        {hasChanges && !checking && (
          <p className="text-xs text-zinc-500 mt-2 text-center">Graph differs from last confirmed state</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {checking && (
          <div className="flex flex-col gap-2">
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4 mt-2" />
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
          </div>
        )}

        {!checking && summary && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Summary</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">{summary}</p>
          </div>
        )}

        {!checking && !summary && (
          <p className="text-zinc-600 text-xs text-center mt-4">
            Edit the graph, then check. Results appear here.
          </p>
        )}
      </div>
    </div>
  );
}
