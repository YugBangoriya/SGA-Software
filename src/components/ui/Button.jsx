// src/components/ui/Button.jsx
import { forwardRef } from "react";

/**
 * SGA Button
 * variant: "primary" | "secondary" | "danger" | "ghost"
 * size:    "sm" | "md" | "lg"
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = "primary",
    size    = "md",
    className = "",
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    ...props
  },
  ref
) {
  const base =
    "sg-btn select-none font-sans transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2";

  const variants = {
    primary:   "sg-btn-primary",
    secondary: "sg-btn-secondary",
    danger:    "sg-btn-danger",
    ghost:     "sg-btn-ghost",
  };

  const sizes = {
    sm: "text-xs px-3 min-h-[36px] gap-1.5",
    md: "text-sm px-5 min-h-[44px] gap-2",
    lg: "text-base px-6 min-h-[52px] gap-2.5",
  };

  return (
    <button
      ref={ref}
      className={`
        ${base}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${fullWidth ? "w-full" : ""}
        ${isLoading ? "opacity-70 cursor-not-allowed" : ""}
        ${className}
      `}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          <span>Loading…</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default Button;
