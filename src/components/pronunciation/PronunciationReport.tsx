"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Zap, Target, AudioLines, CheckCircle2 } from "lucide-react";
import type { PronunciationResult } from "@/types/pronunciation";

interface PronunciationReportProps {
  result: PronunciationResult;
}

export function PronunciationReport({ result }: PronunciationReportProps) {
  const [expanded, setExpanded] = useState(false);

  const scores = [
    {
      label: "Độ chính xác",
      value: result.accuracyScore,
      icon: Target,
      description: "Phát âm từng âm có đúng không",
    },
    {
      label: "Độ trôi chảy",
      value: result.fluencyScore,
      icon: AudioLines,
      description: "Nói có tự nhiên, liền mạch không",
    },
    {
      label: "Độ đầy đủ",
      value: result.completenessScore,
      icon: CheckCircle2,
      description: "Có nói đủ các từ trong câu không",
    },
    ...(result.prosodyScore !== undefined
      ? [
          {
            label: "Ngữ điệu",
            value: result.prosodyScore,
            icon: Zap,
            description: "Nhịp điệu, trọng âm, lên xuống giọng",
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-lg border border-rule overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-surface hover:bg-page transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">
            Chi tiết phát âm
          </span>
          {result.source === "azure" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Azure
            </span>
          )}
          {result.source === "heuristic" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink/10 text-ink-faded font-medium">
              Ước lượng
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-ink-faded" />
        ) : (
          <ChevronDown size={16} className="text-ink-faded" />
        )}
      </button>

      {expanded && (
        <div className="p-4 border-t border-rule space-y-4 animate-slide-up">
          <div className="grid grid-cols-2 gap-3">
            {scores.map((s) => (
              <div key={s.label} className="p-3 rounded-lg bg-page space-y-1">
                <div className="flex items-center gap-1.5">
                  <s.icon size={14} className="text-ink-faded" />
                  <span className="text-xs font-medium text-ink-faded">
                    {s.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "font-display text-2xl tabular-nums",
                      s.value >= 80
                        ? "text-success"
                        : s.value >= 50
                          ? "text-warning"
                          : "text-error"
                    )}
                  >
                    {s.value}
                  </span>
                  <span className="text-xs text-ink-ghost">/100</span>
                </div>
                <p className="text-[11px] text-ink-ghost">{s.description}</p>
              </div>
            ))}
          </div>

          {result.source === "heuristic" && (
            <p className="text-xs text-ink-ghost text-center">
              Cấu hình Azure Speech trong Cài đặt để nhận phân tích chi tiết từng âm vị.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
