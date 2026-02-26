"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ink-faded"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full bg-transparent border-b-2 border-rule px-1 py-2.5",
            "font-body text-ink placeholder:text-ink-ghost",
            "transition-colors duration-250 ease-out",
            "focus:border-primary focus:outline-none",
            error && "border-error focus:border-error",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-error animate-fade-in">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
