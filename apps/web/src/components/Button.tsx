import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

const VARIANTS = {
  primary: "bg-amber font-semibold text-ground hover:brightness-105 disabled:opacity-60",
  ghost: "border border-hairline text-text hover:bg-panel disabled:opacity-60",
};

export function Button({ variant = "primary", className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-[9px] px-3.5 py-2 text-base leading-none disabled:cursor-not-allowed sm:min-h-0 sm:text-[0.84rem] ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
