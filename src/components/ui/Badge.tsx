import React from "react";
import { cn } from "@/lib/utils";
import { Lock, Circle, CheckCircle2 } from "lucide-react";

type BadgeStatus = "locked" | "open" | "completed";

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

const config: Record<
  BadgeStatus,
  { label: string; icon: React.ElementType; style: string }
> = {
  locked: {
    label: "Locked",
    icon: Lock,
    style: "bg-page text-ink-ghost border-rule",
  },
  open: {
    label: "Ready",
    icon: Circle,
    style: "bg-primary/10 text-primary border-primary/30",
  },
  completed: {
    label: "Done",
    icon: CheckCircle2,
    style: "bg-success-light text-success border-success/30",
  },
};

export function Badge({ status, className }: BadgeProps) {
  const { label, icon: Icon, style } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
        style,
        className
      )}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}
