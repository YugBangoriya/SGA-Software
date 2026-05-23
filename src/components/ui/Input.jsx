// src/components/ui/Input.jsx
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * SGA Input field
 * Supports: label, required mark, left/right icon, error state, password toggle
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    type      = "text",
    required  = false,
    className = "",
    id,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType  = isPassword ? (showPassword ? "text" : "password") : type;
  const inputId    = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
          {required && (
            <span className="ml-1 font-semibold" style={{ color: "var(--status-unpaid-text)" }}>
              *
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span
            className="absolute left-3 flex-shrink-0 pointer-events-none"
            style={{ color: "var(--text-placeholder)" }}
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={`
            sg-input
            ${leftIcon  ? "pl-10" : ""}
            ${isPassword || rightIcon ? "pr-10" : ""}
            ${error     ? "error" : ""}
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 flex-shrink-0 focus-visible:outline-none"
            style={{ color: "var(--text-placeholder)" }}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}

        {!isPassword && rightIcon && (
          <span
            className="absolute right-3 flex-shrink-0 pointer-events-none"
            style={{ color: "var(--text-placeholder)" }}
          >
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-xs font-medium"
          style={{ color: "var(--border-error)" }}
          role="alert"
        >
          {error}
        </p>
      )}

      {hint && !error && (
        <p className="text-xs" style={{ color: "var(--text-placeholder)" }}>
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;
