/**
 * One button. Per the framed-sheet sheet the primary action is near-black and
 * the secondary is an outlined control; the brand hue stays out of the chrome.
 * Nothing at rest carries a shadow.
 */
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "subtle" | "accent" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-control " +
  "transition-colors duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface disabled:opacity-45 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:opacity-90",
  secondary: "border border-control text-ink hover:bg-raised",
  subtle: "text-muted hover:bg-raised hover:text-ink",
  // Reserved for the one place the brand hue belongs on a control.
  accent: "bg-accent text-accent-ink hover:opacity-90",
  danger: "border border-control text-negative hover:bg-pill-neg-bg",
};

const sizes: Record<Size, string> = {
  sm: "text-small px-2.5 h-control",
  md: "text-body px-4 h-9",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className = "", children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      data-ring
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M12 2a10 10 0 0110 10h-3a7 7 0 00-7-7V2z" fill="currentColor" opacity="0.9" />
        </svg>
      )}
      {children}
    </button>
  );
});
