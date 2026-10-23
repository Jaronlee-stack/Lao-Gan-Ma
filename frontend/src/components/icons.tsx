/**
 * Drawn icon set for Lao Gan Ma. One consistent 1.75 stroke, currentColor,
 * 24x24 viewbox. Replaces emoji-as-icon so the UI ships a real icon system.
 * Decorative by default (aria-hidden); pass a `title` to label one.
 */
import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Base({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Chili pepper — the brand mark, drawn rather than emoji. */
export function Chili(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8.5 7.5c-2.2 1.3-3.5 3.8-3.5 6.4 0 2.8 2.2 5.1 5 5.1 4.4 0 8-4.3 8-9.6" />
      <path d="M18 9.4c.9-.3 1.6-1.1 1.8-2.1.1-.6-.1-1.2-.6-1.5-.7-.5-1.7-.2-2.2.5" />
      <path d="M17 6.3c.3-1 1.2-1.7 2.3-1.6" />
    </Base>
  );
}

export function Sparkle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </Base>
  );
}

export function Check(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </Base>
  );
}

export function Shield(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3l7 2.5v5.2c0 4.5-3 8-7 10.3-4-2.3-7-5.8-7-10.3V5.5L12 3z" />
      <path d="M9 12l2 2 4-4.5" />
    </Base>
  );
}

export function Chat(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </Base>
  );
}

export function Adapt(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 10a8 8 0 0113.5-4.5L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 14a8 8 0 01-13.5 4.5L4 16" />
      <path d="M4 20v-4h4" />
    </Base>
  );
}

export function Alert(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4.5l8.5 14.5H3.5L12 4.5z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Base>
  );
}

export function Brain(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 4.5A3 3 0 006 7.4 3 3 0 004.5 10 3 3 0 006 12.6 3 3 0 009 15.5V4.5z" />
      <path d="M15 4.5A3 3 0 0118 7.4 3 3 0 0119.5 10 3 3 0 0118 12.6 3 3 0 0115 15.5V4.5z" />
      <path d="M9 4.5a3 3 0 016 0M9 15.5a3 3 0 006 0" />
      <path d="M12 4.5v15" />
    </Base>
  );
}

export function X(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function Moon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" />
    </Base>
  );
}

export function Sun(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </Base>
  );
}

/** Rating star. Filled via the `filled` prop rather than a glyph. */
export function Star({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Base {...props} fill={filled ? "currentColor" : "none"}>
      <path d="M12 3.5l2.6 5.5 5.9.8-4.3 4.2 1.05 5.9L12 17.1l-5.3 2.8L7.75 14 3.5 9.8l5.9-.8L12 3.5z" />
    </Base>
  );
}
