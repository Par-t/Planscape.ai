"use client";

interface InsightPanelProps {
  warnings: string[];
  suggestions: string[];
  checking: boolean;
  hasChanges: boolean;
  onCheck: () => void;
}

export default function InsightPanel({
  warnings,
  suggestions,
  checking,
  hasChanges,
  onCheck,
}: InsightPanelProps) {
  const hasContent = warnings.length > 0 || suggestions.length > 0;

  return (
    <div className="w-72 border-l border-zinc-800 flex flex-col bg-zinc-950">
      {/* Check button */}
      <div className="p-4 border-b border-zinc-800">
        <button
          onClick={onCheck}
          disabled={!hasChanges || checking}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {checking ? "Checking..." : hasChanges ? "✓ Check My Changes" : "No Changes Yet"}
        </button>
        {hasChanges && !checking && (
          <p className="text-xs text-zinc-500 mt-2 text-center">Graph differs from last confirmed state</p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!hasContent && !checking && (
          <p className="text-zinc-600 text-xs text-center mt-4">
            Edit the graph, then click Check to get Claude&apos;s analysis.
          </p>
        )}

        {checking && (
          <div className="flex flex-col gap-2">
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-2/3" />
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Warnings</p>
            <div className="flex flex-col gap-2">
              {warnings.map((w, i) => (
                <div key={i} className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-xs text-red-200 leading-relaxed">
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Suggestions</p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s, i) => (
                <div key={i} className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-3 text-xs text-indigo-200 leading-relaxed">
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
