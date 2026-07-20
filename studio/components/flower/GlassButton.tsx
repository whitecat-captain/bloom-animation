import type { ButtonHTMLAttributes } from "react";

/** liquid-glass-strong pill button — rounded-full, hover:scale-105 active:scale-95 */
export default function GlassButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`liquid-glass-strong rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
