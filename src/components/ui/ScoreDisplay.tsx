"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  score: number;
  maxScore?: number;
  className?: string;
  animated?: boolean;
}

export function ScoreDisplay({
  score,
  maxScore = 100,
  className,
  animated = true,
}: ScoreDisplayProps) {
  const [display, setDisplay] = useState(animated ? 0 : score);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!animated) {
      setDisplay(score);
      return;
    }

    const duration = 1200;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(score * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score, animated]);

  const colorClass = () => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-error";
  };

  return (
    <div
      className={cn("flex items-baseline gap-1 animate-score-pop", className)}
    >
      <span className={cn("font-display text-4xl tabular-nums", colorClass())}>
        {display}
      </span>
      <span className="text-ink-ghost text-lg">/ {maxScore}</span>
    </div>
  );
}
