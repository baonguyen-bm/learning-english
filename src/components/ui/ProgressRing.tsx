"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  animated?: boolean;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  className,
  animated = true,
}: ProgressRingProps) {
  const [displayed, setDisplayed] = useState(animated ? 0 : progress);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  useEffect(() => {
    if (!animated) {
      setDisplayed(progress);
      return;
    }
    const timer = setTimeout(() => setDisplayed(progress), 50);
    return () => clearTimeout(timer);
  }, [progress, animated]);

  const strokeColor = () => {
    if (progress >= 80) return "var(--success)";
    if (progress >= 50) return "var(--warning)";
    if (progress > 0) return "var(--accent)";
    return "var(--rule)";
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: animated
              ? "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)"
              : "none",
          }}
        />
      </svg>
      <span className="absolute font-display text-lg text-ink tabular-nums">
        {Math.round(displayed)}
      </span>
    </div>
  );
}
