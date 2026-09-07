import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "active" | "used" | "cancelled" | "info" | "live" | "offline";
  className?: string;
}

export function Badge({ children, variant = "info", className }: BadgeProps) {
  const variants = {
    active: "status-active",
    used: "status-used",
    cancelled: "status-cancelled",
    info: "bg-blue-50 text-blue-700 border border-blue-200",
    live: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    offline: "bg-slate-100 text-slate-600 border border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        variants[variant],
        className
      )}
    >
      {(variant === "live" || variant === "active") && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
}
