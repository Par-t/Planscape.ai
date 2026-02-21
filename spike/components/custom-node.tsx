"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

const targetHandleClass = "target-handle !opacity-0 !border-none !bg-transparent !w-8 !h-8";
const sourceHandleClass =
  "source-handle !w-4 !h-4 !bg-indigo-500 !border-2 !border-indigo-300 !opacity-0 group-hover:!opacity-100 transition-opacity";

const dotColors: Record<string, string> = {
  error: "#ef4444",
  warning: "#f59e0b",
  ok: "#10b981",
};

function CustomNode({ id, data, selected }: NodeProps) {
  const annotation = data.annotation as
    | { status: "ok" | "warning" | "error"; reasons: string[] }
    | undefined;

  return (
    <div className="custom-node-wrapper group relative">
      {/* Delete button — trash icon, shown when selected */}
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-10 w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-500 cursor-pointer border-3 border-red-800 shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}

      {/* Annotation badge — shown after check */}
      {annotation && annotation.reasons.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onAnnotationClick?.({
              nodeId: id,
              label: data.label,
              status: annotation.status,
              reasons: annotation.reasons,
            });
          }}
          className="absolute -top-6 -right-6 z-10 w-14 h-14 rounded-full text-xl font-bold flex items-center justify-center text-white cursor-pointer border-3 border-zinc-900 shadow-lg"
          style={{ background: dotColors[annotation.status] || dotColors.ok }}
        >
          {annotation.reasons.length}
        </button>
      )}

      <div className="custom-node-body" style={data.nodeStyle}>
        {data.label}
      </div>

      {/* Target handles — invisible but functional */}
      <Handle type="target" position={Position.Top} id="target-top" className={targetHandleClass} isConnectable />
      <Handle type="target" position={Position.Right} id="target-right" className={targetHandleClass} isConnectable />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className={targetHandleClass} isConnectable />
      <Handle type="target" position={Position.Left} id="target-left" className={targetHandleClass} isConnectable />

      {/* Source handles — appear on hover */}
      <Handle type="source" position={Position.Top} id="source-top" className={sourceHandleClass} isConnectable />
      <Handle type="source" position={Position.Right} id="source-right" className={sourceHandleClass} isConnectable />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className={sourceHandleClass} isConnectable />
      <Handle type="source" position={Position.Left} id="source-left" className={sourceHandleClass} isConnectable />
    </div>
  );
}

export default memo(CustomNode);
