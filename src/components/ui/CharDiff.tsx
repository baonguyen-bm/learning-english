"use client";

import React from "react";
import { type CharDiffOp } from "@/lib/scoring";

interface CharDiffProps {
  ops: CharDiffOp[];
}

export function CharDiff({ ops }: CharDiffProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-ink-faded uppercase tracking-wider">
        Letter-by-letter comparison
      </p>
      <div className="flex flex-wrap gap-0.5 font-mono text-xl tracking-wider">
        {ops.map((op, i) => {
          switch (op.type) {
            case "match":
              return (
                <span key={i} className="text-success">
                  {op.char}
                </span>
              );
            case "substitute":
              return (
                <span
                  key={i}
                  className="relative inline-flex flex-col items-center"
                >
                  <span className="text-error line-through opacity-60 text-sm absolute -top-4">
                    {op.got}
                  </span>
                  <span className="text-warning font-bold underline decoration-warning/40 decoration-2 underline-offset-4">
                    {op.expected}
                  </span>
                </span>
              );
            case "insert":
              return (
                <span
                  key={i}
                  className="text-warning font-bold bg-warning/10 rounded px-0.5 underline decoration-wavy decoration-warning/60 underline-offset-4"
                >
                  {op.char}
                </span>
              );
            case "delete":
              return (
                <span
                  key={i}
                  className="text-error/50 line-through text-sm self-center"
                >
                  {op.char}
                </span>
              );
          }
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-ghost">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-success/20 border border-success/40" />
          Correct
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/40" />
          Wrong / Missing
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-error/20 border border-error/40" />
          Extra
        </span>
      </div>
    </div>
  );
}
